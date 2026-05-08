-- Create orders table to track purchases
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_id TEXT,
  order_nsu TEXT UNIQUE,
  transaction_nsu TEXT,
  receipt_url TEXT,
  total_amount NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0,
  coupon_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  variation_id TEXT NOT NULL,
  variation_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create delivered keys table to track which keys were delivered to which order
CREATE TABLE public.delivered_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_key_id UUID NOT NULL REFERENCES public.product_keys(id),
  key_value TEXT NOT NULL,
  delivered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivered_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
CREATE POLICY "Users can view their own orders by user_id" 
ON public.orders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own orders by email" 
ON public.orders FOR SELECT 
USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Service role can manage all orders"
ON public.orders FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for order_items  
CREATE POLICY "Users can view items of their orders"
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND (orders.user_id = auth.uid() OR orders.email = auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Service role can manage all order items"
ON public.order_items FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for delivered_keys
CREATE POLICY "Users can view their delivered keys"
ON public.delivered_keys FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = delivered_keys.order_id 
    AND (orders.user_id = auth.uid() OR orders.email = auth.jwt() ->> 'email')
  )
);

CREATE POLICY "Service role can manage all delivered keys"
ON public.delivered_keys FOR ALL
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivered_keys;