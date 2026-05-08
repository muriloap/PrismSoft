-- Drop the dangerous public policy that exposes license key values
DROP POLICY IF EXISTS "Anyone can view available keys for stock count" ON public.product_keys;

-- Create a secure view that only exposes stock counts, not actual key values
CREATE OR REPLACE VIEW public.product_stock_view AS
SELECT 
  product_id,
  variation_id,
  COUNT(*) as available_count
FROM public.product_keys
WHERE status = 'available'
GROUP BY product_id, variation_id;

-- Grant access to the view for both anonymous and authenticated users
GRANT SELECT ON public.product_stock_view TO anon, authenticated;