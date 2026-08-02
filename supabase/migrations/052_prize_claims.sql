-- Migration: 052_prize_claims.sql
-- Description: Prize Claim Request System
--   - Add prize_status, prize_upi_id, prize_phone, prize_requested_at, prize_paid_at, prize_type to registrations
--   - Create RPCs: rpc_request_prize, rpc_update_prize_status

-- 1. Extend registrations table
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS prize_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS prize_upi_id text,
ADD COLUMN IF NOT EXISTS prize_phone text,
ADD COLUMN IF NOT EXISTS prize_type text, -- 'winner' or 'runner_up'
ADD COLUMN IF NOT EXISTS prize_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS prize_paid_at timestamptz;

-- Add check constraints
ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS chk_prize_status;

ALTER TABLE public.registrations
ADD CONSTRAINT chk_prize_status 
CHECK (prize_status IN ('none', 'requested', 'paid'));

ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS chk_prize_type;

ALTER TABLE public.registrations
ADD CONSTRAINT chk_prize_type 
CHECK (prize_type IN ('winner', 'runner_up') OR prize_type IS NULL);

-- 2. Create RPC for a player to request a prize
CREATE OR REPLACE FUNCTION rpc_request_prize(
    p_registration_id uuid,
    p_upi_id text,
    p_phone text,
    p_type text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_registration record;
BEGIN
    -- Ensure the user is authenticated
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the registration
    SELECT * INTO v_registration FROM public.registrations WHERE id = p_registration_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found';
    END IF;

    -- Ensure the user owns the registration
    IF v_registration.user_id != auth.uid() THEN
        RAISE EXCEPTION 'Not authorized to request prize for this registration';
    END IF;

    -- Check if prize already requested
    IF v_registration.prize_status != 'none' THEN
        RAISE EXCEPTION 'Prize has already been requested or paid';
    END IF;

    -- Update the registration
    UPDATE public.registrations
    SET 
        prize_status = 'requested',
        prize_requested_at = now(),
        prize_upi_id = p_upi_id,
        prize_phone = p_phone,
        prize_type = p_type
    WHERE id = p_registration_id;

    RETURN json_build_object('success', true);
END;
$$;

-- 3. Create RPC for admin to update prize status
CREATE OR REPLACE FUNCTION rpc_update_prize_status(
    p_registration_id uuid,
    p_status text
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

    -- Update the registration
    UPDATE public.registrations
    SET 
        prize_status = p_status,
        prize_paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE prize_paid_at END
    WHERE id = p_registration_id;

    RETURN json_build_object('success', true);
END;
$$;
