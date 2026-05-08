-- Add phone_verified column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean DEFAULT false;

-- Create phone_verifications table to store pending verifications
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  code text NOT NULL,
  attempts integer DEFAULT 0,
  verified boolean DEFAULT false,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending verifications
CREATE POLICY "Users can view own verifications"
ON public.phone_verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role can manage all verifications (for edge functions)
-- Note: Service role bypasses RLS, so this is just for documentation