
export const PRODUCT_CATEGORIES = [
  "Streamings",
  "IA's Code",
  "DIscord",
  "Email's",
  "Contas"
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
