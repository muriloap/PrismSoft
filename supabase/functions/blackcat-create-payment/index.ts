import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';
const MIN_PAYMENT_VALUE = 1.00;

const RequestSchema = z.object({
  value: z.number(),
  description: z.string().optional(),
  customerName: z.string(),
  customerEmail: z.string().email(),
  customerPhone: z.string(),
  customerDocument: z.string().optional(),
  expiresIn: z.number().optional(),
  orderId: z.string().optional(),
  orderNsu: z.string().optional(),
  items: z.array(z.any()).min(1),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('--- BLACKCAT PAYMENT PROCESS START ---');

    if (!apiKey) {
      console.error('CRITICAL: BLACKCAT_API_KEY is not set');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Gateway de pagamento não configurado',
          details: 'A variável de ambiente BLACKCAT_API_KEY não foi encontrada.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Erro de ambiente Supabase' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let raw: any;
    try { 
      raw = await req.json(); 
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido', details: e.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados de pagamento inválidos', 
          validationErrors: parsed.error.flatten().fieldErrors 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parsed.data;

    // Sanitize parameters
    const cleanPhone = body.customerPhone.replace(/\D/g, '');
    const cleanDoc = (body.customerDocument || '').replace(/\D/g, '') || '00000000000';
    const amountCents = Math.round(body.value * 100);

    const projectId = supabaseUrl.split('//')[1].split('.')[0];
    const postbackUrl = `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`;

    const payload = {
      amount: amountCents,
      currency: 'BRL',
      paymentMethod: 'pix',
      items: body.items.map(i => ({
        title: (i.title || i.productName || 'Produto').substring(0, 200),
        unitPrice: Math.round((i.unitPrice || i.price || 0) * 100),
        quantity: i.quantity || 1,
        tangible: false,
      })),
      customer: {
        name: body.customerName,
        email: body.customerEmail,
        phone: cleanPhone,
        document: {
          number: cleanDoc,
          type: cleanDoc.length === 14 ? 'cnpj' : 'cpf',
        },
      },
      pix: { expiresInDays: 1 },
      postbackUrl,
      externalRef: body.orderNsu || body.orderId || `ORD-${Date.now()}`,
      metadata: body.description || '',
    };

    console.log('Requesting Pix from BlackCat...');

    const resp = await fetch(`${BLACKCAT_API_URL}/sales/create-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(payload),
    });

    const result = await resp.json();

    if (!resp.ok || !result.success) {
      console.error('BlackCat API Error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'O gateway recusou o pagamento', 
          details: result.message || result.error || 'Erro desconhecido na BlackCat' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tx = result.data;
    
    // Auto-update order if ID is present
    if (body.orderId && tx.transactionId) {
      await supabase.from('orders').update({ payment_id: tx.transactionId }).eq('id', body.orderId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment: {
          id: tx.transactionId,
          value: body.value,
          status: 'pending',
          pixCode: tx.paymentData?.copyPaste || tx.paymentData?.qrCode || '',
          qrCodeImage: tx.paymentData?.qrCodeBase64 ? `data:image/png;base64,${tx.paymentData.qrCodeBase64}` : (tx.paymentData?.copyPaste ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(tx.paymentData.copyPaste)}` : ''),
          expiresDate: new Date(Date.now() + (24 * 3600 * 1000)).toISOString(), // Default 24h
          publicPaymentUrl: tx.invoiceUrl,
        },
      }), 
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('FATAL BLACKCAT FUNCTION ERROR:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro de conexão com o gateway', details: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

