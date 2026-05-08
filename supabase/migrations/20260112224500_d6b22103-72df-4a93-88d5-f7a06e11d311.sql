-- Enable REPLICA IDENTITY FULL for complete row data in realtime updates
ALTER TABLE public.product_keys REPLICA IDENTITY FULL;

-- Add table to supabase_realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_keys;