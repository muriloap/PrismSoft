import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Gateway não configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const { chargeId, orderId } = await req.json();

    if (!chargeId) {
      return new Response(JSON.stringify({ success: false, error: 'ID da transação ausente' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Verificando pagamento ${chargeId}...`);
    const resp = await fetch(`${BLACKCAT_API_URL}/sales/get-sale/${chargeId}`, {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      return new Response(JSON.stringify({ success: false, error: data.message || 'Erro ao consultar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const status = data.data?.status;
    const isPaid = status === 'paid' || status === 'confirmed';
    const isExpired = status === 'expired' || status === 'canceled';

    if (isPaid && orderId) {
      await supabase.from('orders').update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      }).eq('id', orderId);
    }

    return new Response(JSON.stringify({
      success: true,
      payment: { status, isPaid, isExpired },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('blackcat-verify-payment error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno', details: e.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
