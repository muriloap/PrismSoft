import { ShoppingCart, Star, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";
import { useState } from "react";

const ProductsSection = () => {
  const navigate = useNavigate();
  const { products, loading } = useProducts();
  const { categories } = useCategories();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const activeCategories = categories.filter(c => c.is_active);

  // Filter only active products
  const activeProducts = products.filter(p => {
    const isActive = p.is_active;
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return isActive && matchesCategory;
  });

  return (
    <section className="py-16 bg-gradient-to-b from-transparent via-muted/20 to-transparent">
      <div className="container mx-auto px-4">
        {/* Section Title */}
        <div className="mb-10 flex items-center justify-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
          <h2 className="text-2xl font-bold text-center sm:text-3xl">
            Produtos em <span className="text-gradient">Destaque</span>
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        {/* Categories Filter */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant={selectedCategory === null ? "hero" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="rounded-full"
          >
            Todos
          </Button>
          {activeCategories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.name ? "hero" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.name)}
              className="rounded-full"
            >
              {category.name}
            </Button>
          ))}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
          </div>
        ) : activeProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
          </div>
        ) : (
          /* Products Grid */
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {activeProducts.map((product) => {
              // Get first variation for price display
              const firstVariation = product.variations?.[0];
              const price = firstVariation?.price || 0;
              const originalPrice = firstVariation?.originalPrice;

              return (
                <div
                  key={product.id}
                  onClick={() => navigate(`/produto/${product.slug}`)}
                  className="group relative overflow-hidden rounded-xl bg-card border border-border card-hover cursor-pointer"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={product.image_url || '/placeholder.svg'}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-60" />
                    
                    {/* Discount Badge */}
                    {originalPrice && originalPrice > price && (
                      <div className="absolute top-2 left-2 rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-2 py-1 text-xs font-bold">
                        -{Math.round((1 - price / originalPrice) * 100)}%
                      </div>
                    )}
                    
                    {/* Category Badge */}
                    <div className="absolute top-2 right-2 rounded-lg bg-background/80 backdrop-blur-sm px-2 py-1 text-xs font-medium text-muted-foreground">
                      {product.category}
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    {/* Rating */}
                    <div className="mb-2 flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < (product.rating || 5) ? "fill-purple-500 text-purple-500" : "text-muted"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Name */}
                    <h3 className="mb-2 text-sm font-semibold line-clamp-2 min-h-[2.5rem]">
                      {product.name}
                    </h3>

                    {/* Price */}
                    <div className="mb-3 flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gradient">
                        R$ {price.toFixed(2).replace(".", ",")}
                      </span>
                      {originalPrice && originalPrice > price && (
                        <span className="text-xs text-muted-foreground line-through">
                          R$ {originalPrice.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>

                    {/* Add to Cart Button */}
                    <Button 
                      variant="hero" 
                      size="sm" 
                      className="w-full gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/produto/${product.slug}`);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Comprar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductsSection;
