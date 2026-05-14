import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const CartItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  productImage: z.string().optional().nullable(),
  variationId: z.string(),
  variationName: z.string(),
  price: z.number(),
  quantity: z.number().int().positive(),
});

const CreateOrderSchema = z.object({
  items: z.array(CartItemSchema).min(1),
  email: z.string().email(),
  customerName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  paymentMethod: z.string(),
  paymentId: z.string().optional().nullable(),
  orderNsu: z.string().optional().nullable(),
  totalAmount: z.number(),
  discountAmount: z.number().optional().nullable(),
  couponCode: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();

    const parseResult = CreateOrderSchema.safeParse(body);
    if (!parseResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados inválidos', validationErrors: parseResult.error.flatten().fieldErrors }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = parseResult.data;
    
    // Validar Produtos
    const productIds = [...new Set(data.items.map(i => i.productId))];
    const { data: dbProducts, error: pError } = await supabase
      .from('products')
      .select('id, variations')
      .in('id', productIds);

    if (pError || !dbProducts) {
      throw new Error(pError?.message || 'Erro ao consultar catálogo');
    }

    // Cálculo Total
    let subtotal = 0;
    for (const item of data.items) {
      const product = dbProducts.find(p => p.id === item.productId);
      const variations = product?.variations as any[];
      const variation = variations?.find(v => v.id === item.variationId);
      
      if (!variation) throw new Error(`Variação ${item.variationName} não encontrada`);
      subtotal += Number(variation.price) * item.quantity;
    }

    let discount = 0;
    if (data.couponCode) {
      const { data: coupon } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', data.couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();
        
      if (coupon) {
        discount = coupon.discount_type === 'percentage' 
          ? subtotal * (coupon.discount_value / 100) 
          : Math.min(coupon.discount_value, subtotal);
      }
    }

    const total = Math.max(0, subtotal - discount);
    const nsu = data.orderNsu || `ORD-${Date.now()}`.toUpperCase();

    // Gravar Pedido
    const { data: order, error: oError } = await supabase
      .from('orders')
      .insert({
        email: data.email,
        customer_name: data.customerName || 'Cliente',
        phone: data.phone || '',
        status: 'pending',
        payment_method: data.paymentMethod,
        order_nsu: nsu,
        total_amount: Number(total.toFixed(2)),
        discount_amount: Number(discount.toFixed(2)),
        coupon_code: data.couponCode || '',
        user_id: (data.userId && data.userId.length > 20) ? data.userId : null
      })
      .select()
      .maybeSingle();

    if (oError || !order) throw new Error(oError?.message || 'Erro ao criar pedido');

    // Gravar Itens
    const orderItems = data.items.map(item => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      variation_id: item.variationId,
      variation_name: item.variationName,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: iError } = await supabase.from('order_items').insert(orderItems);
    if (iError) throw new Error('Erro ao salvar itens do pedido');

    // --- LÓGICA DE PAGAMENTO BLACKCAT (UNIFICADA) ---
    let payment = null;
    if (data.paymentMethod === 'pix') {
      try {
        const bcKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
        if (bcKey) {
          const projectId = supabaseUrl.split('//')[1].split('.')[0];
          const payload = {
            amount: Math.round(data.totalAmount * 100),
            currency: 'BRL',
            paymentMethod: 'pix',
            items: data.items.map(i => ({
              title: i.productName.substring(0, 100),
              unitPrice: Math.round(i.price * 100),
              quantity: i.quantity,
              tangible: false,
            })),
            customer: {
              name: (data.customerName || 'Cliente').substring(0, 100),
              email: data.email,
              phone: (data.phone || '11999999999').replace(/\D/g, ''),
              document: { number: '00000000000', type: 'cpf' },
            },
            pix: { expiresInDays: 1 },
            postbackUrl: `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`,
            externalRef: nsu,
          };

          const bcResp = await fetch('https://api.blackcatpay.com.br/api/sales/create-sale', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': bcKey },
            body: JSON.stringify(payload),
          });

          const bcData = await bcResp.json();
          if (bcData.success && bcData.data) {
            const tx = bcData.data;
            
            // Backup QR code generator if base64 is missing
            const qrBase64 = tx.paymentData?.qrCodeBase64;
            const pixCode = tx.paymentData?.copyPaste || tx.paymentData?.qrCode || '';
            
            payment = {
              id: tx.transactionId,
              pixCode: pixCode,
              qrCodeImage: qrBase64 
                ? `data:image/png;base64,${qrBase64}` 
                : `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}`,
              publicPaymentUrl: tx.invoiceUrl,
            };
            // Atualiza o payment_id no pedido
            await supabase.from('orders').update({ payment_id: tx.transactionId }).eq('id', order.id);
          }
        }
      } catch (bcError) {
        console.error('Erro silencioso no gateway:', bcError);
        // Não travamos a ordem se o gateway falhar, mas o app saberá lidar
      }
    }

    return new Response(
      JSON.stringify({ success: true, order, payment }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
