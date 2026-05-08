import productPrismAim from "@/assets/product-prism-aim.png";
import productAimcolor from "@/assets/product-aimcolor.png";
import productTpmBypass from "@/assets/product-tpm-bypass.png";
import productSpoofer1Click from "@/assets/product-spoofer-1click.png";
import productPrismSpoofer from "@/assets/product-prism-spoofer.png";

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

export interface Product {
  id: number;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  rating: number;
  description: string;
  features: string[];
  variations?: ProductVariation[];
}

export const products: Product[] = [
  {
    id: 1,
    slug: "valorant-prism-aim",
    name: "Valorant Prism Aim",
    price: 14.90,
    originalPrice: 19.90,
    image: productPrismAim,
    category: "Contas",
    rating: 5,
    description: "Conta premium com acesso total e garantia de funcionamento.",
    features: [
      "Acesso imediato",
      "Garantia de 30 dias",
      "Suporte exclusivo",
      "Segurança total"
    ],
    variations: [
      { id: "diario", name: "Diário", price: 14.90, originalPrice: 19.90, stock: 100 },
      { id: "7-dias", name: "7 Dias", price: 59.90, originalPrice: 79.90, stock: 50 },
      { id: "30-dias", name: "30 Dias", price: 99.90, originalPrice: 129.90, stock: 50 },
    ]
  },
  {
    id: 2,
    slug: "valorant-aimcolor",
    name: "Valorant AimColor",
    price: 9.90,
    originalPrice: 14.90,
    image: productAimcolor,
    category: "Streamings",
    rating: 5,
    description: "Acesso premium aos melhores serviços de streaming.",
    features: [
      "Ultra HD 4K",
      "Multitela",
      "Sem anúncios",
      "Acesso imediato"
    ],
    variations: [
      { id: "diario", name: "Diário", price: 9.90, originalPrice: 14.90, stock: 100 },
      { id: "7-dias", name: "7 Dias", price: 39.90, originalPrice: 59.90, stock: 50 },
      { id: "30-dias", name: "30 Dias", price: 89.90, originalPrice: 119.90, stock: 50 },
    ]
  },
  {
    id: 3,
    slug: "valorant-tpm-bypass",
    name: "Valorant TPM Bypass",
    price: 9.90,
    originalPrice: 14.90,
    image: productTpmBypass,
    category: "Ia's",
    rating: 5,
    description: "Assinaturas premium para as melhores ferramentas de IA.",
    features: [
      "Processamento rápido",
      "Acesso a modelos Pro",
      "Sem limites de uso",
      "Suporte prioritário"
    ],
    variations: [
      { id: "diario", name: "Diário", price: 9.90, originalPrice: 14.90, stock: 100 },
      { id: "mensal", name: "Mensal", price: 69.90, originalPrice: 99.90, stock: 100 },
      { id: "lifetime", name: "Lifetime + Updates", price: 189.90, originalPrice: 249.90, stock: 50 },
    ]
  },
  {
    id: 4,
    slug: "valorant-spoofer-1click",
    name: "Valorant Spoofer 1 Click",
    price: 19.90,
    originalPrice: 34.90,
    image: productSpoofer1Click,
    category: "DIscord",
    rating: 5,
    description: "Serviços e boosts para sua comunidade no Discord.",
    features: [
      "Boost Nível 3",
      "Badges exclusivas",
      "Emojis animados",
      "Alta qualidade de áudio"
    ],
    variations: [
      { id: "diario", name: "Diário", price: 19.90, originalPrice: 34.90, stock: 100 },
      { id: "7-dias", name: "7 Dias", price: 59.90, originalPrice: 79.90, stock: 50 },
      { id: "30-dias", name: "30 Dias", price: 109.90, originalPrice: 149.90, stock: 50 },
    ]
  },
  {
    id: 5,
    slug: "prism-spoofer",
    name: "Prism Spoofer",
    price: 21.90,
    originalPrice: 34.90,
    image: productPrismSpoofer,
    category: "Email's",
    rating: 5,
    description: "Contas de email profissionais e seguras.",
    features: [
      "Armazenamento ilimitado",
      "Domínio personalizado",
      "Filtro spam avançado",
      "Sincronização total"
    ],
    variations: [
      { id: "diario", name: "Diário", price: 21.90, originalPrice: 34.90, stock: 100 },
      { id: "7-dias", name: "7 Dias", price: 49.90, originalPrice: 69.90, stock: 50 },
      { id: "30-dias", name: "30 Dias", price: 89.90, originalPrice: 129.90, stock: 50 },
    ]
  },
];

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find(p => p.slug === slug);
};
