import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-event, x-webhook-source',
};

async function deliverKeysForOrder(supabase: any, orderId: string) {
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
  if (!items?.length) return 0;

  let delivered = 0;
  for (const item of items) {
    const { data: keys } = await supabase
      .from('product_keys')
      .select('*')
      .eq('product_id', item.product_id)
      .eq('variation_id', item.variation_id)
      .eq('status', 'available')
      .limit(item.quantity);

    if (!keys?.length) continue;

    for (const key of keys) {
      const { error: u } = await supabase.from('product_keys')
        .update({ status: 'sold', sold_at: new Date().toISOString() })
        .eq('id', key.id);
      if (u) continue;

      const { error: d } = await supabase.from('delivered_keys').insert({
        order_id: orderId,
        order_item_id: item.id,
        product_key_id: key.id,
        key_value: key.key_value,
      });
      if (!d) delivered++;
    }
  }
  return delivered;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const source = req.headers.get('x-webhook-source');
    const event = req.headers.get('x-webhook-event') || '';
    console.log('BlackCat webhook:', event, 'source:', source);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const payload = await req.json();
    console.log('Payload:', JSON.stringify(payload));

    const status = payload.status;
    const transactionId = payload.transactionId;
    const externalRef = payload.externalReference || payload.externalRef;

    if (!transactionId) {
      return new Response(JSON.stringify({ success: false, error: 'Sem transactionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Find order by payment_id or order_nsu
    let { data: order } = await supabase.from('orders').select('*').eq('payment_id', transactionId).maybeSingle();
    if (!order && externalRef) {
      const r = await supabase.from('orders').select('*').eq('order_nsu', externalRef).maybeSingle();
      order = r.data;
    }

    if (!order) {
      console.error('Order not found for', transactionId, externalRef);
      return new Response(JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (status === 'PAID' || event === 'transaction.paid') {
      if (order.status === 'paid' || order.status === 'delivered') {
        return new Response(JSON.stringify({ success: true, message: 'Já processado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate amount
      const orderCents = Math.round(order.total_amount * 100);
      if (payload.amount && Math.abs(orderCents - payload.amount) > 1) {
        console.error('Amount mismatch', orderCents, payload.amount);
        return new Response(JSON.stringify({ success: false, error: 'Valor divergente' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      await supabase.from('orders').update({
        status: 'paid',
        payment_id: transactionId,
        paid_at: new Date().toISOString(),
      }).eq('id', order.id);

      const delivered = await deliverKeysForOrder(supabase, order.id);
      if (delivered > 0) {
        await supabase.from('orders').update({ status: 'delivered' }).eq('id', order.id);
      }

      return new Response(JSON.stringify({ success: true, delivered }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (status === 'CANCELLED' || status === 'FAILED' || event === 'transaction.failed') {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      return new Response(JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, ignored: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('blackcat-webhook error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
