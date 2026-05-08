-- Create product_keys table to store license keys
CREATE TABLE public.product_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id TEXT NOT NULL,
  key_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'reserved')),
  sold_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sold_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE public.product_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for admins to manage all keys
CREATE POLICY "Admins can manage all keys"
ON public.product_keys
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policy for users to view their purchased keys
CREATE POLICY "Users can view their purchased keys"
ON public.product_keys
FOR SELECT
USING (auth.uid() = sold_to);

-- Create index for faster queries
CREATE INDEX idx_product_keys_product_variation ON public.product_keys(product_id, variation_id);
CREATE INDEX idx_product_keys_status ON public.product_keys(status);
CREATE INDEX idx_product_keys_sold_to ON public.product_keys(sold_to);