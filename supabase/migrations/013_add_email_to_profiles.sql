-- Migration: 013_add_email_to_profiles.sql
-- Description: Add email to profiles to display in Admin Users page, and explicitly set status to pending on signup.

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill email from auth.users for existing profiles
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE auth.users.id = profiles.id;

-- 3. Update the handle_new_user trigger to explicitly insert status = 'pending' and email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, player_id, status, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Player'),
    'PLR-' || upper(substring(md5(random()::text) from 1 for 4)),
    'pending',
    new.email
  );
  RETURN new;
END;
$$;
