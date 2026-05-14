import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[HTTP] ${req.method} request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();

    if (!apiKey) {
      console.error('Config Error: BLACKCAT_API_KEY is missing');
      return new Response(
        JSON.stringify({ success: false, error: 'Gateway não configurado no Supabase' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const body = await req.json();

    const { value, customerName, customerEmail, customerPhone, items, orderId, orderNsu } = body;

    if (!value || !customerEmail || !items) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados obrigatórios ausentes' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const projectId = supabaseUrl!.split('//')[1].split('.')[0];
    const postbackUrl = `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`;

    const payload = {
      amount: Math.round(Number(value) * 100),
      currency: 'BRL',
      paymentMethod: 'pix',
      items: items.map((i: any) => ({
        title: String(i.title || i.productName || 'Produto').substring(0, 100),
        unitPrice: Math.round(Number(i.unitPrice || i.price || 0) * 100),
        quantity: Number(i.quantity || 1),
        tangible: false,
      })),
      customer: {
        name: String(customerName || 'Cliente').substring(0, 100),
        email: customerEmail,
        phone: String(customerPhone || '11999999999').replace(/\D/g, ''),
        document: {
          number: '00000000000',
          type: 'cpf',
        },
      },
      pix: { expiresInDays: 1 },
      postbackUrl,
      externalRef: String(orderNsu || orderId || `ORD-${Date.now()}`),
      metadata: String(body.description || ''),
    };

    console.log(`[BlackCat] Creating sale for ${customerEmail}`);

    const bcResp = await fetch(`${BLACKCAT_API_URL}/sales/create-sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const bcData = await bcResp.json();

    if (!bcData.success) {
      console.error('[BlackCat] API Rejection:', bcData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'O gateway recusou a transação', 
          details: bcData.message || bcData.error 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tx = bcData.data;
    if (orderId && tx?.transactionId) {
      await supabase.from('orders').update({ payment_id: tx.transactionId }).eq('id', orderId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        payment: {
          id: tx.transactionId,
          value: value,
          status: 'pending',
          pixCode: tx.paymentData?.copyPaste || tx.paymentData?.qrCode || '',
          qrCodeImage: tx.paymentData?.qrCodeBase64 ? `data:image/png;base64,${tx.paymentData.qrCodeBase64}` : '',
          expiresDate: new Date(Date.now() + 86400000).toISOString(),
          publicPaymentUrl: tx.invoiceUrl,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[Fatal] Edge Function Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro de processamento PIX', details: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
