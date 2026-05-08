import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLOW_API_URL = 'https://flowapplications.com.br';
const MIN_PAYMENT_VALUE = 1.00; // Minimum value for PIX payment (R$1.00)

// =======================================================
// INPUT VALIDATION SCHEMA
// =======================================================

const CreatePaymentSchema = z.object({
  value: z.number().positive({ message: "Valor deve ser positivo" }).max(999999, { message: "Valor máximo excedido" }),
  description: z.string().max(500, { message: "Descrição muito longa" }).optional(),
  customerName: z.string().max(200, { message: "Nome muito longo" }).optional(),
  customerEmail: z.string().email({ message: "Email inválido" }).max(255).optional(),
  customerPhone: z.string().max(20, { message: "Telefone muito longo" }).optional(),
  expiresIn: z.number().int().positive().max(86400, { message: "Tempo de expiração inválido" }).optional(), // Max 24 hours
  orderId: z.string().uuid({ message: "ID do pedido inválido" }).optional(),
  orderNsu: z.string().max(100).optional(),
});

interface FlowChargeResponse {
  success: boolean;
  charge?: {
    id: string;
    value: number;
    status: string;
    pixCode: string;
    qrCode: {
      emv: string;
      image: string;
    };
    globalID: string;
    transactionID: string | null;
    expiresIn: number;
    expiresDate: string;
    publicPaymentUrl?: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Create payment request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FLOW_API_KEY = Deno.env.get('FLOW_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!FLOW_API_KEY) {
      console.error('FLOW_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API Key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // =======================================================
    // INPUT VALIDATION WITH ZOD
    // =======================================================
    
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = CreatePaymentSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.issues);
      const firstError = parseResult.error.issues[0]?.message || 'Dados inválidos';
      return new Response(
        JSON.stringify({ success: false, error: firstError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Validated payment request, value:', body.value);

    // Check minimum payment value
    if (body.value < MIN_PAYMENT_VALUE) {
      console.log('Payment value too low:', body.value, '- minimum is', MIN_PAYMENT_VALUE);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Valor mínimo para pagamento via PIX é R$ ${MIN_PAYMENT_VALUE.toFixed(2)}`,
          isFreeOrder: body.value < 0.01
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare payment data
    const paymentData: Record<string, unknown> = {
      value: body.value,
    };

    if (body.description) {
      paymentData.description = body.description;
    }

    if (body.expiresIn) {
      paymentData.expiresIn = body.expiresIn;
    }

    if (body.customerName || body.customerEmail || body.customerPhone) {
      paymentData.customer = {
        name: body.customerName,
        email: body.customerEmail,
        phone: body.customerPhone,
      };
    }

    console.log('Sending request to Flow API');

    // Make request to Flow API
    const response = await fetch(`${FLOW_API_URL}/api/flow-api/charge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    const data: FlowChargeResponse = await response.json();
    console.log('Flow API response status:', response.status);

    if (!response.ok) {
      console.error('Flow API error:', data.error);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Erro ao criar pagamento' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.success && data.charge) {
      console.log('Payment created successfully:', data.charge.id);

      // Update order with payment_id if orderId is provided
      if (body.orderId) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ payment_id: data.charge.id })
          .eq('id', body.orderId);

        if (updateError) {
          console.error('Error updating order with payment_id:', updateError);
        } else {
          console.log('Order updated with payment_id:', data.charge.id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: data.charge.id,
            value: data.charge.value,
            status: data.charge.status,
            pixCode: data.charge.pixCode,
            qrCodeImage: data.charge.qrCode.image,
            qrCodeEmv: data.charge.qrCode.emv,
            publicPaymentUrl: data.charge.publicPaymentUrl,
            expiresIn: data.charge.expiresIn,
            expiresDate: data.charge.expiresDate,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Erro desconhecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in create-payment function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
