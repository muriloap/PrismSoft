import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProductsSection from "@/components/ProductsSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import PrismFragments from "@/components/PrismFragments";

const Index = () => {
  return (
    <div className="min-h-screen bg-background relative">
      <PrismFragments />
      <Header />
      <main className="relative z-10">
        <HeroSection />
        <ProductsSection />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
