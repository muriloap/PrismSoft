-- Allow the specific admin email to assign themselves the admin role
CREATE POLICY "Admin self-provisioning"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.jwt() ->> 'email' = 'manoitalo8@gmail.com' 
  AND role = 'admin'
);
