import { MessageCircle, Headphones, ArrowRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useCategories } from "@/hooks/useCategories";
import heroBg from "@/assets/hero-bg.jpg";

interface HeroSectionProps {
  onCategorySelect?: (category: string | null) => void;
}

const HeroSection = ({ onCategorySelect }: HeroSectionProps) => {
  const navigate = useNavigate();
  const { categories } = useCategories();

  return <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img src={heroBg} alt="Hero background" className="h-full w-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="container relative z-10 mx-auto px-4 pt-20">
        <div className="max-w-2xl">
          {/* Trust Badge */}
          <div className="mb-6 flex items-center gap-2 animate-fade-in">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => <svg key={i} className="h-5 w-5 fill-purple-500" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>)}
            </div>
            <span className="text-sm text-muted-foreground">
              Veja as nossas avaliações no <span className="text-purple-400 font-medium">Discord</span>
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-6 text-4xl font-black tracking-tight sm:text-5xl md:text-6xl animate-slide-up">
            Bem Vindo(a)
            <br />
            <span className="text-gradient glow-text">Prismatic</span>!
          </h1>

          {/* Description */}
          <p className="mb-8 text-lg text-muted-foreground leading-relaxed animate-slide-up" style={{
          animationDelay: "0.1s"
        }}>
            Aqui você encontra tudo para deixar sua experiência de jogo ainda melhor. 
            Compra rápida, segura e 100% digital. Explore e aproveite!
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 animate-slide-up mb-12" style={{
          animationDelay: "0.2s"
        }}>
            <Button variant="hero" size="lg" className="gap-2 px-8 min-w-[160px]" onClick={() => {
              if (onCategorySelect) onCategorySelect(null);
            }}>
              Ver Produtos
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="heroOutline" size="lg" className="gap-2" asChild>
              <a href="https://discord.gg/HEKCFhaXwF" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" />
                Comunidade
              </a>
            </Button>
          </div>

          {/* Categories Quick Link */}
          <div className="animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <p className="text-sm font-medium text-muted-foreground/60 mb-4 flex items-center gap-2 uppercase tracking-widest">
              <Tag className="h-3 w-3" />
              Categorias Populares
            </p>
            <div className="flex flex-wrap gap-2">
              {categories.slice(0, 5).map((category) => (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect?.(category.name)}
                  className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-white transition-all backdrop-blur-sm"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>;
};
export default HeroSection;