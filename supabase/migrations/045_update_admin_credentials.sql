-- Migration: 045_update_admin_credentials.sql
-- Description: Updates the default admin email and password

DO $$
DECLARE
  v_admin_uid UUID;
BEGIN
  -- Find the current admin user
  SELECT id INTO v_admin_uid FROM auth.users WHERE email = 'admin@efootball.com';
  
  IF v_admin_uid IS NOT NULL THEN
    -- Update auth.users
    UPDATE auth.users
    SET 
      email = 'football.arena.team1@gmail.com',
      encrypted_password = crypt('Noida-bennett@456', gen_salt('bf'))
    WHERE id = v_admin_uid;
    
    -- Update auth.identities
    UPDATE auth.identities
    SET 
      identity_data = format('{"sub":"%s","email":"%s"}', v_admin_uid::text, 'football.arena.team1@gmail.com')::jsonb
    WHERE user_id = v_admin_uid;
  END IF;
END $$;
