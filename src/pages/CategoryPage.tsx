import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Package, Star, ShoppingCart, Tag } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrismFragments from "@/components/PrismFragments";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

const CategoryPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const { products, loading: productsLoading } = useProducts();

  const category = categories.find(c => c.slug === slug);
  const categoryProducts = products.filter(p => p.category === category?.name && p.is_active);

  if (categoriesLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background relative flex flex-col pt-32 pb-20 items-center justify-center">
        <PrismFragments />
        <Header />
        <div className="text-center relative z-10">
          <Tag className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h1 className="text-3xl font-bold mb-4 text-gradient">Categoria não encontrada</h1>
          <p className="text-muted-foreground mb-8">A categoria que você procura não existe ou foi removida.</p>
          <Button variant="hero" onClick={() => navigate("/store")}>
            Explorar Categorias
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <PrismFragments />
      <Header />

      <main className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          <Button
            variant="heroOutline"
            size="sm"
            onClick={() => navigate("/store")}
            className="mb-8 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Todas as categorias
          </Button>

          <header className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
              {category.name}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl">
              {category.description || `Confira todos os softwares e licenças disponíveis na categoria ${category.name}.`}
            </p>
          </header>

          {categoryProducts.length === 0 ? (
            <div className="text-center py-20 bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl">
              <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-xl font-semibold mb-2">Nenhum produto nesta categoria</h3>
              <p className="text-muted-foreground">
                Fique atento! Novidade chegarão em breve para {category.name}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {categoryProducts.map((product, index) => {
                const lowestPrice = Math.min(...product.variations.map(v => v.price));
                const originalPrice = product.variations[0]?.originalPrice;

                return (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    key={product.id}
                    className="group bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl overflow-hidden hover:border-purple-500/50 transition-all hover:shadow-2xl hover:shadow-purple-500/10 flex flex-col"
                  >
                    <Link to={`/product/${product.slug}`} className="relative h-56 overflow-hidden">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Package className="h-12 w-12 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1 text-xs font-bold text-yellow-500 border border-border/50">
                        <Star className="h-3 w-3 fill-yellow-500" />
                        {product.rating}
                      </div>
                    </Link>

                    <div className="p-6 flex-1 flex flex-col">
                      <div className="mb-4">
                        <Link to={`/product/${product.slug}`}>
                          <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors uppercase">
                            {product.name}
                          </h3>
                        </Link>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {product.description}
                        </p>
                      </div>

                      <div className="mt-auto space-y-4">
                        <div className="flex items-end gap-2">
                          <span className="text-2xl font-bold text-white">
                            R$ {lowestPrice.toFixed(2)}
                          </span>
                          {originalPrice && originalPrice > lowestPrice && (
                            <span className="text-sm text-muted-foreground line-through mb-1">
                              R$ {originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <Button 
                          asChild
                          className="w-full rounded-xl bg-purple-600 hover:bg-purple-700 font-bold"
                        >
                          <Link to={`/product/${product.slug}`}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Comprar Agora
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryPage;
