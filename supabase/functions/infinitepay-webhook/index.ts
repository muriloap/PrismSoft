import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =======================================================
// INFINITEPAY IP ALLOWLIST (Production IPs)
// Reference: InfinitePay webhook documentation
// =======================================================
const INFINITEPAY_ALLOWED_IPS = [
  // InfinitePay production webhook IPs - update as needed
  '18.230.0.0/16',     // AWS São Paulo region (InfinitePay infrastructure)
  '52.67.0.0/16',      // AWS São Paulo region
  '54.232.0.0/16',     // AWS São Paulo region
  '177.71.128.0/17',   // CloudFlare Brazil
];

// Check if IP is in CIDR range
function ipInCIDR(ip: string, cidr: string): boolean {
  const [range, bits = '32'] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  
  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);
  
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
  
  return (ipNum & mask) === (rangeNum & mask);
}

function isAllowedIP(ip: string): boolean {
  // In development/testing, allow all
  const allowAllIPs = Deno.env.get('ALLOW_ALL_WEBHOOK_IPS') === 'true';
  if (allowAllIPs) {
    console.log('IP allowlist disabled for testing');
    return true;
  }
  
  for (const cidr of INFINITEPAY_ALLOWED_IPS) {
    if (ipInCIDR(ip, cidr)) {
      return true;
    }
  }
  return false;
}

// =======================================================
// INPUT VALIDATION SCHEMA
// =======================================================

const WebhookItemSchema = z.object({
  quantity: z.number().int().positive(),
  price: z.number().positive(),
  description: z.string().max(500),
});

const WebhookPayloadSchema = z.object({
  invoice_slug: z.string().max(200).optional(),
  amount: z.number().optional(),
  paid_amount: z.number().positive({ message: "Valor do pagamento inválido" }),
  installments: z.number().int().positive().max(24).optional(),
  capture_method: z.enum(['credit_card', 'pix']).optional(),
  transaction_nsu: z.string().min(1).max(100, { message: "NSU da transação inválido" }),
  order_nsu: z.string().min(1).max(100, { message: "NSU do pedido inválido" }),
  receipt_url: z.string().url().max(500).optional(),
  items: z.array(WebhookItemSchema).optional(),
});

// Rate limiting storage (in-memory, resets on function restart)
const webhookAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 attempts per order_nsu per minute

function checkRateLimit(orderNsu: string): boolean {
  const now = Date.now();
  const attempts = webhookAttempts.get(orderNsu);
  
  if (!attempts || (now - attempts.firstAttempt > RATE_LIMIT_WINDOW)) {
    webhookAttempts.set(orderNsu, { count: 1, firstAttempt: now });
    return true;
  }
  
  if (attempts.count >= RATE_LIMIT_MAX) {
    console.warn(`Rate limit exceeded for order_nsu: ${orderNsu}`);
    return false;
  }
  
  attempts.count++;
  return true;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('InfinitePay webhook received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // =======================================================
    // SECURITY: IP Allowlist Validation
    // =======================================================
    
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    
    console.log(`Webhook request from IP: ${clientIP}`);
    
    if (!isAllowedIP(clientIP)) {
      console.error(`Blocked webhook from unauthorized IP: ${clientIP}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Acesso não autorizado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================
    // INPUT VALIDATION WITH ZOD
    // =======================================================
    
    let rawPayload: unknown;
    try {
      rawPayload = await req.json();
    } catch {
      console.error('Invalid JSON in webhook payload');
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Raw webhook payload received');

    const parseResult = WebhookPayloadSchema.safeParse(rawPayload);
    
    if (!parseResult.success) {
      console.error('Webhook validation error:', parseResult.error.issues);
      const firstError = parseResult.error.issues[0]?.message || 'Payload inválido';
      return new Response(
        JSON.stringify({ success: false, error: firstError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================
    // SECURITY: Rate Limiting
    // =======================================================
    
    const payload = parseResult.data;
    
    if (!checkRateLimit(payload.order_nsu)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Payment confirmed for order ${payload.order_nsu}`);
    console.log(`Amount: ${payload.paid_amount / 100} BRL`);
    console.log(`Transaction NSU: ${payload.transaction_nsu}`);

    // Find the order by order_nsu
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_nsu', payload.order_nsu)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', payload.order_nsu, orderError);
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order found:', order.id);

    // =======================================================
    // SECURITY: Validate payment amount matches order
    // =======================================================
    
    const orderTotalInCents = Math.round(order.total_amount * 100);
    const paidAmountDifference = Math.abs(orderTotalInCents - payload.paid_amount);
    
    // Allow 1 cent difference for rounding
    if (paidAmountDifference > 1) {
      console.error('Payment amount mismatch!', {
        orderTotal: orderTotalInCents,
        paidAmount: payload.paid_amount,
        difference: paidAmountDifference
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Valor do pagamento não corresponde ao pedido' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================
    // SECURITY: Check if order was already processed
    // =======================================================
    
    if (order.status === 'paid' || order.status === 'delivered') {
      console.log('Order already processed:', order.id, order.status);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Pedido já foi processado anteriormente',
          orderId: order.id,
          status: order.status
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update order status to paid
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        transaction_nsu: payload.transaction_nsu,
        receipt_url: payload.receipt_url || null,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order:', updateError);
    }

    // Deliver keys automatically
    console.log('Delivering keys for order:', order.id);

    // Get order items
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError || !orderItems || orderItems.length === 0) {
      console.error('Order items not found:', itemsError);
      return new Response(
        JSON.stringify({ success: true, message: 'Order updated, no items to deliver' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let deliveredCount = 0;

    // Process each order item
    for (const item of orderItems) {
      console.log(`Processing item: ${item.product_name} - ${item.variation_name}, qty: ${item.quantity}`);
      
      // Get available keys for this product/variation
      const { data: availableKeys, error: keysError } = await supabase
        .from('product_keys')
        .select('*')
        .eq('product_id', item.product_id)
        .eq('variation_id', item.variation_id)
        .eq('status', 'available')
        .limit(item.quantity);

      if (keysError) {
        console.error('Error fetching keys:', keysError);
        continue;
      }

      if (!availableKeys || availableKeys.length === 0) {
        console.warn(`No keys available for ${item.product_name}`);
        continue;
      }

      for (const key of availableKeys) {
        // Mark key as sold
        const { error: updateKeyError } = await supabase
          .from('product_keys')
          .update({
            status: 'sold',
            sold_to: order.user_id || null,
            sold_at: new Date().toISOString()
          })
          .eq('id', key.id);

        if (updateKeyError) {
          console.error('Error updating key status:', updateKeyError);
          continue;
        }

        // Create delivered key record
        const { error: deliverError } = await supabase
          .from('delivered_keys')
          .insert({
            order_id: order.id,
            order_item_id: item.id,
            product_key_id: key.id,
            key_value: key.key_value
          });

        if (deliverError) {
          console.error('Error creating delivery record:', deliverError);
          continue;
        }

        deliveredCount++;
      }
    }

    // Update order status to delivered if keys were delivered
    if (deliveredCount > 0) {
      await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', order.id);
    }

    console.log(`Delivered ${deliveredCount} keys for order ${order.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Webhook processed, ${deliveredCount} keys delivered`,
        orderId: order.id,
        deliveredCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in infinitepay-webhook function:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
