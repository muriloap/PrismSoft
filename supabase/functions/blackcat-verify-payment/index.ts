import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Gateway não configurado (API Key)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    let body;
    try {
      body = await req.json();
    } catch(e) {
      return new Response(JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { chargeId, orderId, orderNsu } = body;

    if (!chargeId) {
      return new Response(JSON.stringify({ success: false, error: 'ID da transação não informado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Verificando status do pagamento ${chargeId} para pedido ${orderId} (NSU: ${orderNsu})`);
    
    const resp = await fetch(`${BLACKCAT_API_URL}/sales/get-sale/${chargeId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
      },
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      return new Response(JSON.stringify({ success: false, error: data.message || 'Erro ao consultar gateway' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const status = (data.data?.status || '').toLowerCase();
    const isPaid = status === 'paid' || status === 'confirmed';
    const isExpired = status === 'expired' || status === 'canceled';

    if (isPaid && orderId) {
      // 1. Atualiza status para pago
      await supabase.from('orders').update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      }).eq('id', orderId);

      // 2. Tenta entregar chaves se NSU disponível
      if (orderNsu) {
        try {
          console.log(`Chamando entrega automática para pedido ${orderId}...`);
          await fetch(`${supabaseUrl}/functions/v1/auto-deliver-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ orderId, orderNsu }),
          });
        } catch (deliveryErr) {
          console.error("Erro ao solicitar entrega automática:", deliveryErr);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      payment: { 
        status, 
        isPaid, 
        isExpired,
        amount: data.data?.amount,
        customerEmail: data.data?.customer?.email
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('ERRO EM verify-payment:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro de processamento interno', details: e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
