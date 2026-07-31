-- Migration: 043_assign_player_role.sql
-- Description: Assigns the 'player' role to all existing users without it and updates the registration trigger to do it automatically for new users.

-- 1. Update the handle_new_user trigger to also assign the 'player' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, display_name, player_id, status, email, phone_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Player'),
    'PLR-' || upper(substring(md5(random()::text) from 1 for 4)),
    'pending',
    new.email,
    new.raw_user_meta_data->>'phone'
  );

  -- Assign 'player' role
  INSERT INTO public.user_roles (user_id, role_id)
  SELECT new.id, id FROM public.roles WHERE name = 'player'
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

-- 2. Backfill existing users: Give everyone the 'player' role if they don't have it
INSERT INTO public.user_roles (user_id, role_id)
SELECT p.id, r.id
FROM public.profiles p
CROSS JOIN public.roles r
WHERE r.name = 'player'
AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = p.id AND ur.role_id = r.id
);
