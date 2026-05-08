
export const PRODUCT_CATEGORIES = [
  "Streamings",
  "IA Code",
  "DIscord",
  "Email's",
  "Contas"
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
