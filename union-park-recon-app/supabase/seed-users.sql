-- Run this AFTER users have signed up to set their roles correctly
-- Or manually create users in Supabase Auth dashboard first

-- Update user roles after signup
-- Brian Callahan - Admin
UPDATE public.profiles 
SET role = 'admin', full_name = 'Brian Callahan' 
WHERE email = 'bcallahan@unionpark.com';

-- Eric VanDyke - Admin
UPDATE public.profiles 
SET role = 'admin', full_name = 'Eric VanDyke' 
WHERE email = 'evandyke@unionpark.com';

-- Micah Molin - Recon Manager
UPDATE public.profiles 
SET role = 'recon_manager', full_name = 'Micah Molin' 
WHERE email = 'mmolin@unionpark.com';

-- Greg Lashbrook - Admin (GM)
UPDATE public.profiles 
SET role = 'admin', full_name = 'Greg Lashbrook' 
WHERE email = 'glashbrook@unionpark.com';

-- Dan Testa - Service
UPDATE public.profiles 
SET role = 'service', full_name = 'Dan Testa' 
WHERE email = 'dtesta@unionpark.com';

-- Jeremy Patterson - Service
UPDATE public.profiles 
SET role = 'service', full_name = 'Jeremy Patterson' 
WHERE email = 'jpatterson@unionpark.com';

-- Booker James - Detail
UPDATE public.profiles 
SET role = 'detail', full_name = 'Booker James' 
WHERE email = 'bjames@unionpark.com';

-- Louis - Detail
UPDATE public.profiles 
SET role = 'detail', full_name = 'Louis' 
WHERE email = 'louis@unionpark.com';
