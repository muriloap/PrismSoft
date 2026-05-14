import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ProductsSection from "@/components/ProductsSection";
import FeaturesSection from "@/components/FeaturesSection";
import Footer from "@/components/Footer";
import PrismFragments from "@/components/PrismFragments";

const Index = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
    setTimeout(() => {
      const element = document.getElementById('products-grid');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <PrismFragments />
      <Header />
      <main className="relative z-10">
        <HeroSection onCategorySelect={handleCategorySelect} />
        <ProductsSection 
          selectedCategory={selectedCategory} 
          onCategorySelect={setSelectedCategory} 
        />
        <FeaturesSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
