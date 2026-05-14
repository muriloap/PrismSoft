import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StockInfo {
  productId: string;
  variationId: string;
  available: number;
}

interface DBStockViewItem {
  product_id: string;
  variation_id: string;
  available_count: number;
}

export const useRealTimeStock = (productId?: string) => {
  const [stockData, setStockData] = useState<StockInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStock = useCallback(async () => {
    try {
      // Query the secure view that only exposes stock counts, not actual key values
      const { data, error } = await supabase
        .from('product_stock_view')
        .select('product_id, variation_id, available_count');

      if (error) throw error;

      // Filter by productId if provided, then map to StockInfo format
      const filteredData = productId 
        ? (data as unknown as DBStockViewItem[] || []).filter((item) => item.product_id === productId)
        : (data as unknown as DBStockViewItem[] || []);

      const stockList: StockInfo[] = filteredData.map((item) => ({
        productId: item.product_id,
        variationId: item.variation_id,
        available: Number(item.available_count)
      }));

      setStockData(stockList);
    } catch (error) {
      console.error('Error fetching stock:', error);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // Always fetch when productId changes (including from undefined to a value)
    fetchStock();

    // Subscribe to real-time updates on product_keys table
    // When keys are added/sold, refetch from the secure view
    const channel = supabase
      .channel(`stock-updates-${productId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_keys',
          ...(productId ? { filter: `product_id=eq.${productId}` } : {})
        },
        () => {
          // Refetch stock counts on any change
          fetchStock();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [productId, fetchStock]);

  const getStock = (productId: string, variationId: string): number => {
    const stock = stockData.find(
      s => s.productId === productId && s.variationId === variationId
    );
    return stock?.available || 0;
  };

  return {
    stockData,
    loading,
    getStock,
    refetch: fetchStock
  };
};
