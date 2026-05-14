import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  console.log('--- CHAMADA RECEBIDA EM blackcat-create-payment ---');
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) {
      throw new Error('BLACKCAT_API_KEY não configurada');
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    const body = await req.json();
    console.log('Corpo da requisição recebido');

    // Validação simplificada (Zod pode estar causando lentidão ou erro de import)
    const { value, customerName, customerEmail, customerPhone, items, orderId, orderNsu } = body;

    if (!value || !customerEmail || !items) {
      throw new Error('Dados obrigatórios ausentes (value, email ou items)');
    }

    const cleanPhone = String(customerPhone || '').replace(/\D/g, '') || '11999999999';
    const cleanDoc = '00000000000';
    
    const projectId = supabaseUrl!.split('//')[1].split('.')[0];
    const postbackUrl = `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`;

    const payload = {
      amount: Math.round(value * 100),
      currency: 'BRL',
      paymentMethod: 'pix',
      items: items.map((i: any) => ({
        title: (i.title || i.productName || 'Produto').substring(0, 100),
        unitPrice: Math.round((i.unitPrice || i.price || 0) * 100),
        quantity: i.quantity || 1,
        tangible: false,
      })),
      customer: {
        name: String(customerName || 'Cliente').substring(0, 100),
        email: customerEmail,
        phone: cleanPhone,
        document: {
          number: cleanDoc,
          type: 'cpf',
        },
      },
      pix: { expiresInDays: 1 },
      postbackUrl,
      externalRef: orderNsu || orderId || `ORD-${Date.now()}`,
      metadata: body.description || '',
    };

    console.log('Efetuando fetch para BlackCat API...');
    const bcResp = await fetch(`${BLACKCAT_API_URL}/sales/create-sale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const bcData = await bcResp.json();
    console.log('Resposta da BlackCat recebida');

    if (!bcResp.ok || !bcData.success) {
      console.error('Erro na API BlackCat:', bcData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gateway recusou o pedido', 
          details: bcData.message || bcData.error || 'Erro desconhecido' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tx = bcData.data;
    if (orderId && tx.transactionId) {
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
          qrCodeImage: tx.paymentData?.qrCodeBase64 ? `data:image/png;base64,${tx.paymentData.qrCodeBase64}` : (tx.paymentData?.copyPaste ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tx.paymentData.copyPaste)}` : ''),
          expiresDate: new Date(Date.now() + 86400000).toISOString(),
          publicPaymentUrl: tx.invoiceUrl,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('ERRO FATAL EM blackcat-create-payment:', err.message);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro de processamento', details: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
