-- Migration: 014_create_admin_user.sql
-- Description: Creates a default admin user and assigns the admin role

DO $$
DECLARE
  admin_uid UUID := gen_random_uuid();
  admin_role_id UUID;
BEGIN
  -- Check if admin@efootball.com already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@efootball.com') THEN
    -- 1. Insert into auth.users
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      admin_uid,
      '00000000-0000-0000-0000-000000000000',
      'admin@efootball.com',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Super Admin"}',
      now(),
      now(),
      'authenticated',
      '',
      '',
      '',
      ''
    );
    
    -- 2. Insert identity
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(), -- new unique id for identity
      admin_uid,
      admin_uid::text, -- provider_id is required
      format('{"sub":"%s","email":"%s"}', admin_uid::text, 'admin@efootball.com')::jsonb,
      'email',
      now(),
      now(),
      now()
    );

    -- 3. Profile should be created automatically by the trigger.
    -- Wait, the trigger might not have updated yet in this transaction, or it will.
    -- We can manually ensure the profile is marked as 'approved'
    UPDATE public.profiles SET status = 'approved' WHERE id = admin_uid;

    -- 4. Assign 'admin' role
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id) VALUES (admin_uid, admin_role_id) ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- User exists, just ensure they are approved and have admin role
    SELECT id INTO admin_uid FROM auth.users WHERE email = 'admin@efootball.com';
    UPDATE public.profiles SET status = 'approved' WHERE id = admin_uid;
    
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin';
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.user_roles (user_id, role_id) VALUES (admin_uid, admin_role_id) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
