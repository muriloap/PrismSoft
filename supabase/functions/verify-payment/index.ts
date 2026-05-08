import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FLOW_API_URL = 'https://flowapplications.com.br';

// =======================================================
// INPUT VALIDATION SCHEMA
// =======================================================

const VerifyPaymentSchema = z.object({
  chargeId: z.string().min(1, { message: "ID do pagamento obrigatório" }).max(100),
  orderId: z.string().uuid({ message: "ID do pedido inválido" }).optional(),
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
    paymentMethods?: {
      pix?: {
        status: string;
      };
    };
    expiresIn: number;
    expiresDate: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

async function deliverKeysForOrder(supabase: any, orderId: string, userId: string | null) {
  console.log('Delivering keys for order:', orderId);

  // Check if keys already delivered
  const { data: existingDelivery } = await supabase
    .from('delivered_keys')
    .select('id')
    .eq('order_id', orderId)
    .limit(1);

  if (existingDelivery && existingDelivery.length > 0) {
    console.log('Keys already delivered for order:', orderId);
    return { alreadyDelivered: true, count: 0 };
  }

  // Get order items
  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError || !orderItems || orderItems.length === 0) {
    console.error('Order items not found:', itemsError);
    return { alreadyDelivered: false, count: 0 };
  }

  let deliveredCount = 0;

  // Process each order item
  for (const item of orderItems) {
    console.log(`Processing item: ${item.product_name} - ${item.variation_name}, qty: ${item.quantity}`);
    
    // Get available keys for this product/variation
    const { data: availableKeys, error: keysError } = await supabase
      .from('product_keys')
      .select('*')
      .eq('product_id', item.product_id)
      .eq('variation_id', item.variation_id)
      .eq('status', 'available')
      .limit(item.quantity);

    if (keysError) {
      console.error('Error fetching keys:', keysError);
      continue;
    }

    if (!availableKeys || availableKeys.length === 0) {
      console.warn(`No keys available for ${item.product_name}`);
      continue;
    }

    for (const key of availableKeys) {
      // Mark key as sold
      const { error: updateKeyError } = await supabase
        .from('product_keys')
        .update({
          status: 'sold',
          sold_to: userId || null,
          sold_at: new Date().toISOString()
        })
        .eq('id', key.id);

      if (updateKeyError) {
        console.error('Error updating key status:', updateKeyError);
        continue;
      }

      // Create delivered key record
      const { error: deliverError } = await supabase
        .from('delivered_keys')
        .insert({
          order_id: orderId,
          order_item_id: item.id,
          product_key_id: key.id,
          key_value: key.key_value
        });

      if (deliverError) {
        console.error('Error creating delivery record:', deliverError);
        continue;
      }

      deliveredCount++;
    }
  }

  // Update order status to delivered if keys were delivered
  if (deliveredCount > 0) {
    await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);
  }

  console.log(`Delivered ${deliveredCount} keys for order ${orderId}`);
  return { alreadyDelivered: false, count: deliveredCount };
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Verify payment request received');
  
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

    const parseResult = VerifyPaymentSchema.safeParse(rawBody);
    
    if (!parseResult.success) {
      console.error('Validation error:', parseResult.error.issues);
      const firstError = parseResult.error.issues[0]?.message || 'Dados inválidos';
      return new Response(
        JSON.stringify({ success: false, error: firstError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = parseResult.data;
    console.log('Verifying payment:', body.chargeId);

    // Make request to Flow API
    const response = await fetch(`${FLOW_API_URL}/api/flow-api/charge/${encodeURIComponent(body.chargeId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${FLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const data: FlowChargeResponse = await response.json();
    console.log('Flow API response status:', response.status);

    if (!response.ok) {
      console.error('Flow API error:', data.error);
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Erro ao verificar pagamento' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (data.success && data.charge) {
      // Check payment status from multiple possible fields
      const status = data.charge.status || data.charge.paymentMethods?.pix?.status;
      const isPaid = status === 'PAID' || status === 'CONFIRMED' || status === 'COMPLETED';
      const isExpired = status === 'EXPIRED';
      const isPending = status === 'ACTIVE' || status === 'PENDING';

      console.log('Payment status:', status, '- isPaid:', isPaid);

      // If payment is confirmed, update order and deliver keys
      if (isPaid) {
        // Find the order by payment_id (charge ID)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('payment_id', body.chargeId)
          .maybeSingle();

        if (order && !orderError) {
          console.log('Found order:', order.id);

          // Update order status to paid if not already
          if (order.status === 'pending') {
            await supabase
              .from('orders')
              .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
                transaction_nsu: data.charge.transactionID || null,
              })
              .eq('id', order.id);

            // Deliver keys
            const deliveryResult = await deliverKeysForOrder(supabase, order.id, order.user_id);
            console.log('Delivery result:', deliveryResult);
          }
        } else {
          console.log('Order not found by payment_id, trying orderId from request');
          
          // Try orderId if provided
          if (body.orderId) {
            const { data: orderById } = await supabase
              .from('orders')
              .select('*')
              .eq('id', body.orderId)
              .maybeSingle();

            if (orderById && orderById.status === 'pending') {
              await supabase
                .from('orders')
                .update({
                  status: 'paid',
                  paid_at: new Date().toISOString(),
                  payment_id: body.chargeId,
                  transaction_nsu: data.charge.transactionID || null,
                })
                .eq('id', orderById.id);

              const deliveryResult = await deliverKeysForOrder(supabase, orderById.id, orderById.user_id);
              console.log('Delivery result:', deliveryResult);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: data.charge.id,
            value: data.charge.value,
            status: status,
            isPaid: isPaid,
            isExpired: isExpired,
            isPending: isPending,
            transactionID: data.charge.transactionID,
            expiresDate: data.charge.expiresDate,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: data.error || 'Pagamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in verify-payment function:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
