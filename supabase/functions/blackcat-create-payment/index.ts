import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLACKCAT_API_URL = 'https://api.blackcatpay.com.br/api';
const MIN_PAYMENT_VALUE = 1.00;

const RequestSchema = z.object({
  value: z.number().positive().max(999999),
  description: z.string().max(500).optional(),
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(255),
  customerPhone: z.string().min(8).max(20),
  customerDocument: z.string().min(11).max(14).optional(),
  expiresIn: z.number().int().positive().max(86400).optional(),
  orderId: z.string().uuid().optional(),
  orderNsu: z.string().max(100).optional(),
  items: z.array(z.object({
    title: z.string().max(200),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })).min(1),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('BLACKCAT_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let raw: unknown;
    try { raw = await req.json(); } catch {
      return new Response(JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ success: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = parsed.data;

    if (body.value < MIN_PAYMENT_VALUE) {
      return new Response(JSON.stringify({
        success: false,
        error: `Valor mínimo para PIX é R$ ${MIN_PAYMENT_VALUE.toFixed(2)}`,
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const cleanPhone = body.customerPhone.replace(/\D/g, '');
    const cleanDoc = (body.customerDocument || '').replace(/\D/g, '') || '00000000000';
    const expiresInDays = Math.max(1, Math.ceil((body.expiresIn || 3600) / 86400));
    const amountCents = Math.round(body.value * 100);

    const projectId = Deno.env.get('SUPABASE_URL')!.split('//')[1].split('.')[0];
    const postbackUrl = `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`;

    const payload = {
      amount: amountCents,
      currency: 'BRL',
      paymentMethod: 'pix',
      items: body.items.map(i => ({
        title: i.title.substring(0, 200),
        unitPrice: Math.round(i.unitPrice * 100),
        quantity: i.quantity,
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
      pix: { expiresInDays },
      postbackUrl,
      externalRef: body.orderNsu || body.orderId || `ORD-${Date.now()}`,
      metadata: body.description || '',
    };

    console.log('Sending to BlackCat:', body.orderNsu);

    const resp = await fetch(`${BLACKCAT_API_URL}/sales/create-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();
    console.log('BlackCat status:', resp.status);

    if (!resp.ok || !data.success) {
      console.error('BlackCat error:', data);
      return new Response(JSON.stringify({ success: false, error: data.message || data.error || 'Erro ao criar pagamento' }),
        { status: resp.status || 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tx = data.data;
    const qrBase64: string | undefined = tx.paymentData?.qrCodeBase64;
    const emv: string = tx.paymentData?.qrCode || tx.paymentData?.copyPaste || '';
    // BlackCat sometimes returns the EMV text in qrCodeBase64 instead of a real PNG.
    // Detect a valid base64 image; otherwise generate a QR image from the EMV payload.
    const looksLikeBase64Png = !!qrBase64 && /^[A-Za-z0-9+/=\s]+$/.test(qrBase64) && qrBase64.length > 200;
    const qrImage = qrBase64 && qrBase64.startsWith('data:')
      ? qrBase64
      : looksLikeBase64Png
        ? `data:image/png;base64,${qrBase64}`
        : (emv ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(emv)}` : '');

    if (body.orderId) {
      await supabase.from('orders').update({ payment_id: tx.transactionId }).eq('id', body.orderId);
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: tx.transactionId,
        value: body.value,
        status: tx.status,
        pixCode: tx.paymentData?.copyPaste || tx.paymentData?.qrCode || '',
        qrCodeImage: qrImage,
        qrCodeEmv: tx.paymentData?.qrCode || '',
        publicPaymentUrl: tx.invoiceUrl,
        expiresIn: (body.expiresIn || 3600),
        expiresDate: tx.paymentData?.expiresAt || new Date(Date.now() + (body.expiresIn || 3600) * 1000).toISOString(),
      },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    console.error('blackcat-create-payment error:', e);
    return new Response(JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
