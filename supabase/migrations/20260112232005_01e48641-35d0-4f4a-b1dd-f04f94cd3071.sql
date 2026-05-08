-- Drop and recreate the view with SECURITY INVOKER (safe for public access)
DROP VIEW IF EXISTS public.product_stock_view;

CREATE VIEW public.product_stock_view 
WITH (security_invoker = true)
AS
SELECT 
  product_id,
  variation_id,
  COUNT(*) as available_count
FROM public.product_keys
WHERE status = 'available'
GROUP BY product_id, variation_id;

-- Re-grant access to the view
GRANT SELECT ON public.product_stock_view TO anon, authenticated;