-- =====================
-- Fix orders table - remove overly permissive policies
-- =====================
DROP POLICY IF EXISTS "Service role can manage all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders by email" ON public.orders;
DROP POLICY IF EXISTS "Users can view their own orders by user_id" ON public.orders;

-- Admin can manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view their own orders (by user_id or email)
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR (auth.jwt() ->> 'email') = email
);

-- =====================
-- Fix delivered_keys table - protect license keys
-- =====================
DROP POLICY IF EXISTS "Service role can manage all delivered keys" ON public.delivered_keys;
DROP POLICY IF EXISTS "Users can view their delivered keys" ON public.delivered_keys;

-- Admin can manage all delivered keys
CREATE POLICY "Admins can manage all delivered keys"
ON public.delivered_keys
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view their delivered keys (linked to their orders)
CREATE POLICY "Users can view their delivered keys"
ON public.delivered_keys
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = delivered_keys.order_id
    AND (orders.user_id = auth.uid() OR orders.email = (auth.jwt() ->> 'email'))
  )
);

-- =====================
-- Fix order_items table - protect purchase history
-- =====================
DROP POLICY IF EXISTS "Service role can manage all order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can view items of their orders" ON public.order_items;

-- Admin can manage all order items
CREATE POLICY "Admins can manage all order items"
ON public.order_items
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view their order items
CREATE POLICY "Users can view their order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM orders
    WHERE orders.id = order_items.order_id
    AND (orders.user_id = auth.uid() OR orders.email = (auth.jwt() ->> 'email'))
  )
);