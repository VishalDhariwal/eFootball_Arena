-- Migration: 040_hide_admins_from_public.sql
-- Description: Systemically hides admin users from being queried or viewed by non-admin users in the profiles table.

-- 1. Create a highly optimized helper function to check if a specific user is an admin
CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_user_id AND r.name = 'admin'
    ) INTO v_is_admin;
    
    RETURN v_is_admin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Drop the existing permissive SELECT policy
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON profiles;
EXCEPTION WHEN undefined_object THEN null; END $$;

-- 3. Create the new restrictive SELECT policy
-- A profile can be selected if:
-- a) The user is querying their own profile (they should always see themselves)
-- b) The user performing the query is an admin (admins see everyone)
-- c) The profile being queried does NOT belong to an admin (hide admins from the public)
CREATE POLICY "Public profiles are viewable by everyone except admins."
ON profiles FOR SELECT
USING (
    id = auth.uid() 
    OR is_admin_user(auth.uid()) 
    OR NOT is_admin_user(id)
);
