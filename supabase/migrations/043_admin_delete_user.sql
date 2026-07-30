-- Migration: 043_admin_delete_user.sql
-- Description: RPC for admins to safely delete a user entirely from the system.

CREATE OR REPLACE FUNCTION rpc_admin_delete_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Verify the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM roles WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete users';
  END IF;

  -- Delete from auth.users (this will cascade to profiles and everything else)
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
