import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  'Access-Control-Expose-Headers': '*',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log('--- CHAMADA EM blackcat-create-payment ---');

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!apiKey) {
      console.error('ERRO: BLACKCAT_API_KEY não configurada no ambiente');
      return new Response(
        JSON.stringify({ success: false, error: 'Gateway não configurado no env' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error('ERRO: Não foi possível ler o JSON do request:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido no request' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { value, customerName, customerEmail, customerPhone, items, orderId, orderNsu } = body;
    console.log(`Processando pedido: ${orderNsu || orderId} - Valor: ${value}`);

    if (!value || !customerEmail || !items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados obrigatórios ausentes (valor, email ou itens)' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanPhone = String(customerPhone || '').replace(/\D/g, '') || '11999999999';
    const cleanDoc = '00000000000'; // Placeholder
    
    const projectId = supabaseUrl!.split('//')[1].split('.')[0];
    const postbackUrl = `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`;

    const blackcatPayload = {
      amount: Math.round(Number(value) * 100),
      currency: 'BRL',
      paymentMethod: 'pix',
      items: items.map((i: any) => ({
        title: String(i.title || i.productName || 'Produto').substring(0, 100),
        unitPrice: Math.round((Number(i.unitPrice || i.price || 0)) * 100),
        quantity: Number(i.quantity || 1),
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
      externalRef: String(orderNsu || orderId || `ORD-${Date.now()}`),
      metadata: String(body.description || ''),
    };

    console.log('Enviando request para API BlackCat...');
    
    // Timeout de 10 segundos para a API externa
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const bcResp = await fetch(`${BLACKCAT_API_URL}/sales/create-sale`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(blackcatPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const bcData = await bcResp.json();
      console.log('Resposta BC recebida:', bcResp.status);

      if (!bcResp.ok || !bcData.success) {
        console.error('Erro na API BlackCat:', bcData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'O gateway de pagamento recusou o processamento', 
            details: bcData.message || bcData.error || 'Erro na comunicação externa' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tx = bcData.data;
      if (!tx || !tx.transactionId) {
        throw new Error('TransactionId não retornado pela API');
      }

      // Tenta atualizar o pedido no banco, mas não trava se falhar (pode ser problema de permissão no service role se mal configurado)
      try {
        if (orderId) {
          await supabase.from('orders').update({ payment_id: tx.transactionId }).eq('id', orderId);
        }
      } catch (dbErr) {
        console.warn('Alerta: Não foi possível atualizar o payment_id no banco:', dbErr);
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

    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('Tempo limite excedido ao comunicar com o gateway');
      }
      throw fetchErr;
    }

  } catch (err: any) {
    console.error('ERRO CRÍTICO:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno no servidor de pagamento', details: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
