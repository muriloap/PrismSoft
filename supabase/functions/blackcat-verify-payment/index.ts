import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  // Explicitly handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
    if (!apiKey) {
      console.error('BLACKCAT_API_KEY not configured');
      return new Response(JSON.stringify({ success: false, error: 'Configuração da API pendente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    let body;
    try {
      body = await req.json();
    } catch(e) {
      console.error('Json parse error:', e);
      return new Response(JSON.stringify({ success: false, error: 'Payload inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { chargeId, orderId, orderNsu } = body;
    if (!chargeId) {
      return new Response(JSON.stringify({ success: false, error: 'ChargeId obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Checking charge: ${chargeId} (Order: ${orderId})`);
    
    const resp = await fetch(`${BLACKCAT_API_URL}/sales/get-sale/${chargeId}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
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
