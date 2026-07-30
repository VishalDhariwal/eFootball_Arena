-- Migration: 042_add_phone_to_profiles.sql
-- Description: Add phone_number column to profiles and save it from raw_user_meta_data on user creation.

-- 1. Add phone_number column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Update the handle_new_user trigger to save the phone number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, player_id, status, email, phone_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Player'),
    'PLR-' || upper(substring(md5(random()::text) from 1 for 4)),
    'pending',
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$;
