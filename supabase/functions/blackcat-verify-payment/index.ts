import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Gateway não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    let body;
    try {
      body = await req.json();
    } catch(e) {
      return new Response(JSON.stringify({ success: false, error: 'Payload inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { chargeId, orderId, orderNsu } = body;
    if (!chargeId) {
      return new Response(JSON.stringify({ success: false, error: 'ID da transação não informado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const resp = await fetch(`${BLACKCAT_API_URL}/sales/get-sale/${chargeId}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Erro ao consultar gateway' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await resp.json();
    if (!data.success) {
      return new Response(JSON.stringify({ success: false, error: data.message || 'Falha na resposta do gateway' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tx = data.data;
    const status = (tx?.status || '').toLowerCase();
    const isPaid = status === 'paid' || status === 'confirmed' || status === 'paid_at';
    const isExpired = status === 'expired' || status === 'canceled';

    if (isPaid && orderId) {
      await supabase.from('orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', orderId);

      if (orderNsu) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/auto-deliver-keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ orderId, orderNsu }),
          });
        } catch (err) {
          console.error("Auto-delivery trigger failed");
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      payment: { status, isPaid, isExpired },
      status: status, // for compatibility
      isPaid: isPaid,
      isExpired: isExpired
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: 'Erro interno', details: e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
