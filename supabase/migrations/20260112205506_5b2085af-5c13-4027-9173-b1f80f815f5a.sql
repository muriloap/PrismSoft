-- Fix coupons table - restrict public access to sensitive fields
DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.coupons;

-- Only authenticated users can view active coupons (prevents public scraping)
CREATE POLICY "Authenticated users can view active coupons"
ON public.coupons
FOR SELECT
TO authenticated
USING (is_active = true);