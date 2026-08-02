-- Migration: 050_refund_system.sql
-- Description: Integrated Tournament Refund System
--   - Add refund_requested, refund_status, refund_requested_at, refund_processed_at, refund_upi_id, refund_phone, refund_reason to registrations
--   - Create RPCs: rpc_request_refund, rpc_update_refund_status

-- 1. Extend registrations table
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS refund_requested boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none',
ADD COLUMN IF NOT EXISTS refund_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS refund_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS refund_upi_id text,
ADD COLUMN IF NOT EXISTS refund_phone text,
ADD COLUMN IF NOT EXISTS refund_reason text;

-- Add a check constraint on refund_status
ALTER TABLE public.registrations
DROP CONSTRAINT IF EXISTS chk_refund_status;

ALTER TABLE public.registrations
ADD CONSTRAINT chk_refund_status 
CHECK (refund_status IN ('none', 'pending', 'approved', 'rejected', 'completed'));

-- 2. Create RPC for a player to request a refund
CREATE OR REPLACE FUNCTION rpc_request_refund(
    p_registration_id uuid,
    p_upi_id text,
    p_phone text,
    p_reason text
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
        RAISE EXCEPTION 'Not authorized to request refund for this registration';
    END IF;

    -- Check if refund already requested
    IF v_registration.refund_requested = true THEN
        RAISE EXCEPTION 'Refund has already been requested';
    END IF;

    -- Update the registration
    UPDATE public.registrations
    SET 
        refund_requested = true,
        refund_status = 'pending',
        refund_requested_at = now(),
        refund_upi_id = p_upi_id,
        refund_phone = p_phone,
        refund_reason = p_reason
    WHERE id = p_registration_id;

    RETURN json_build_object('success', true);
END;
$$;

-- 3. Create RPC for admin to update refund status
CREATE OR REPLACE FUNCTION rpc_update_refund_status(
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
        RAISE EXCEPTION 'Not authorized to update refund status';
    END IF;

    -- Validate status
    IF p_status NOT IN ('pending', 'approved', 'rejected', 'completed') THEN
        RAISE EXCEPTION 'Invalid refund status';
    END IF;

    -- Update the registration
    IF p_status = 'completed' THEN
        UPDATE public.registrations
        SET 
            refund_status = p_status,
            refund_processed_at = now()
        WHERE id = p_registration_id;
    ELSE
        UPDATE public.registrations
        SET 
            refund_status = p_status
        WHERE id = p_registration_id;
    END IF;

    RETURN json_build_object('success', true);
END;
$$;
