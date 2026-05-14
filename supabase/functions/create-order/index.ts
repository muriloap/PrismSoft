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

    console.log('--- INICIA PROCESSAMENTO DE PEDIDO (DEBUG MODE) ---');

    // Captura o corpo da requisição com segurança absoluta
    let rawBody: any;
    try {
      rawBody = await req.json();
      console.log('Payload recebido:', JSON.stringify(rawBody));
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo JSON inválido', details: e.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação com Zod
    const parseResult = CreateOrderSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados inválidos no checkout',
          validationErrors: parseResult.error.flatten().fieldErrors 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    
    // 1. Validar Produtos e Preços
    const productIds = [...new Set(body.items.map(i => i.productId))];
    const { data: dbProducts, error: pError } = await supabase
      .from('products')
      .select('id, variations, name')
      .in('id', productIds);

    if (pError) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao consultar catálogo', details: pError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Calcular Total (Lógica de Servidor para Segurança)
    let serverSubtotal = 0;
    const validatedItems = [];
    
    for (const item of body.items) {
      const dbProd = dbProducts?.find(p => p.id === item.productId);
      const variation = (dbProd?.variations as any[])?.find(v => v.id === item.variationId);
      
      if (!variation) {
        return new Response(
          JSON.stringify({ success: false, error: `Variação ${item.variationName} não encontrada no banco.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const itemPrice = Number(variation.price);
      serverSubtotal += itemPrice * item.quantity;
      validatedItems.push({ ...item, price: itemPrice });
    }

    // 3. Cupom (Opcional)
    let discount = 0;
    if (body.couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', body.couponCode.toUpperCase())
        .eq('is_active', true)
        .single();
        
      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          discount = serverSubtotal * (coupon.discount_value / 100);
        } else {
          discount = Math.min(coupon.discount_value, serverSubtotal);
        }
      }
    }

    const finalTotal = Math.max(0, serverSubtotal - discount);

    // 4. Inserir Pedido (AQUI GERALMENTE DAVA O ERRO 500)
    const nsu = body.orderNsu || `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`.toUpperCase();
    
    const { data: order, error: oError } = await supabase
      .from('orders')
      .insert({
        email: body.email,
        customer_name: body.customerName || 'Cliente',
        phone: body.phone || '',
        status: 'pending',
        payment_method: body.paymentMethod,
        order_nsu: nsu,
        total_amount: Number(finalTotal.toFixed(2)),
        discount_amount: Number(discount.toFixed(2)),
        coupon_code: body.couponCode || '',
        user_id: (body.userId && body.userId.length > 20) ? body.userId : null
      })
      .select()
      .single();

    if (oError) {
      console.error('Erro fatal no INSERT orders:', oError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Falha ao gravar pedido', 
          details: oError.message,
          hint: oError.hint,
          code: oError.code
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Inserir Itens
    const orderItems = validatedItems.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      variation_id: item.variationId,
      variation_name: item.variationName,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: iError } = await supabase.from('order_items').insert(orderItems);

    if (iError) {
      await supabase.from('orders').delete().eq('id', order.id); // Rollback
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gravar itens', details: iError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Preparar Resposta de Pagamento (CONFORME SUA PERGUNTA)
    // Aqui simulamos dados para o frontend saber o que fazer a seguir
    const paymentData: any = {
      orderId: order.id,
      nsu: order.order_nsu,
      total: order.total_amount,
    };

    if (body.paymentMethod === 'pix') {
      paymentData.pix = {
        qrcode: "00020126360014BR.GOV.BCB.PIX0114+551199999999952040000530398654041.005802BR5910PRISM SOFT6009SAO PAULO62070503***6304E2B1",
        copyPaste: "00020126360014BR.GOV.BCB.PIX0114+551199999999952040000530398654041.005802BR5910PRISM SOFT6009SAO PAULO62070503***6304E2B1",
        expiresAt: new Date(Date.now() + 30 * 60000).toISOString() // 30 min
      };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: order,
        payment: paymentData
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('ERRO GLOBAL NA FUNCTION:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Erro fatal não tratado no servidor',
        details: err.message,
        stack: err.stack
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
