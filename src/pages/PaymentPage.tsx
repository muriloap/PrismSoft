import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Check, Clock, RefreshCw, ArrowLeft, CheckCircle, XCircle, Smartphone, QrCode, Sparkles, ShieldCheck, PartyPopper, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';
import cloveImage from '@/assets/clove-valorant.png';

interface PaymentData {
  id: string;
  value: number;
  status: string;
  pixCode: string;
  qrCodeImage: string;
  expiresDate: string;
  orderId?: string;
  orderNsu?: string;
}

const PaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'paid' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Get payment data from URL params (stored in localStorage)
  useEffect(() => {
    const storedPayment = localStorage.getItem('current-payment');
    if (storedPayment) {
      try {
        const data = JSON.parse(storedPayment);
        setPaymentData(data);
        setLoading(false);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!paymentData?.expiresDate) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expires = new Date(paymentData.expiresDate).getTime();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expirado');
        setPaymentStatus('expired');
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [paymentData?.expiresDate]);

  // Auto-check payment status every 5 seconds
  useEffect(() => {
    if (!paymentData || paymentStatus !== 'pending') return;

    const checkPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('blackcat-verify-payment', {
          body: { 
            chargeId: paymentData.id,
            orderId: paymentData.orderId,
          }
        });

        if (error) {
          console.error('Error checking payment:', error);
          return;
        }

        if (data.success && data.payment) {
          if (data.payment.isPaid) {
            setPaymentStatus('paid');
            const storedPayment = localStorage.getItem('current-payment');
            let orderNsu = '';
            if (storedPayment) {
              try {
                const parsed = JSON.parse(storedPayment);
                orderNsu = parsed.orderNsu || '';
              } catch {}
            }
            localStorage.removeItem('current-payment');
            
            // Redirect to success page with order info
            if (orderNsu) {
              navigate(`/pagamento/sucesso?order_nsu=${encodeURIComponent(orderNsu)}&capture_method=pix`);
            } else {
              toast({
                title: "Pagamento confirmado!",
                description: "Seu pagamento foi aprovado com sucesso.",
              });
            }
          } else if (data.payment.isExpired) {
            setPaymentStatus('expired');
          }
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    const interval = setInterval(checkPayment, 5000);
    return () => clearInterval(interval);
  }, [paymentData, paymentStatus, toast]);

  const handleCopyPixCode = async () => {
    if (!paymentData?.pixCode) return;
    
    try {
      await navigator.clipboard.writeText(paymentData.pixCode);
      setCopied(true);
      toast({
        title: "Código copiado!",
        description: "Cole no seu aplicativo de pagamento.",
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Tente copiar manualmente.",
        variant: "destructive"
      });
    }
  };

  const handleCheckPayment = async () => {
    if (!paymentData) return;
    
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('blackcat-verify-payment', {
        body: { 
          chargeId: paymentData.id,
          orderId: paymentData.orderId,
        }
      });

      if (error) throw error;

      if (data.success && data.payment) {
        if (data.payment.isPaid) {
          setPaymentStatus('paid');
          const storedPayment = localStorage.getItem('current-payment');
          let orderNsu = '';
          if (storedPayment) {
            try {
              const parsed = JSON.parse(storedPayment);
              orderNsu = parsed.orderNsu || '';
            } catch {}
          }
          localStorage.removeItem('current-payment');
          
          // Redirect to success page with order info
          if (orderNsu) {
            navigate(`/pagamento/sucesso?order_nsu=${encodeURIComponent(orderNsu)}&capture_method=pix`);
          } else {
            toast({
              title: "Pagamento confirmado!",
              description: "Seu pagamento foi aprovado com sucesso.",
            });
          }
        } else if (data.payment.isExpired) {
          setPaymentStatus('expired');
          toast({
            title: "Pagamento expirado",
            description: "O tempo para pagamento expirou.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Aguardando pagamento",
            description: "Ainda não identificamos seu pagamento.",
          });
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Erro ao verificar",
        description: "Tente novamente em alguns segundos.",
        variant: "destructive"
      });
    } finally {
      setChecking(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="max-w-md mx-auto text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-4">Pagamento não encontrado</h1>
            <p className="text-muted-foreground mb-6">
              Não encontramos informações de pagamento. Tente novamente.
            </p>
            <Button onClick={() => navigate('/checkout')} variant="hero">
              Voltar ao checkout
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-lg mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <BackButton to="/" />
          </div>

          {/* Payment Status - Paid */}
          {paymentStatus === 'paid' && (
            <div className="relative bg-card border border-green-500/30 rounded-3xl overflow-hidden">
              {/* Background with gradient and glow effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-purple-500/10 pointer-events-none" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />
              
              {/* Confetti-like particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: i % 3 === 0 ? '#22c55e' : i % 3 === 1 ? '#a855f7' : '#fbbf24',
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${i * 0.2}s`,
                      opacity: 0.6
                    }}
                  />
                ))}
              </div>
              
              {/* Header with celebration */}
              <div className="relative bg-gradient-to-r from-green-600 via-emerald-500 to-green-600 p-6">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBjeD0iMjAiIGN5PSIyMCIgcj0iMiIvPjwvZz48L3N2Zz4=')] opacity-30" />
                <div className="relative flex items-center justify-center gap-3">
                  <PartyPopper className="h-7 w-7 text-yellow-300 animate-bounce" />
                  <h2 className="text-xl font-bold text-white">Compra Realizada!</h2>
                  <PartyPopper className="h-7 w-7 text-yellow-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
              
              {/* Content */}
              <div className="relative p-8 flex flex-col items-center">
                {/* Character Image with glow */}
                <div className="relative mb-6 group">
                  <div className="absolute -inset-4 bg-gradient-to-r from-green-500/30 via-emerald-500/30 to-purple-500/30 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity animate-pulse" style={{ animationDuration: '3s' }} />
                  <div className="relative">
                    <img 
                      src={cloveImage} 
                      alt="Clove Valorant" 
                      className="h-56 w-auto object-contain drop-shadow-2xl transform hover:scale-105 transition-transform duration-500"
                    />
                    {/* Success badge */}
                    <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 border-4 border-card">
                      <CheckCircle className="h-7 w-7 text-white" />
                    </div>
                  </div>
                </div>
                
                {/* Success message */}
                <div className="text-center mb-6">
                  <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-green-400 via-emerald-400 to-green-500 bg-clip-text text-transparent">
                    Pagamento Confirmado!
                  </h1>
                  <p className="text-muted-foreground text-lg max-w-sm">
                    Seu pagamento foi processado com sucesso. Você receberá seu produto por email.
                  </p>
                </div>
                
                {/* Gift icon indicator */}
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-500/10 via-green-500/10 to-purple-500/10 border border-green-500/20 mb-6">
                  <Gift className="h-5 w-5 text-green-400" />
                  <span className="text-sm text-muted-foreground">Seu produto será enviado em instantes</span>
                </div>
                
                {/* Action button */}
                <Button onClick={() => navigate('/')} variant="hero" size="lg" className="px-10 h-14 text-base font-semibold">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Voltar à loja
                </Button>
              </div>
            </div>
          )}

          {/* Payment Status - Expired */}
          {paymentStatus === 'expired' && (
            <div className="relative bg-card border border-destructive/30 rounded-3xl p-10 text-center overflow-hidden">
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-destructive/10 to-transparent pointer-events-none" />
              
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                  <XCircle className="h-12 w-12 text-white" />
                </div>
              </div>
              
              <h1 className="text-3xl font-bold mb-3 bg-gradient-to-r from-red-400 to-rose-500 bg-clip-text text-transparent">
                Pagamento Expirado
              </h1>
              <p className="text-muted-foreground mb-8 text-lg">
                O tempo para pagamento expirou. Por favor, tente novamente.
              </p>
              <Button onClick={() => navigate('/checkout')} variant="hero" size="lg" className="px-8">
                <RefreshCw className="h-5 w-5 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Payment Status - Pending */}
          {paymentStatus === 'pending' && (
            <div className="relative bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-primary/10">
              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-purple-600/20 via-fuchsia-600/20 to-purple-600/20 animate-pulse pointer-events-none" style={{ animationDuration: '3s' }} />
              
              {/* Header */}
              <div className="relative bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-600 p-8 text-center">
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
                
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <QrCode className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-white mb-2">Pagamento via PIX</h1>
                  <p className="text-white/80 flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    Escaneie o QR Code ou copie o código
                  </p>
                </div>
              </div>

              {/* Timer */}
              <div className="relative flex items-center justify-center gap-3 py-5 border-b border-border bg-gradient-to-r from-muted/50 via-muted/80 to-muted/50">
                <div className="flex items-center gap-2 px-4 py-2 bg-background/50 rounded-full border border-border">
                  <Clock className="h-5 w-5 text-primary animate-pulse" />
                  <span className="text-sm text-muted-foreground">Expira em:</span>
                  <span className="font-mono font-bold text-xl text-foreground bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {timeLeft}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              <div className="relative p-8 flex flex-col items-center">
                {/* QR Code Container with glow */}
                <div className="relative mb-8 group">
                  <div className="absolute -inset-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-2xl blur-lg opacity-30 group-hover:opacity-50 transition-opacity" />
                  <div className="relative bg-white p-5 rounded-2xl shadow-xl">
                    <img 
                      src={paymentData.qrCodeImage} 
                      alt="QR Code PIX" 
                      className="w-52 h-52"
                    />
                  </div>
                </div>

                {/* Value */}
                <div className="text-center mb-8 p-4 rounded-2xl bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 border border-border/50 w-full">
                  <p className="text-sm text-muted-foreground mb-2 uppercase tracking-wide">Valor a pagar</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {formatPrice(paymentData.value)}
                  </p>
                </div>

                {/* PIX Code Buttons */}
                <div className="w-full space-y-4">
                  <Button
                    onClick={handleCopyPixCode}
                    className={`w-full h-14 gap-3 text-base font-semibold transition-all duration-300 ${
                      copied 
                        ? 'bg-green-500 hover:bg-green-600 text-white' 
                        : ''
                    }`}
                    variant={copied ? "default" : "hero"}
                  >
                    {copied ? (
                      <>
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                          <Check className="h-4 w-4" />
                        </div>
                        Código copiado!
                      </>
                    ) : (
                      <>
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                          <Copy className="h-4 w-4" />
                        </div>
                        Copiar código PIX
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleCheckPayment}
                    disabled={checking}
                    variant="outline"
                    className="w-full h-14 gap-3 text-base font-medium border-2 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                  >
                    {checking ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                        <span className="text-primary">Verificando pagamento...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-5 w-5" />
                        Já paguei, verificar
                      </>
                    )}
                  </Button>
                </div>

                {/* Instructions */}
                <div className="mt-8 w-full">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { step: 1, icon: Smartphone, text: 'Abra o app do banco' },
                      { step: 2, icon: QrCode, text: 'Escolha pagar com PIX' },
                      { step: 3, icon: Copy, text: 'Escaneie ou cole o código' },
                      { step: 4, icon: CheckCircle, text: 'Confirme o pagamento' },
                    ].map(({ step, icon: Icon, text }) => (
                      <div 
                        key={step} 
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/30 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground leading-tight">{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security badge */}
                <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                  <span>Pagamento seguro e criptografado</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PaymentPage;
