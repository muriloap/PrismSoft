import { useNavigate } from "react-router-dom";
import { ArrowLeft, Tag, ChevronRight, Package, Box } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrismFragments from "@/components/PrismFragments";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";

const StorePage = () => {
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const { products, loading: productsLoading } = useProducts();

  const getProductCount = (categoryName: string) => {
    return products.filter(p => p.category === categoryName && p.is_active).length;
  };

  const activeCategories = categories.filter(c => c.is_active);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <PrismFragments />
      <Header />

      <main className="relative z-10 pt-32 pb-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <Button
              variant="heroOutline"
              size="sm"
              onClick={() => navigate("/")}
              className="mb-8 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Início
            </Button>

            <div className="mb-12">
              <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
                Explore as categorias
              </h1>
              <p className="text-muted-foreground text-lg max-w-2xl">
                Escolha uma categoria para ver todos os produtos disponíveis em nossa loja. 
                Oferecemos as melhores soluções digitais para você.
              </p>
            </div>

            {categoriesLoading || productsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-40 rounded-3xl bg-card/40 animate-pulse border border-border/50" />
                ))}
              </div>
            ) : activeCategories.length === 0 ? (
              <div className="text-center py-20 bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl">
                <Box className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
                <h3 className="text-xl font-semibold mb-2">Nenhuma categoria disponível ainda</h3>
                <p className="text-muted-foreground">
                  Estamos trabalhando para trazer novos conteúdos em breve.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {activeCategories.map((cat, index) => {
                  const count = getProductCount(cat.name);
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      key={cat.id}
                      onClick={() => navigate(`/store/${cat.slug}`)}
                      className="group cursor-pointer bg-card/40 backdrop-blur-xl border border-border/50 rounded-3xl p-8 hover:border-purple-500/50 transition-all hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-purple-500/10"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 group-hover:from-purple-500/20 group-hover:to-fuchsia-500/20 transition-all">
                          <Tag className="h-8 w-8 text-purple-500" />
                        </div>
                        <div className="bg-purple-500/10 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold group-hover:bg-purple-500 group-hover:text-white transition-all">
                          {count} {count === 1 ? "Produto" : "Produtos"}
                        </div>
                      </div>

                      <div className="mt-6">
                        <h3 className="text-2xl font-bold mb-2 group-hover:text-purple-400 transition-colors">
                          {cat.name}
                        </h3>
                        <p className="text-muted-foreground text-sm line-clamp-2">
                          {cat.description || "Confira os produtos desta categoria e encontre o que você precisa."}
                        </p>
                      </div>

                      <div className="mt-8 flex items-center text-purple-400 font-semibold text-sm group-hover:gap-2 transition-all">
                        Ver produtos
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default StorePage;
