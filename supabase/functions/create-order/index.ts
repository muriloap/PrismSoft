import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Environment variables missing');
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do servidor incompleta (Env vars)' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header if present
    const authHeader = req.headers.get('Authorization');
    let authedUserId: string | null = null;
    if (authHeader) {
      try {
        const { data: { user: authedUser } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        authedUserId = authedUser?.id || null;
      } catch (e) {
        console.warn('Could not verify auth token:', e);
      }
    }

    // =======================================================
    // INPUT VALIDATION WITH ZOD
    // =======================================================
    
    let rawBody: unknown;
    try {
      rawBody = await req.json();
      console.log('--- RECEIVED BODY ---');
      console.log(JSON.stringify(rawBody, null, 2));
      console.log('----------------------');
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = CreateOrderSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      const fieldErrors = parseResult.error.flatten().fieldErrors;
      console.error('--- ZOD VALIDATION ERROR ---');
      console.error(JSON.stringify(fieldErrors, null, 2));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados do pedido inválidos (Zod)',
          validationErrors: fieldErrors,
          received: rawBody
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Validated request for:', body.email);

    // Identity safety: If userId is provided, it MUST match the authed user (if authed)
    if (body.userId && authedUserId && body.userId !== authedUserId) {
      console.error('User ID mismatch! Body:', body.userId, 'Auth:', authedUserId);
      return new Response(
        JSON.stringify({ success: false, error: 'Inconsistência de identidade do usuário.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================
    // SERVER-SIDE PRICE VALIDATION
    // =======================================================
    
    const productIds = [...new Set(body.items.map(i => i.productId))];
    console.log('Fetching products:', productIds);

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, variations, name')
      .in('id', productIds);

    if (productsError) {
      console.error('Error fetching products from DB:', productsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao validar produtos no banco de dados', details: productsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!products || products.length === 0) {
      console.error('No products found in DB for IDs:', productIds);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Nenhum dos produtos solicitados foi encontrado no catálogo.',
          productIdsSearched: productIds 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a map of product variations for quick lookup
    const productVariationsMap = new Map<string, Map<string, number>>();
    for (const product of products || []) {
      const variationsMap = new Map<string, number>();
      const variations = product.variations as ProductVariation[];
      if (Array.isArray(variations)) {
        for (const variation of variations) {
          variationsMap.set(variation.id, variation.price);
        }
      }
      productVariationsMap.set(product.id, variationsMap);
    }

    // Calculate server-side subtotal and validate each item price
    let calculatedSubtotal = 0;
    const validatedItems: Array<{
      productId: string;
      productName: string;
      productImage?: string;
      variationId: string;
      variationName: string;
      price: number;
      quantity: number;
    }> = [];

    for (const item of body.items) {
      const productVariations = productVariationsMap.get(item.productId);
      
      if (!productVariations) {
        console.error('Product not found:', item.productId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Produto "${item.productName}" não encontrado` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const databasePrice = productVariations.get(item.variationId);
      
      if (databasePrice === undefined) {
        console.error('Variation not found:', item.variationId);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Variação "${item.variationName}" não encontrada` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use DATABASE price, not client-provided price
      calculatedSubtotal += databasePrice * item.quantity;
      
      // Store validated item with database price
      validatedItems.push({
        ...item,
        price: databasePrice // Override with database price
      });
    }

    console.log('Calculated subtotal from database:', calculatedSubtotal);

    // =======================================================
    // SERVER-SIDE COUPON VALIDATION
    // =======================================================
    
    let calculatedDiscount = 0;
    let validatedCouponCode: string | null = null;

    if (body.couponCode) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', body.couponCode.toUpperCase())
        .eq('is_active', true)
        .single();

      if (couponError || !coupon) {
        console.error('Invalid coupon:', body.couponCode);
        return new Response(
          JSON.stringify({ success: false, error: 'Cupom inválido ou expirado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const now = new Date();

      // Validate coupon role restriction
      if (coupon.restricted_to_role) {
        if (!body.userId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Faça login para usar este cupom' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', body.userId)
          .eq('role', coupon.restricted_to_role)
          .single();

        if (!userRole) {
          const roleNames: Record<string, string> = {
            'admin': 'administradores',
            'reseller': 'revendedores',
            'user': 'usuários'
          };
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Este cupom é exclusivo para ${roleNames[coupon.restricted_to_role] || coupon.restricted_to_role}` 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Validate coupon dates
      if (coupon.valid_from && new Date(coupon.valid_from) > now) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cupom ainda não está válido' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (coupon.valid_until && new Date(coupon.valid_until) < now) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cupom expirado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check usage limit
      if (coupon.max_uses && (coupon.current_uses || 0) >= coupon.max_uses) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de uso do cupom atingido' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check minimum purchase
      if (coupon.min_purchase && calculatedSubtotal < coupon.min_purchase) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Compra mínima de R$ ${coupon.min_purchase.toFixed(2)} necessária` 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate discount based on type
      if (coupon.discount_type === 'percentage') {
        calculatedDiscount = calculatedSubtotal * (coupon.discount_value / 100);
      } else {
        calculatedDiscount = Math.min(coupon.discount_value, calculatedSubtotal);
      }

      validatedCouponCode = coupon.code;

      // Increment coupon usage
      await supabase
        .from('coupons')
        .update({ current_uses: (coupon.current_uses || 0) + 1 })
        .eq('id', coupon.id);

      console.log('Coupon validated:', coupon.code, 'Discount:', calculatedDiscount);
    }

    // Calculate final total using server-side values
    const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount);
    
    console.log('Server calculated total:', calculatedTotal);
    console.log('Client provided total:', body.totalAmount);

    // Verify client calculation matches server (allow small floating point differences)
    const priceDifference = Math.abs(calculatedTotal - body.totalAmount);
    if (priceDifference > 0.05) { // Increased tolerance to 0.05
      console.error('Price mismatch detected! Server:', calculatedTotal, 'Client:', body.totalAmount);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro de validação de preço. Servidor espera ${calculatedTotal.toFixed(2)}, mas o cliente enviou ${body.totalAmount.toFixed(2)}.`,
          expectedTotal: calculatedTotal,
          receivedTotal: body.totalAmount,
          subtotal: calculatedSubtotal,
          discount: calculatedDiscount
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================
    // CHECK STOCK AVAILABILITY
    // =======================================================
    
    for (const item of validatedItems) {
      const { data: availableKeys, error } = await supabase
        .from('product_keys')
        .select('id')
        .eq('product_id', item.productId)
        .eq('variation_id', item.variationId)
        .eq('status', 'available');

      if (error) {
        console.error('Error checking stock:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao verificar estoque' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const availableCount = availableKeys?.length || 0;
      if (availableCount < item.quantity) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Estoque insuficiente para ${item.productName} - ${item.variationName}. Disponível: ${availableCount}`,
            stockError: true,
            productId: item.productId,
            variationId: item.variationId,
            available: availableCount,
            requested: item.quantity
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =======================================================
    // CREATE ORDER WITH SERVER-VALIDATED VALUES
    // =======================================================
    
    const orderData = {
      email: body.email,
      customer_name: body.customerName || null,
      phone: body.phone || null,
      status: 'pending',
      payment_method: body.paymentMethod,
      payment_id: body.paymentId || null,
      order_nsu: body.orderNsu || `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      total_amount: calculatedTotal, // Use SERVER-CALCULATED total
      discount_amount: calculatedDiscount, // Use SERVER-CALCULATED discount
      coupon_code: validatedCouponCode,
      user_id: body.userId || null,
    };

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar pedido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order created:', order.id);

    // Create order items with validated prices
    const orderItems = validatedItems.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      variation_id: item.variationId,
      variation_name: item.variationName,
      quantity: item.quantity,
      price: item.price, // This is now the DATABASE price
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar itens do pedido' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order items created');

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: {
          id: order.id,
          orderNsu: order.order_nsu,
          status: order.status,
          totalAmount: order.total_amount,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in create-order function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
