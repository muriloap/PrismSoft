import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductVariation {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  image_url: string | null;
  rating: number;
  features: string[];
  variations: ProductVariation[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Parse variations from JSONB
      const parsedProducts = (data || []).map(product => ({
        ...product,
        variations: (Array.isArray(product.variations) ? product.variations : []) as unknown as ProductVariation[],
        features: product.features || [],
      }));

      setProducts(parsedProducts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();

    // Set up real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...product,
        variations: product.variations as unknown as any,
      })
      .select()
      .single();

    if (error) throw error;
    await fetchProducts();
    return data;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { data, error } = await supabase
      .from('products')
      .update({
        ...updates,
        variations: updates.variations as unknown as any,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await fetchProducts();
    return data;
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
    await fetchProducts();
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
};
