-- Migration: 047_username_auth.sql
-- Description: Switch new user registration to username+password only.
--   - Adds `username` column to profiles (unique, nullable for old accounts)
--   - Updates handle_new_user() trigger to store username, auto-approve, assign player role
--   - Adds get_email_by_identifier() RPC so the frontend can resolve
--     a username or player_id → internal auth email for login

-- 1. Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Create a unique index that only applies to non-null values
-- (old accounts have NULL username and that's fine)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- 2. Update the handle_new_user() trigger
--    New users: username comes from raw_user_meta_data->'username'
--    Old users: username will be NULL (they keep using email login)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
BEGIN
  v_username := new.raw_user_meta_data->>'username';
  -- Fallback display name: username if available, else full_name, else 'Player'
  v_display_name := COALESCE(
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    'Player'
  );

  INSERT INTO public.profiles (id, display_name, player_id, status, email, username)
  VALUES (
    new.id,
    v_display_name,
    'PLR-' || upper(substring(md5(random()::text) from 1 for 4)),
    'approved',   -- all new users are immediately approved
    new.email,
    v_username    -- NULL for old email-based accounts
  )
  ON CONFLICT (id) DO NOTHING;

  -- Assign 'player' role automatically
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT new.id, id FROM public.roles WHERE name = 'player'
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

-- 3. RPC: get_email_by_identifier
--    Given a username or player_id (case-insensitive), returns the auth email.
--    Used by the frontend login flow for non-email logins.
--    SECURITY DEFINER so it can read auth.users.email via the profiles join.
CREATE OR REPLACE FUNCTION public.get_email_by_identifier(p_identifier TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Try username first (case-insensitive)
  SELECT au.email INTO v_email
  FROM public.profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE lower(p.username) = lower(p_identifier)
  LIMIT 1;

  -- If not found, try player_id (case-insensitive)
  IF v_email IS NULL THEN
    SELECT au.email INTO v_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE lower(p.player_id) = lower(p_identifier)
    LIMIT 1;
  END IF;

  RETURN v_email;
END;
$$;

-- Grant execute to anon and authenticated so the frontend can call it
GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_identifier(TEXT) TO authenticated;
