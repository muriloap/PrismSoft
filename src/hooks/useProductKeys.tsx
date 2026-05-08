import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductKey {
  id: string;
  product_id: string;
  variation_id: string;
  key_value: string;
  status: 'available' | 'sold' | 'reserved';
  sold_to: string | null;
  sold_at: string | null;
  created_at: string;
  created_by: string | null;
}

export const useProductKeys = (productId?: string, variationId?: string) => {
  const [keys, setKeys] = useState<ProductKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('product_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (productId) {
        query = query.eq('product_id', productId);
      }
      if (variationId) {
        query = query.eq('variation_id', variationId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setKeys(data as ProductKey[]);
    } catch (err: any) {
      setError(err);
      console.error('Error fetching keys:', err);
    } finally {
      setLoading(false);
    }
  }, [productId, variationId]);

  useEffect(() => {
    fetchKeys();

    // Subscribe to real-time updates for product_keys table
    const channel = supabase
      .channel('product-keys-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_keys'
        },
        () => {
          // Refetch keys on any change
          fetchKeys();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchKeys]);

  const addKeys = async (productId: string, variationId: string, keyValues: string[]) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const keysToInsert = keyValues.map(key_value => ({
      product_id: productId,
      variation_id: variationId,
      key_value: key_value.trim(),
      status: 'available' as const,
      created_by: userData.user?.id || null,
    }));

    const { data, error } = await supabase
      .from('product_keys')
      .insert(keysToInsert)
      .select();

    if (error) throw error;
    
    // Real-time will handle the update
    return data;
  };

  const deleteKey = async (keyId: string) => {
    const { error } = await supabase
      .from('product_keys')
      .delete()
      .eq('id', keyId);

    if (error) throw error;
    
    // Optimistic update (real-time will sync)
    setKeys(keys.filter(k => k.id !== keyId));
  };

  const deleteMultipleKeys = async (keyIds: string[]) => {
    const { error } = await supabase
      .from('product_keys')
      .delete()
      .in('id', keyIds);

    if (error) throw error;
    
    // Optimistic update (real-time will sync)
    setKeys(keys.filter(k => !keyIds.includes(k.id)));
  };

  const getKeyStats = (productId: string, variationId: string) => {
    const variationKeys = keys.filter(
      k => k.product_id === productId && k.variation_id === variationId
    );
    return {
      total: variationKeys.length,
      available: variationKeys.filter(k => k.status === 'available').length,
      sold: variationKeys.filter(k => k.status === 'sold').length,
      reserved: variationKeys.filter(k => k.status === 'reserved').length,
    };
  };

  const getProductStock = (productId: string) => {
    const productKeys = keys.filter(k => k.product_id === productId && k.status === 'available');
    const stockByVariation: Record<string, number> = {};
    
    productKeys.forEach(key => {
      if (!stockByVariation[key.variation_id]) {
        stockByVariation[key.variation_id] = 0;
      }
      stockByVariation[key.variation_id]++;
    });
    
    return stockByVariation;
  };

  const getTotalStock = () => {
    return keys.filter(k => k.status === 'available').length;
  };

  return {
    keys,
    loading,
    error,
    addKeys,
    deleteKey,
    deleteMultipleKeys,
    getKeyStats,
    getProductStock,
    getTotalStock,
    refetch: fetchKeys,
  };
};
