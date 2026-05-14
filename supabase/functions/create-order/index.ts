import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =======================================================
// INPUT VALIDATION SCHEMAS
// =======================================================

const CartItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  productImage: z.string().optional().nullable(),
  variationId: z.string(),
  variationName: z.string(),
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

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Configuração do servidor incompleta',
          details: 'Deno.env variables missing.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('--- INICIA PROCESSAMENTO (V2) ---');

    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação Schema
    const parseResult = CreateOrderSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados inválidos',
          validationErrors: parseResult.error.flatten().fieldErrors 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validatedBody = parseResult.data;
    
    // 1. Validar Produtos
    const productIds = [...new Set(validatedBody.items.map(i => i.productId))];
    const { data: dbProducts, error: pError } = await supabase
      .from('products')
      .select('id, variations')
      .in('id', productIds);

    if (pError || !dbProducts) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro no catálogo', details: pError?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Cálculo Total
    let subtotal = 0;
    const itemsToSave = [];
    
    for (const item of validatedBody.items) {
      const product = dbProducts.find(p => p.id === item.productId);
      const variations = product?.variations as any[];
      const variation = variations?.find(v => v.id === item.variationId);
      
      if (!variation) {
        return new Response(
          JSON.stringify({ success: false, error: `Variação ${item.variationName} não encontrada.` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const vPrice = Number(variation.price);
      subtotal += vPrice * item.quantity;
      itemsToSave.push({ ...item, price: vPrice });
    }

    // 3. Cupom
    let discount = 0;
    if (validatedBody.couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', validatedBody.couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
        
      if (coupon) {
        if (coupon.discount_type === 'percentage') {
          discount = subtotal * (coupon.discount_value / 100);
        } else {
          discount = Math.min(coupon.discount_value, subtotal);
        }
      }
    }

    const total = Math.max(0, subtotal - discount);
    const nsu = validatedBody.orderNsu || `ORD-${Date.now()}`.toUpperCase();

    // 4. Gravar Pedido
    const { data: order, error: oError } = await supabase
      .from('orders')
      .insert({
        email: validatedBody.email,
        customer_name: validatedBody.customerName || 'Cliente',
        phone: validatedBody.phone || '',
        status: 'pending',
        payment_method: validatedBody.paymentMethod,
        order_nsu: nsu,
        total_amount: Number(total.toFixed(2)),
        discount_amount: Number(discount.toFixed(2)),
        coupon_code: validatedBody.couponCode || '',
        user_id: (validatedBody.userId && validatedBody.userId.length > 20) ? validatedBody.userId : null
      })
      .select()
      .maybeSingle();

    if (oError || !order) {
      console.error('Insert error:', oError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao gravar pedido', details: oError?.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Gravar Itens
    const orderItems = itemsToSave.map(item => ({
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
      await supabase.from('orders').delete().eq('id', order.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro nos itens', details: iError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Resposta Final
    return new Response(
      JSON.stringify({ 
        success: true, 
        order,
        payment: {
          orderId: order.id,
          nsu: order.order_nsu,
          total: order.total_amount,
          pix: validatedBody.paymentMethod === 'pix' ? {
            qrcode: "00020126360014BR.GOV.BCB.PIX0114+551199999999952040000530398654041.005802BR5910PRISM SOFT6009SAO PAULO62070503***6304E2B1",
            copyPaste: "00020126360014BR.GOV.BCB.PIX0114+551199999999952040000530398654041.005802BR5910PRISM SOFT6009SAO PAULO62070503***6304E2B1"
          } : null
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('FATAL:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro fatal', details: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

