import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const INFINITEPAY_API_URL = 'https://api.infinitepay.io/invoices/public/checkout/links';
const INFINITEPAY_HANDLE = 'italo-alexandre-660';

// =======================================================
// INPUT VALIDATION SCHEMAS
// =======================================================

const CartItemSchema = z.object({
  productName: z.string().min(1).max(200, { message: "Nome do produto muito longo" }),
  variationName: z.string().min(1).max(200, { message: "Nome da variação muito longo" }),
  price: z.number().positive({ message: "Preço deve ser positivo" }).max(999999, { message: "Preço máximo excedido" }),
  quantity: z.number().int().positive().max(100, { message: "Quantidade inválida" }),
});

const CustomerSchema = z.object({
  name: z.string().max(200).optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
});

const CheckoutRequestSchema = z.object({
  items: z.array(CartItemSchema).min(1, { message: "Carrinho vazio" }).max(50, { message: "Muitos itens no carrinho" }),
  orderNsu: z.string().max(100),
  redirectUrl: z.string().url({ message: "URL de redirecionamento inválida" }).max(500),
  webhookUrl: z.string().url({ message: "URL do webhook inválida" }).max(500).optional(),
  customer: CustomerSchema.optional(),
});

interface InfinitePayItem {
  quantity: number;
  price: number;
  description: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('InfinitePay checkout request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const parseResult = CheckoutRequestSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.issues);
      const firstError = parseResult.error.issues[0]?.message || 'Dados inválidos';
      return new Response(
        JSON.stringify({ success: false, error: firstError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Validated checkout request for order:', body.orderNsu);

    // Convert cart items to InfinitePay format
    // Price must be in cents (R$ 10,00 = 1000)
    const infinitePayItems: InfinitePayItem[] = body.items.map(item => ({
      quantity: item.quantity,
      price: Math.round(item.price * 100), // Convert to cents
      description: `${item.productName} - ${item.variationName}`.substring(0, 200), // Limit description length
    }));

    // Build the payload
    const payload: Record<string, unknown> = {
      handle: INFINITEPAY_HANDLE,
      items: infinitePayItems,
    };

    // Add order NSU
    payload.order_nsu = body.orderNsu;

    // Add redirect URL
    payload.redirect_url = body.redirectUrl;

    // Add webhook URL if provided
    if (body.webhookUrl) {
      payload.webhook_url = body.webhookUrl;
    }

    // Add customer data if provided
    if (body.customer) {
      payload.customer = {
        name: body.customer.name,
        email: body.customer.email,
        phone_number: body.customer.phone,
      };
    }

    console.log('Sending request to InfinitePay');

    // Make request to InfinitePay API
    const response = await fetch(INFINITEPAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log('InfinitePay response status:', response.status);

    if (!response.ok) {
      console.error('InfinitePay API error:', data);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: data.message || data.error || 'Erro ao criar checkout' 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // InfinitePay returns the checkout URL directly
    // The response format may vary, so we handle multiple cases
    const checkoutUrl = data.url || data.checkout_url || data.link;
    
    if (checkoutUrl) {
      console.log('Checkout URL created successfully');
      return new Response(
        JSON.stringify({
          success: true,
          checkoutUrl: checkoutUrl,
          orderNsu: body.orderNsu,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // If we got a success but no URL, return the full response for debugging
      console.log('Unexpected response format, returning full data');
      return new Response(
        JSON.stringify({
          success: true,
          data: data,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in infinitepay-checkout function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
