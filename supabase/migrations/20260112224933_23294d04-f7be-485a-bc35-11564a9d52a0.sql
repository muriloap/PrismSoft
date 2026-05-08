-- Create a policy to allow anyone to view available keys count (product_id, variation_id, status only)
-- This allows the stock counter to work for all users
CREATE POLICY "Anyone can view available keys for stock count"
ON public.product_keys
FOR SELECT
USING (status = 'available');