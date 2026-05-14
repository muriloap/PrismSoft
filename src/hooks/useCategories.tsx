import { useState, useEffect, useCallback } from "react";
import { PRODUCT_CATEGORIES } from "@/constants/categories";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const fetchCategories = useCallback(() => {
    const fixedCategories: Category[] = PRODUCT_CATEGORIES.map((name, index) => ({
      id: name.toLowerCase(),
      name,
      slug: name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
      description: `Produtos da categoria ${name}`,
      icon: "Tag",
      sort_order: index,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));
    setCategories(fixedCategories);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const createCategory = async () => {
    // No-op for fixed categories
    return null;
  };

  const updateCategory = async () => {
    // No-op for fixed categories
    return null;
  };

  const deleteCategory = async () => {
    // No-op for fixed categories
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
