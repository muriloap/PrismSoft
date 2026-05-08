import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Download, Home, Package, Clock, CreditCard, Zap, Key, Copy, Check, Loader2, ExternalLink, Mail, PartyPopper } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BackButton from '@/components/BackButton';
import cloveImage from '@/assets/clove-valorant.png';
interface DeliveredKey {
  id: string;
  keyValue: string;
  productName: string;
  variationName: string;
  deliveredAt: string;
}
interface OrderData {
  id: string;
  orderNsu: string;
  status: string;
  email: string;
  totalAmount: number;
  paymentMethod: string;
  receiptUrl?: string;
}
const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const {
    toast
  } = useToast();
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [deliveredKeys, setDeliveredKeys] = useState<DeliveredKey[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Email verification state
  const [emailInput, setEmailInput] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const orderNsu = searchParams.get('order_nsu');
  const receiptUrl = searchParams.get('receipt_url');
  const captureMethod = searchParams.get('capture_method');
  useEffect(() => {
    // Clear any stored cart/payment data
    localStorage.removeItem('current-payment');
    localStorage.removeItem('prism-cart');
    localStorage.removeItem('current-order');
  }, []);

  // Fetch order keys after email verification
  useEffect(() => {
    if (!emailVerified || !orderNsu || !emailInput) return;
    const fetchOrderKeys = async () => {
      setLoading(true);
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('get-order-keys', {
          body: {
            orderNsu,
            email: emailInput // Include email for server verification
          }
        });
        if (error) {
          console.error('Error fetching order keys:', error);
          return;
        }
        if (data.success) {
          setOrderData(data.order);
          setDeliveredKeys(data.deliveredKeys || []);

          // If no keys yet and order is not delivered, retry in a few seconds
          if (data.deliveredKeys?.length === 0 && data.order?.status !== 'delivered' && retryCount < 10) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
            }, 3000);
          }
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrderKeys();
  }, [emailVerified, orderNsu, emailInput, retryCount]);
  const handleVerifyEmail = async () => {
    if (!emailInput.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Digite o email usado na compra.",
        variant: "destructive"
      });
      return;
    }
    setVerifying(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('get-order-keys', {
        body: {
          orderNsu,
          email: emailInput.trim()
        }
      });
      if (error) {
        toast({
          title: "Erro de verificação",
          description: "Não foi possível verificar o email. Tente novamente.",
          variant: "destructive"
        });
        return;
      }
      if (data.success) {
        setEmailVerified(true);
        setOrderData(data.order);
        setDeliveredKeys(data.deliveredKeys || []);
        toast({
          title: "Email verificado!",
          description: "Suas chaves estão disponíveis abaixo."
        });
      } else {
        toast({
          title: "Email inválido",
          description: data.error || "O email não corresponde ao pedido.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      toast({
        title: "Erro",
        description: "Erro ao verificar email. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setVerifying(false);
    }
  };
  const handleCopyKey = async (keyValue: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(keyValue);
      setCopiedKey(keyId);
      toast({
        title: "Key copiada!",
        description: "A chave foi copiada para a área de transferência."
      });
      setTimeout(() => setCopiedKey(null), 3000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Tente copiar manualmente.",
        variant: "destructive"
      });
    }
  };
  const getPaymentMethodIcon = () => {
    if (captureMethod === 'pix' || orderData?.paymentMethod === 'pix') {
      return <Zap className="h-6 w-6" />;
    }
    return <CreditCard className="h-6 w-6" />;
  };
  const getPaymentMethodName = () => {
    const method = captureMethod || orderData?.paymentMethod;
    if (method === 'pix') return 'PIX';
    if (method === 'credit_card' || method === 'card') return 'Cartão de Crédito';
    return 'Cartão';
  };

  // Show email verification form if not verified
  if (!emailVerified) {
    return <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="max-w-md mx-auto">
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
                      top: `${10 + (i * 7)}%`,
                      left: `${5 + (i * 8)}%`,
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
                  <h2 className="text-xl font-bold text-white">Pagamento Confirmado!</h2>
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
                      className="h-40 w-auto object-contain drop-shadow-2xl transform hover:scale-105 transition-transform duration-500"
                    />
                    {/* Success badge */}
                    <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/40 border-4 border-card">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground text-center mb-6">
                  Para visualizar suas chaves, confirme o email usado na compra.
                </p>

                {/* Email Verification Form */}
                <div className="w-full space-y-4">
                  <div className="flex items-center gap-2 bg-muted/30 rounded-xl p-4">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <Input type="email" placeholder="Digite seu email" value={emailInput} onChange={e => setEmailInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyEmail()} className="border-0 bg-transparent focus-visible:ring-0" />
                  </div>

                  <Button variant="hero" className="w-full h-12" onClick={handleVerifyEmail} disabled={verifying}>
                    {verifying ? <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verificando...
                      </> : 'Verificar Email'}
                  </Button>

                  {orderNsu && <div className="text-sm text-muted-foreground">
                      <span className="flex items-center justify-center gap-2">
                        <Package className="h-4 w-4" />
                        Pedido: <span className="font-mono">{orderNsu}</span>
                      </span>
                    </div>}
                </div>

                {/* Back Home Button */}
                <div className="w-full mt-6 pt-6 border-t border-border">
                  <Button variant="outline" asChild className="w-full gap-2">
                    <Link to="/">
                      <Home className="h-4 w-4" />
                      Voltar ao Início
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <BackButton to="/" />
          </div>

          {/* Success Card */}
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-2">
              Pagamento Confirmado!
            </h1>
            <p className="text-muted-foreground mb-8">
              Sua compra foi processada com sucesso. Suas chaves estão disponíveis abaixo.
            </p>

            {/* Payment Details */}
            <div className="bg-muted/30 rounded-xl p-6 mb-6 text-left space-y-4">
              {(captureMethod || orderData?.paymentMethod) && <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    {getPaymentMethodIcon()}
                    Método de Pagamento
                  </span>
                  <span className="font-medium">{getPaymentMethodName()}</span>
                </div>}
              
              {(orderNsu || orderData?.orderNsu) && <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Número do Pedido
                  </span>
                  <span className="font-mono text-sm">{orderNsu || orderData?.orderNsu}</span>
                </div>}

              {orderData?.email && <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Email
                  </span>
                  <span className="text-sm">{orderData.email}</span>
                </div>}
            </div>

            {/* Delivered Keys Section */}
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 rounded-xl p-6 mb-6 text-left">
              <div className="flex items-center gap-2 mb-4">
                <Key className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-primary">Suas Chaves de Produto</h3>
              </div>

              {loading ? <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Carregando suas chaves...</span>
                </div> : deliveredKeys.length > 0 ? <div className="space-y-3">
                  {deliveredKeys.map(key => <div key={key.id} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {key.productName} - {key.variationName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-muted/50 px-3 py-2 rounded-lg font-mono text-sm break-all">
                          {key.keyValue}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => handleCopyKey(key.keyValue, key.id)} className="shrink-0">
                          {copiedKey === key.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>)}
                </div> : retryCount > 0 && retryCount < 10 ? <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                  <span className="text-muted-foreground">Aguardando entrega das chaves...</span>
                </div> : <div className="text-center py-6">
                  <p className="text-muted-foreground mb-2">
                    Suas chaves serão exibidas aqui após a confirmação do pagamento.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Você também receberá por email no endereço cadastrado.
                  </p>
                </div>}
            </div>

            {/* Important Info */}
            

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="hero" asChild className="gap-2">
                <a href="https://prismcheats.shop/" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Tutorial
                </a>
              </Button>

              {(receiptUrl || orderData?.receiptUrl) && <Button variant="outline" asChild className="gap-2">
                  <a href={receiptUrl || orderData?.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Ver Comprovante
                  </a>
                </Button>}
              
              <Button variant="outline" asChild className="gap-2">
                <Link to="/">
                  <Home className="h-4 w-4" />
                  Voltar ao Início
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>;
};
export default PaymentSuccessPage;