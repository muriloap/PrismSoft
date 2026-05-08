-- Add column to restrict coupons to specific roles
ALTER TABLE public.coupons 
ADD COLUMN restricted_to_role app_role DEFAULT NULL;

-- Update the PAINEL100 coupon to be restricted to resellers only
UPDATE public.coupons 
SET restricted_to_role = 'reseller' 
WHERE code = 'PAINEL100';

COMMENT ON COLUMN public.coupons.restricted_to_role IS 'If set, only users with this role can use the coupon';