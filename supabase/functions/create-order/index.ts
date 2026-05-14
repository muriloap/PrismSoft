import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
  // Ultra-robust CORS handling for preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Max-Age': '86400',
      } 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const bcKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    console.log('Order request body:', JSON.stringify(body));

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
      const bcKey = Deno.env.get('BLACKCAT_API_KEY')?.trim();
      
      if (!bcKey) {
        console.error('BLACKCAT_API_KEY is missing');
        throw new Error('Configuração de pagamento incompleta (Chave de API ausente). Contate o suporte.');
      }

      try {
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
            document: { number: '12345678909', type: 'cpf' }, // Dummy valid-format CPF
          },
          pix: { expiresInDays: 1 },
          postbackUrl: `https://${projectId}.supabase.co/functions/v1/blackcat-webhook`,
          externalRef: nsu,
        };

        console.log('Calling BlackCat with key:', bcKey.substring(0, 10) + '...');
        const bcResp = await fetch('https://api.blackcatpay.com.br/api/sales/create-sale', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'X-API-Key': bcKey,
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
        });

        const bcDataFetched = await bcResp.json();
        console.log('BlackCat Create Response Status:', bcResp.status);
        
        if (!bcResp.ok) {
          console.error('BlackCat HTTP Error:', bcResp.status, JSON.stringify(bcDataFetched));
          throw new Error(bcDataFetched.message || `Gateway indisponível (Status ${bcResp.status})`);
        }

        if (bcDataFetched.success && (bcDataFetched.data || bcDataFetched.sale || bcDataFetched.payment)) {
          const tx = bcDataFetched.data || bcDataFetched.sale || bcDataFetched.payment;
          
          // Comprehensive mapping
          const pd = tx.paymentData || tx.payment_data || tx.pix || tx.payment || tx;
          
          // Extract PIX code (Copia e Cola) - Ultra Defensive Mapping
          let pixCode = pd.copyPaste || 
                         pd.qrCode || 
                         pd.pixCode || 
                         pd.payload || 
                         pd.emv || 
                         pd.copia_e_cola || 
                         pd.code || 
                         pd.pix_code ||
                         pd.brcode ||
                         pd.pix_payload ||
                         pd.pixData?.copyPaste ||
                         pd.data?.copyPaste ||
                         tx.copyPaste || 
                         tx.pix_code || 
                         tx.payload ||
                         tx.pix_payload ||
                         tx.pixCode ||
                         tx.pix_code_brcode ||
                         tx.brcode ||
                         '';
          
          // Extract QR Code (Base64)
          const qrBase64 = pd.qrCodeBase64 || 
                          pd.qrcode_base64 || 
                          pd.qrContent || 
                          pd.qrCodeContent || 
                          pd.base64 || 
                          pd.qr_code ||
                          pd.qrcode ||
                          pd.image ||
                          pd.qr_image ||
                          tx.qr_code_base64 ||
                          tx.qrcode ||
                          tx.qrCodeImage ||
                          tx.image_base64 ||
                          tx.qr_image_base64 ||
                          '';
          
          // Extract expiration
          const expiresAt = pd.expiresAt || 
                           pd.expires_at || 
                           pd.expirationDate || 
                           pd.valid_until ||
                           pd.expires_in ||
                           pd.expired_at ||
                           tx.expires_at ||
                           tx.expirationDate ||
                           tx.valid_until ||
                           new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          
          const transactionId = tx.transactionId || tx.id || tx.txid || tx.uuid || tx.sale_id || tx.external_id || tx.order_id || tx.payment_id;
          
          // Ultra-Defensive: Search for any PIX payload pattern recursively if not found
          if (!pixCode) {
            const findPixPattern = (obj: any): string | null => {
              if (!obj) return null;
              if (typeof obj === 'string') {
                if (obj.startsWith('000201')) return obj;
                try {
                  const decoded = atob(obj);
                  if (decoded.startsWith('000201')) return decoded;
                } catch(e) {}
                return null;
              }
              if (Array.isArray(obj)) {
                for (const item of obj) {
                  const found = findPixPattern(item);
                  if (found) return found;
                }
              }
              if (obj !== null && typeof obj === 'object') {
                for (const key in obj) {
                  const found = findPixPattern(obj[key]);
                  if (found) return found;
                }
              }
              return null;
            };
            const patternMatched = findPixPattern(bcDataFetched);
            if (patternMatched) {
              console.log('RECOVERED PIX FROM PATTERN MATCH!');
              pixCode = patternMatched;
            }
          }

          if (pixCode || tx.invoiceUrl || tx.payment_url || tx.checkout_url) {
            payment = {
              id: transactionId ? String(transactionId) : `PIX-${Date.now()}`,
              pixCode: pixCode || '',
              qrCodeImage: qrBase64 
                ? (qrBase64.startsWith('data:') ? qrBase64 : `data:image/png;base64,${qrBase64}`) 
                : (pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}` : ''),
              expiresDate: expiresAt,
              publicPaymentUrl: tx.invoiceUrl || tx.invoice_url || tx.paymentUrl || tx.url || tx.payment_url || tx.checkout_url || '',
            };
            
            // Atualiza o payment_id no pedido
            if (transactionId) {
              await supabase.from('orders').update({ payment_id: String(transactionId) }).eq('id', order.id);
            }
          } else {
            console.error('PIX data missing in BlackCat response. Response body:', JSON.stringify(bcDataFetched));
            throw new Error('O gateway não retornou os dados de pagamento. Tente novamente em instantes.');
          }
        } else {
          console.error('BlackCat API ERROR:', JSON.stringify(bcDataFetched));
          throw new Error(bcDataFetched.message || 'Erro na comunicação com o gateway de pagamento.');
        }
      } catch (bcError: any) {
        console.error('Erro no gateway BlackCat:', bcError);
        throw new Error(bcError.message || 'Falha ao processar pagamento via Pix.');
      }
    }

    return new Response(
      JSON.stringify({ success: true, order, payment }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Erro interno no servidor' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
