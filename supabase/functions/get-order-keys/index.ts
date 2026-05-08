import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =======================================================
// INPUT VALIDATION SCHEMA
// =======================================================

const GetOrderKeysSchema = z.object({
  orderId: z.string().uuid({ message: "ID do pedido inválido" }).optional(),
  orderNsu: z.string().max(100).optional(),
  email: z.string().email({ message: "Email inválido" }).max(255),
}).refine(data => data.orderId || data.orderNsu, {
  message: "orderId ou orderNsu é obrigatório",
});

const handler = async (req: Request): Promise<Response> => {
  console.log('Get order keys request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================
    // INPUT VALIDATION WITH ZOD
    // =======================================================
    
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = GetOrderKeysSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.issues);
      const firstError = parseResult.error.issues[0]?.message || 'Dados inválidos';
      return new Response(
        JSON.stringify({ success: false, error: firstError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Validated request for email: [REDACTED]');

    // Get order
    let orderQuery = supabase.from('orders').select('*');
    
    if (body.orderId) {
      orderQuery = orderQuery.eq('id', body.orderId);
    } else if (body.orderNsu) {
      orderQuery = orderQuery.eq('order_nsu', body.orderNsu);
    }

    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================
    // SECURITY: Verify email matches order
    // =======================================================
    
    if (order.email.toLowerCase() !== body.email.toLowerCase()) {
      console.warn('Email mismatch for order:', order.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Email não corresponde ao pedido' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get delivered keys
    const { data: deliveredKeys, error: keysError } = await supabase
      .from('delivered_keys')
      .select(`
        id,
        key_value,
        delivered_at,
        order_items (
          product_name,
          variation_name,
          price,
          quantity
        )
      `)
      .eq('order_id', order.id);

    if (keysError) {
      console.error('Error fetching delivered keys:', keysError);
    }

    // Get order items
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        order: {
          id: order.id,
          orderNsu: order.order_nsu,
          status: order.status,
          email: order.email,
          customerName: order.customer_name,
          totalAmount: order.total_amount,
          paymentMethod: order.payment_method,
          createdAt: order.created_at,
          paidAt: order.paid_at,
          receiptUrl: order.receipt_url,
        },
        items: orderItems || [],
        deliveredKeys: deliveredKeys?.map(k => ({
          id: k.id,
          keyValue: k.key_value,
          deliveredAt: k.delivered_at,
          productName: (k.order_items as any)?.product_name,
          variationName: (k.order_items as any)?.variation_name,
        })) || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in get-order-keys function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
