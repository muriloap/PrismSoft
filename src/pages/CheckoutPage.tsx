import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Shield, CreditCard, User, Mail, Phone, Trash2, Plus, Minus, Tag, X, Zap, Copy, Check, RefreshCw, Clock, QrCode, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, subtotal, discount, total, couponCode, appliedCoupon, applyCoupon, removeCoupon, clearCart, isValidatingCoupon } = useCart();
  const { user } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [couponInput, setCouponInput] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [contactInfo, setContactInfo] = useState({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: ''
  });

  // Fetch user profile to get phone number
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
          return;
        }
        
        if (profile) {
          // Parse full name into first and last name
          const nameParts = (profile.full_name || '').trim().split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          setContactInfo(prev => ({
            ...prev,
            firstName: prev.firstName || firstName,
            lastName: prev.lastName || lastName,
            email: prev.email || user.email || '',
            phone: prev.phone || profile.phone || ''
          }));
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    
    const result = await applyCoupon(couponInput);
    if (result.success) {
      toast.success("Cupom aplicado!", {
        description: "Desconto aplicado ao seu pedido.",
      });
      setCouponInput('');
    } else {
      toast.error("Cupom inválido", {
        description: result.error || "O código inserido não é válido.",
      });
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      toast.error("Carrinho vazio", {
        description: "Adicione produtos ao carrinho antes de finalizar.",
      });
      return;
    }

    if (!acceptTerms) {
      toast.error("Aceite os termos", {
        description: "Você precisa aceitar os termos e condições.",
      });
      return;
    }

    if (!contactInfo.email) {
      toast.error("Email obrigatório", {
        description: "Por favor, insira seu email.",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const orderNsu = `ORDER-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create order first to check stock and reserve
      // (supports legacy carts that stored numeric productId)
      const invalidItems = items.filter((i) => !isUuid(i.productId));
      const slugToDbIdMap = new Map<string, string>();

      if (invalidItems.length > 0) {
        const slugs = Array.from(
          new Set(invalidItems.map((i) => i.productSlug).filter(Boolean))
        );

        if (slugs.length > 0) {
          const { data: productsData, error: productsError } = await supabase
            .from("products")
            .select("id, slug")
            .in("slug", slugs);

          if (productsError) throw productsError;

          (productsData || []).forEach((p) => {
            slugToDbIdMap.set(p.slug, p.id);
          });
        }
      }

      const cartItems = items.map((item) => {
        const resolvedProductId = isUuid(item.productId)
          ? item.productId
          : slugToDbIdMap.get(item.productSlug) || item.productId;

        return {
          productId: resolvedProductId,
          productName: item.productName,
          productImage: item.productImage,
          variationId: item.variationId,
          variationName: item.variationName,
          price: item.price,
          quantity: item.quantity,
        };
      });

      const stillInvalid = cartItems.find((i) => !isUuid(i.productId));
      if (stillInvalid) {
        toast.error("Produto inválido no carrinho", {
          description: "Remova o item do carrinho e adicione novamente.",
        });
        return;
      }

      const orderPayload = {
        items: cartItems,
        email: contactInfo.email,
        customerName: `${contactInfo.firstName} ${contactInfo.lastName}`.trim() || null,
        phone: contactInfo.phone || null,
        paymentMethod: paymentMethod,
        orderNsu: orderNsu,
        totalAmount: total,
        discountAmount: discount,
        couponCode: couponCode || null,
        userId: user?.id || null,
      };

      console.log('--- INICIANDO PROCESSO DE CHECKOUT ---');
      console.log('Payload:', orderPayload);

      let orderData, orderError;
      try {
        console.log('Chamando supabase.functions.invoke("create-order")...');
        const result = await supabase.functions.invoke('create-order', {
          body: orderPayload
        });
        
        console.log('Resultado bruto da função:', result);
        orderData = result.data;
        orderError = result.error;

        // If the function returned an error in the response structure (even with status 200)
        // or if invoke captured a non-2xx status as orderError
        if (orderError) {
          console.error('--- ERRO DETECTADO NA CHAMADA ---', orderError);
          
          // Try to extract body from the response if available in the error object
          // Supabase FunctionsHttpError often has a response property
          if (orderError.context?.response) {
            try {
              const errorBody = await orderError.context.response.json();
              console.error('Corpo do erro 500 extraído:', errorBody);
              const message = errorBody.details || errorBody.message || errorBody.error || orderError.message;
              throw new Error(message);
            } catch (jsonErr) {
              console.warn('Não foi possível ler o JSON do erro 500:', jsonErr);
            }
          }
          
          throw new Error(orderError.message || 'Erro técnico na função create-order');
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('FALHA NA EXECUÇÃO DO CHECKOUT:', err);
        throw new Error(errorMessage);
      }

      console.log('Resposta processada:', orderData);
      
      if (!orderData || orderData.success === false) {
        console.error('--- ERRO DE LÓGICA NO PEDIDO ---', orderData);
        
        // Extract the best possible error message
        let msg = orderData?.error || 'Erro desconhecido ao processar pedido';
        if (orderData?.details) {
          console.error('Detalhes do erro do banco:', orderData.details);
          msg += ` (${orderData.details})`;
        }
        
        if (orderData?.validationErrors) {
          console.error('Erros de validação retornados:', orderData.validationErrors);
          const fields = Object.keys(orderData.validationErrors).join(', ');
          throw new Error(`Dados inválidos: ${fields}`);
        }

        if (orderData?.stockError) {
          toast.error("Estoque insuficiente", {
            description: msg,
          });
          return;
        }
        
        throw new Error(msg);
      }

      console.log('SUCESSO: PEDIDO CRIADO!', orderData.order);

      // Check if order is free (100% discount)
      const isFreeOrder = total < 1;

      if (isFreeOrder) {
        // Free order - mark as paid and deliver keys automatically
        console.log('Free order detected, processing automatic delivery');
        
        try {
          // Update order status to paid
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              status: 'paid',
              payment_method: 'free',
              paid_at: new Date().toISOString()
            })
            .eq('id', orderData.order.id);

          if (updateError) {
            console.error('Error updating order status:', updateError);
          }

          // Automatically deliver keys for free orders
          const { data: deliveryData, error: deliveryError } = await supabase.functions.invoke('auto-deliver-keys', {
            body: {
              orderId: orderData.order.id,
              orderNsu: orderNsu,
            }
          });

          if (deliveryError) {
            console.error('Error auto-delivering keys:', deliveryError);
          } else {
            console.log('Keys auto-delivered:', deliveryData);
          }

          // Store order data and navigate to success page
          localStorage.setItem('current-order', JSON.stringify({
            orderId: orderData.order.id,
            orderNsu: orderNsu,
            items: items,
            total: total,
            createdAt: new Date().toISOString(),
          }));
          
          clearCart();
          navigate(`/pagamento/sucesso?order_nsu=${encodeURIComponent(orderNsu)}&capture_method=free`);
        } catch (freeOrderError) {
          console.error('Error processing free order:', freeOrderError);
          throw new Error('Erro ao processar pedido gratuito');
        }
        return;
      }

      if (paymentMethod === 'pix') {
        // PIX payment via BlackCat Pay (using the new payment-processor endpoint)
        const productNames = items.map(item => `${item.productName} (${item.variationName})`).join(', ');

        console.log('--- CHAMANDO PROCESSADOR DE PAGAMENTO ---');
        
        try {
          const { data, error } = await supabase.functions.invoke('payment-processor', {
            body: {
              value: total,
              description: `Compra: ${productNames}`,
              customerName: `${contactInfo.firstName} ${contactInfo.lastName}`.trim() || 'Cliente',
              customerEmail: contactInfo.email,
              customerPhone: contactInfo.phone || '11999999999',
              expiresIn: 3600,
              orderId: orderData.order.id,
              orderNsu: orderNsu,
              items: items.map(item => ({
                title: `${item.productName} - ${item.variationName}`,
                quantity: item.quantity,
                unitPrice: item.price,
              })),
            }
          });

          console.log('Resultado do processador:', { data, error });

          if (error) {
            // Se houver erro de rede/CORS que o Supabase captura
            throw new Error(`Falha na conexão com o gateway: ${error.message || 'Sem resposta do servidor'}`);
          }

          if (data && data.success && data.payment) {
            localStorage.setItem('current-payment', JSON.stringify({
              ...data.payment,
              orderId: orderData.order.id,
              orderNsu: orderNsu,
            }));
            clearCart();
            navigate('/pagamento');
          } else {
            throw new Error(data?.error || 'O gateway de pagamento não pôde processar o seu pedido no momento.');
          }
        } catch (funcErr) {
          console.error('Erro ao invocar payment-processor:', funcErr);
          throw funcErr;
        }
      } else {
        // Card payment via InfinitePay
        const projectId = supabase.supabaseUrl.split('//')[1].split('.')[0];
        const redirectUrl = `${window.location.origin}/pagamento/sucesso?order_nsu=${encodeURIComponent(orderNsu)}&email=${encodeURIComponent(contactInfo.email)}`;
        const webhookUrl = `https://${projectId}.supabase.co/functions/v1/infinitepay-webhook`;

        const checkoutItems = items.map(item => ({
          productName: item.productName,
          variationName: item.variationName,
          price: item.price,
          quantity: item.quantity,
        }));

        const formattedPhone = contactInfo.phone 
          ? (contactInfo.phone.startsWith('+') ? contactInfo.phone : `+55${contactInfo.phone.replace(/\D/g, '')}`)
          : undefined;

        const { data, error } = await supabase.functions.invoke('infinitepay-checkout', {
          body: {
            items: checkoutItems,
            orderNsu: orderNsu,
            redirectUrl: redirectUrl,
            webhookUrl: webhookUrl,
            customer: {
              name: `${contactInfo.firstName} ${contactInfo.lastName}`.trim() || undefined,
              email: contactInfo.email || undefined,
              phone: formattedPhone,
            },
          }
        });

        if (error) {
          throw new Error(error.message || 'Erro ao criar checkout');
        }

        console.log('InfinitePay response:', data);

        if (data.success && data.checkoutUrl) {
          localStorage.setItem('current-order', JSON.stringify({
            orderId: orderData.order.id,
            orderNsu: orderNsu,
            items: items,
            total: total,
            createdAt: new Date().toISOString(),
          }));
          clearCart();
          window.location.href = data.checkoutUrl;
        } else if (data.success && data.data) {
          const checkoutUrl = data.data.url || data.data.checkout_url || data.data.link;
          if (checkoutUrl) {
            localStorage.setItem('current-order', JSON.stringify({
              orderId: orderData.order.id,
              orderNsu: orderNsu,
              items: items,
              total: total,
              createdAt: new Date().toISOString(),
            }));
            clearCart();
            window.location.href = checkoutUrl;
          } else {
            console.error('No checkout URL in response:', data);
            throw new Error('URL de checkout não encontrada na resposta');
          }
        } else {
          throw new Error(data.error || 'Erro ao processar pagamento');
        }
      }
    } catch (error: unknown) {
      console.error('Checkout error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      toast.error("Erro no pagamento", {
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        {/* Back Button */}
        <div className="mb-6">
          <BackButton to="/" />
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Checkout</span>
        </div>

        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-[1fr,400px] gap-8">
          {/* Left Column - Payment & Contact */}
          <div className="space-y-6">
            {/* Payment Methods */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Formas de pagamento</h2>
              
              <div className="space-y-3">
                {/* PIX Option */}
                <button
                  onClick={() => setPaymentMethod('pix')}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
                    paymentMethod === 'pix'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Pix</span>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        Mais rápido
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">Aprovação imediata</p>
                  </div>
                </button>

                {/* Card Option */}
                <button
                  onClick={() => setPaymentMethod('card')}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all ${
                    paymentMethod === 'card'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="font-semibold">Cartão Crédito/Débito</span>
                    <p className="text-sm text-muted-foreground">Pagamento seguro com InfinitePay</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Informações de contato</h2>
              
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome"
                    value={contactInfo.firstName}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, firstName: e.target.value }))}
                    className="pl-10 bg-muted/50 border-border"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Sobrenome"
                    value={contactInfo.lastName}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, lastName: e.target.value }))}
                    className="pl-10 bg-muted/50 border-border"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="pl-10 bg-muted/50 border-border"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    placeholder="Telefone"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="pl-10 bg-muted/50 border-border"
                  />
                </div>
              </div>
            </div>

            {/* Terms & Pay Button */}
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  className="mt-0.5"
                />
                <span className="text-sm text-muted-foreground">
                  Eu aceito os{' '}
                  <Link to="/termos" className="text-primary hover:underline">
                    termos e condições
                  </Link>
                  {' '}desta compra.
                </span>
              </label>

              <Button
                onClick={handleCheckout}
                disabled={isProcessing || items.length === 0}
                className="w-full h-14 text-lg bg-primary hover:bg-primary/90"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : (
                  <>Pagar {formatPrice(total)}</>
                )}
              </Button>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Resumo do pedido</h2>
                <span className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                  <Shield className="h-3.5 w-3.5" />
                  Pagamento seguro
                </span>
              </div>

              {items.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Seu carrinho está vazio.</p>
              ) : (
                <div className="space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {items.map((item) => (
                      <div
                        key={`${item.productId}-${item.variationId}`}
                        className="flex gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{item.productName}</h4>
                          <p className="text-xs text-muted-foreground">{item.variationName}</p>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              {item.originalPrice && (
                                <span className="text-xs text-muted-foreground line-through">
                                  {formatPrice(item.originalPrice)}
                                </span>
                              )}
                              <span className="text-sm font-semibold text-primary">
                                {formatPrice(item.price)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateQuantity(item.productId, item.variationId, item.quantity - 1)}
                                className="p-1 hover:bg-muted rounded"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-sm w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.variationId, item.quantity + 1)}
                                className="p-1 hover:bg-muted rounded"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => removeItem(item.productId, item.variationId)}
                                className="p-1 hover:bg-destructive/20 hover:text-destructive rounded ml-1"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Coupon */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Digite seu cupom de desconto"
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value)}
                        className="pl-10 bg-muted/50 border-border"
                        disabled={!!couponCode}
                      />
                    </div>
                    {couponCode ? (
                      <Button
                        variant="outline"
                        onClick={removeCoupon}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Remover
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon}
                        className="gap-2"
                      >
                        {isValidatingCoupon ? (
                          <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                        ) : (
                          <Tag className="h-4 w-4" />
                        )}
                        {isValidatingCoupon ? 'Validando...' : 'Aplicar'}
                      </Button>
                    )}
                  </div>

                  {couponCode && (
                    <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-2 rounded-lg">
                      <Tag className="h-4 w-4" />
                      Cupom <strong>{couponCode}</strong> aplicado!
                    </div>
                  )}

                  {/* Totals */}
                  <div className="border-t border-border pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Descontos</span>
                      <span className={discount > 0 ? 'text-primary' : ''}>
                        {discount > 0 ? `-${formatPrice(discount)}` : formatPrice(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-lg font-bold pt-2">
                      <span>Total</span>
                      <span>{formatPrice(total)}</span>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </main>

    <Footer />
  </div>
);
};

export default CheckoutPage;
