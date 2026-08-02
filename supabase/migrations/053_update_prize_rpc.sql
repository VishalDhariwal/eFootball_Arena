-- Migration: 053_update_prize_rpc.sql
-- Description: Update rpc_update_prize_status to accept optional prize_type

CREATE OR REPLACE FUNCTION rpc_update_prize_status(
    p_registration_id uuid,
    p_status text,
    p_prize_type text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_authorized boolean;
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check if the user is an admin or organizer
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid()
        AND r.name IN ('admin', 'organizer')
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Not authorized to update prize status';
    END IF;

    -- Validate status
    IF p_status NOT IN ('none', 'requested', 'paid') THEN
        RAISE EXCEPTION 'Invalid prize status';
    END IF;

    -- Validate prize type if provided
    IF p_prize_type IS NOT NULL AND p_prize_type NOT IN ('winner', 'runner_up') THEN
        RAISE EXCEPTION 'Invalid prize type';
    END IF;

    -- Update the registration
    UPDATE public.registrations
    SET 
        prize_status = p_status,
        prize_paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE prize_paid_at END,
        prize_type = COALESCE(p_prize_type, prize_type)
    WHERE id = p_registration_id;

    RETURN json_build_object('success', true);
END;
$$;
