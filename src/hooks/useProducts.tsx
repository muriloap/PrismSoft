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
  category_id: string | null;
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

      if (error) {
        // If table doesn't exist, we'll handle it gracefully
        if (error.message.includes('public.products') || error.code === '42P01') {
          console.error("ERRO CRÍTICO: A tabela 'products' não foi encontrada no seu Supabase.");
          console.info("SQL para criar a tabela: CREATE TABLE public.products (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, category TEXT NOT NULL, variations JSONB DEFAULT '[]', features TEXT[] DEFAULT '{}', image_url TEXT, rating NUMERIC DEFAULT 5, is_active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());");
          setProducts([]);
          return;
        }
        throw error;
      }

      // Parse variations from JSONB (handle both real JSON and stringified JSON)
      const parsedProducts = (data || []).map(product => {
        let variations = product.variations;
        if (typeof variations === 'string') {
          try {
            variations = JSON.parse(variations);
          } catch (e) {
            variations = [];
          }
        }
        return {
          ...product,
          variations: (Array.isArray(variations) ? variations : []) as unknown as ProductVariation[],
          features: product.features || [],
        };
      });

      setProducts(parsedProducts);
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message);
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
        variations: product.variations as any,
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
        variations: updates.variations ? updates.variations as any : undefined,
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
