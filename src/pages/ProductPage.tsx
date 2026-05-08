import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { ShoppingCart, Zap, Shield, CreditCard, MessageCircle, ArrowLeft, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useRealTimeStock } from "@/hooks/useRealTimeStock";
import { supabase } from "@/integrations/supabase/client";

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  rating: number;
  features: string[];
  variations: ProductVariation[];
  is_active: boolean;
}

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);

  // Get real-time stock based on available keys
  const { getStock, loading: stockLoading } = useRealTimeStock(product?.id);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          console.error('Error fetching product:', error);
          setProduct(null);
        } else {
          const parsedProduct: Product = {
            ...data,
            variations: (Array.isArray(data.variations) ? data.variations : []) as unknown as ProductVariation[],
            features: data.features || [],
          };
          setProduct(parsedProduct);

          // Set initial variation
          if (parsedProduct.variations.length > 0) {
            const variationParam = searchParams.get("variation");
            const found = parsedProduct.variations.find(v => v.id === variationParam);
            setSelectedVariation(found || parsedProduct.variations[0]);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [slug, searchParams]);

  // Helper to get real-time stock for a variation
  const getVariationStock = (variationId: string): number => {
    if (!product) return 0;
    return getStock(product.id, variationId);
  };

  const handleVariationChange = (variation: ProductVariation) => {
    setSelectedVariation(variation);
    setSearchParams({ variation: variation.id }, { replace: true });
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariation) return;
    
    if (!user) {
      toast({
        title: "Crie uma conta para comprar",
        description: "Você precisa estar logado para adicionar produtos ao carrinho.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }
    
    addItem({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image_url || '/placeholder.svg',
      variationId: selectedVariation.id,
      variationName: selectedVariation.name,
      price: selectedVariation.price,
      originalPrice: selectedVariation.originalPrice,
    });

    toast({
      title: "Adicionado ao carrinho!",
      description: `${product.name} - ${selectedVariation.name}`,
    });
  };

  const handleBuyNow = () => {
    if (!product || !selectedVariation) return;

    if (!user) {
      toast({
        title: "Crie uma conta para comprar",
        description: "Você precisa estar logado para realizar compras.",
        variant: "destructive",
      });
      navigate('/auth');
      return;
    }

    handleAddToCart();
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
            <Button onClick={() => navigate("/")} variant="hero">
              Voltar à loja
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const currentPrice = selectedVariation?.price || 0;
  const currentOriginalPrice = selectedVariation?.originalPrice;
  const discount = currentOriginalPrice 
    ? Math.round((1 - currentPrice / currentOriginalPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-8">
        <div className="container mx-auto px-4">
          {/* Back Button */}
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-purple-500/50 transition-all mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            Voltar
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Product Image + Description Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Product Image */}
              <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
                <img
                  src={product.image_url || '/placeholder.svg'}
                  alt={product.name}
                  className="w-full aspect-square object-cover"
                />
                {discount > 0 && (
                  <div className="absolute top-4 left-4 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-1.5 text-sm font-bold">
                    -{discount}% OFF
                  </div>
                )}
              </div>

              {/* Description Section - Below Image */}
              <div className="bg-card rounded-2xl border border-border p-6">
                <h2 className="text-xl font-bold mb-4 text-gradient">{product.name}</h2>
                <p className="text-muted-foreground mb-6">{product.description}</p>
                
                <div className="grid grid-cols-1 gap-4">
                  {product.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Info */}
            <div className="lg:col-span-5">
              <div className="bg-card rounded-2xl border border-border p-6">
                <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
                
                {selectedVariation && (
                  <span className={`inline-block px-3 py-1 rounded-lg text-sm mb-4 ${
                    getVariationStock(selectedVariation.id) > 0
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                    {getVariationStock(selectedVariation.id) > 0 
                      ? `${getVariationStock(selectedVariation.id)} em estoque`
                      : 'Sem estoque'}
                  </span>
                )}

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-3 mb-1">
                    {currentOriginalPrice && (
                      <span className="text-lg text-muted-foreground line-through">
                        R$ {currentOriginalPrice.toFixed(2).replace(".", ",")}
                      </span>
                    )}
                    {discount > 0 && (
                      <span className="text-sm text-purple-400">-{discount}% OFF</span>
                    )}
                  </div>
                  <div className="text-3xl font-bold text-gradient">
                    R$ {currentPrice.toFixed(2).replace(".", ",")}
                  </div>
                  <span className="text-sm text-muted-foreground">À vista no Pix</span>
                </div>

                {/* Variations */}
                {product.variations && product.variations.length > 0 && (
                  <div className="space-y-3 mb-6">
                    {product.variations.map((variation) => {
                      const variationStock = getVariationStock(variation.id);
                      const isOutOfStock = variationStock === 0;
                      
                      return (
                        <button
                          key={variation.id}
                          onClick={() => handleVariationChange(variation)}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                            selectedVariation?.id === variation.id
                              ? "border-purple-500 bg-purple-500/10"
                              : "border-border hover:border-purple-500/50 bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isOutOfStock
                                ? "border-muted-foreground/50"
                                : selectedVariation?.id === variation.id
                                  ? "border-purple-500 bg-purple-500"
                                  : "border-muted-foreground"
                            }`}>
                              {selectedVariation?.id === variation.id && !isOutOfStock && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="text-left">
                              <div className="font-medium">{variation.name}</div>
                              <div className={`text-sm ${
                                isOutOfStock
                                  ? 'text-red-400'
                                  : variationStock <= 5
                                    ? 'text-yellow-400'
                                    : 'text-green-400'
                              }`}>
                                {isOutOfStock 
                                  ? 'Sem estoque' 
                                  : variationStock <= 5
                                    ? `Apenas ${variationStock} em estoque`
                                    : `${variationStock} em estoque`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">
                              R$ {variation.price.toFixed(2).replace(".", ",")}
                            </div>
                            {variation.originalPrice && (
                              <div className="text-sm text-muted-foreground line-through">
                                R$ {variation.originalPrice.toFixed(2).replace(".", ",")}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  {selectedVariation && getVariationStock(selectedVariation.id) <= 0 && (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-2">
                      <p className="text-sm text-amber-400 font-medium mb-2">
                        ⚠️ Produto sem estoque automático
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Após a compra, entre no nosso{" "}
                        <a 
                          href="https://discord.gg/HEKCFhaXwF" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 underline"
                        >
                          Discord
                        </a>{" "}
                        e abra um ticket para resgatar seu produto.
                      </p>
                    </div>
                  )}
                  <Button variant="hero" size="lg" className="w-full gap-2" onClick={handleBuyNow}>
                    <ShoppingCart className="h-5 w-5" />
                    Comprar agora
                  </Button>
                  <Button variant="heroOutline" size="lg" className="w-full gap-2" onClick={handleAddToCart}>
                    Adicionar ao carrinho
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              {/* Entrega */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Zap className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Entrega imediata</h3>
                    <p className="text-sm text-muted-foreground">
                      Receba o seu pacote imediatamente após o pagamento.
                    </p>
                  </div>
                </div>
              </div>

              {/* Segurança */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Segurança total</h3>
                    <p className="text-sm text-muted-foreground">
                      Seus dados são criptografados de ponta-a-ponta durante todo o processo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pagamento */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <CreditCard className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Formas de pagamento</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Aceitamos os meios de pagamentos mais populares!
                    </p>
                    <div className="flex gap-2">
                      <div className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">PIX</div>
                      <div className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">Cartão</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ajuda */}
              <div className="bg-card rounded-2xl border border-border p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Precisa de ajuda?</h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Entre em contato conosco pelos nossos canais oficiais.
                    </p>
                    <a href="https://discord.gg/HEKCFhaXwF" target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full justify-start gap-2 bg-[#5865F2]/10 border-[#5865F2]/30 hover:bg-[#5865F2]/20">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProductPage;
