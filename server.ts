import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =======================================================
// INPUT VALIDATION SCHEMAS
// =======================================================

const CartItemSchema = z.object({
  productId: z.string().min(1, { message: "ID do produto faltando" }),
  productName: z.string().min(1),
  productImage: z.string().optional().nullable(),
  variationId: z.string().min(1, { message: "ID da variação faltando" }),
  variationName: z.string().min(1),
  price: z.number(),
  quantity: z.number().int().positive(),
});

const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  email: z.string().email(),
  customerName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  paymentMethod: z.string(),
  paymentId: z.string().optional().nullable(),
  orderNsu: z.string().optional().nullable(),
  totalAmount: z.number(),
  discountAmount: z.number().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
});

interface ProductVariation {
  id: string;
  name: string;
  price: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simple Request Logger
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/create-order", async (req, res) => {
    console.log("--- REQUEST RECEIVED: /api/create-order ---");
    
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Supabase environment variables missing");
        return res.status(500).json({ 
          success: false, 
          error: "Configuração do servidor incompleta (Env vars faltando no backend)" 
        });
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Validation
      const parseResult = CreateOrderSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        const fieldErrors = parseResult.error.flatten().fieldErrors;
        console.error("Zod Validation Error:", fieldErrors);
        return res.status(400).json({ 
          success: false, 
          error: "Dados do pedido inválidos",
          validationErrors: fieldErrors 
        });
      }

      const body = parseResult.data;
      console.log("Processing order for:", body.email);

      // 1. Fetch products to validate prices
      const productIds = [...new Set(body.items.map(i => i.productId))];
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, variations, name")
        .in("id", productIds);

      if (productsError) throw productsError;
      if (!products || products.length === 0) {
        return res.status(400).json({ success: false, error: "Produtos não encontrados no catálogo" });
      }

      // 2. Build variation map
      const productVariationsMap = new Map();
      for (const product of products) {
        const variationsMap = new Map();
        const variations = product.variations as ProductVariation[];
        if (Array.isArray(variations)) {
          for (const v of variations) {
            variationsMap.set(v.id, v.price);
          }
        }
        productVariationsMap.set(product.id, variationsMap);
      }

      // 3. Calculate subtotal and validate items
      let calculatedSubtotal = 0;
      const validatedItems = [];

      for (const item of body.items) {
        const variations = productVariationsMap.get(item.productId);
        if (!variations) return res.status(400).json({ success: false, error: `Produto ${item.productId} não existe` });
        
        const dbPrice = variations.get(item.variationId);
        if (dbPrice === undefined) return res.status(400).json({ success: false, error: `Variação ${item.variationId} não existe` });

        calculatedSubtotal += dbPrice * item.quantity;
        validatedItems.push({ ...item, price: dbPrice });
      }

      // 4. Coupon Validation
      let calculatedDiscount = 0;
      let validatedCouponCode = null;

      if (body.couponCode) {
        const { data: coupon, error: couponError } = await supabase
          .from("coupons")
          .select("*")
          .eq("code", body.couponCode.toUpperCase())
          .eq("is_active", true)
          .single();

        if (!couponError && coupon) {
          const now = new Date();
          let isEligible = true;

          if (coupon.valid_from && new Date(coupon.valid_from) > now) isEligible = false;
          if (coupon.valid_until && new Date(coupon.valid_until) < now) isEligible = false;
          if (coupon.max_uses && (coupon.current_uses || 0) >= coupon.max_uses) isEligible = false;
          if (coupon.min_purchase && calculatedSubtotal < coupon.min_purchase) isEligible = false;

          if (isEligible) {
            if (coupon.discount_type === "percentage") {
              calculatedDiscount = calculatedSubtotal * (coupon.discount_value / 100);
            } else {
              calculatedDiscount = Math.min(coupon.discount_value, calculatedSubtotal);
            }
            validatedCouponCode = coupon.code;
            
            // Increment usage
            await supabase
              .from("coupons")
              .update({ current_uses: (coupon.current_uses || 0) + 1 })
              .eq("id", coupon.id);
          } else {
            console.warn("Coupon applied but ineligible or expired:", body.couponCode);
            // Optionally we could return 400 here, but the Edge Function logic was specific
          }
        }
      }

      // 5. Price mismatch check
      const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
      if (Math.abs(calculatedTotal - body.totalAmount) > 0.1) {
        console.error("Price mismatch:", { server: calculatedTotal, client: body.totalAmount });
        return res.status(400).json({ 
          success: false, 
          error: "Divergência de preço detectada. Por favor, revise seu carrinho.",
          expected: calculatedTotal,
          received: body.totalAmount
        });
      }

      // 6. Stock Check
      for (const item of validatedItems) {
        const { data: availableKeys } = await supabase
          .from("product_keys")
          .select("id")
          .eq("product_id", item.productId)
          .eq("variation_id", item.variationId)
          .eq("status", "available");
        
        if (!availableKeys || availableKeys.length < item.quantity) {
          return res.status(400).json({ 
            success: false, 
            error: `Estoque insuficiente para ${item.productName} - ${item.variationName}`,
            stockError: true 
          });
        }
      }

      // 7. Create Order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          email: body.email,
          customer_name: body.customerName,
          phone: body.phone,
          status: "pending",
          payment_method: body.paymentMethod,
          payment_id: body.paymentId,
          order_nsu: body.orderNsu || `ORDER-${Date.now()}`,
          total_amount: calculatedTotal,
          discount_amount: calculatedDiscount,
          coupon_code: validatedCouponCode,
          user_id: body.userId
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 8. Create Order Items
      const orderItems = validatedItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        variation_id: item.variationId,
        variation_name: item.variationName,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        throw itemsError;
      }

      console.log("Order created successfully:", order.id);
      return res.status(200).json({ 
        success: true, 
        order: {
          id: order.id,
          orderNsu: order.order_nsu,
          status: order.status,
          totalAmount: order.total_amount
        }
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Internal Server Error in create-order:", error);
      return res.status(500).json({ 
        success: false, 
        error: "Erro interno ao processar o pedido", 
        details: errorMessage 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit SPA fallback for dev mode
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        if (!url.includes('.')) {
          const template = await vite.transformIndexHtml(url, `<!DOCTYPE html><html><head></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
          return;
        }
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
      next();
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA fallback: serve index.html for all non-file routes
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
