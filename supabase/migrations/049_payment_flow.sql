-- Migration: 049_payment_flow.sql
-- Description: Integrated Tournament Payment Flow
--   - Add payment_screenshot_url, transaction_id, payment_submitted_at to registrations
--   - Create Supabase Storage bucket 'payment-proofs'
--   - Add RLS policies for storage access
--   - Add RPC rpc_submit_payment for atomic payment submission
--   - Add RPC rpc_update_registration_status if not already exists (idempotent)

-- ─── 1. Extend registrations table ───────────────────────────────────────────

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payment_submitted_at TIMESTAMPTZ DEFAULT NULL;

-- Ensure registration_status column exists with default 'pending'
-- (It was added in earlier migrations via rpc_update_registration_status, but 
-- let's make sure it's present for new deployments)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'pending';

-- ─── 2. Create Supabase Storage bucket for payment proofs ────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,  -- public so admin can view without signed URLs
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Storage RLS Policies ─────────────────────────────────────────────────

-- Allow authenticated users to upload their own payment proofs
-- Path format: payment-proofs/{tournament_id}/{user_id}/{anything}
DROP POLICY IF EXISTS "Users can upload their own payment proofs" ON storage.objects;
CREATE POLICY "Users can upload their own payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow everyone to view payment proofs (bucket is public)
DROP POLICY IF EXISTS "Payment proofs are publicly readable" ON storage.objects;
CREATE POLICY "Payment proofs are publicly readable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

-- Allow users to update/replace their own proofs
DROP POLICY IF EXISTS "Users can update their own payment proofs" ON storage.objects;
CREATE POLICY "Users can update their own payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- ─── 4. RPC: Submit Payment ───────────────────────────────────────────────────
-- Called by the player after uploading screenshot to storage.
-- Atomically updates the registration row with payment details.

CREATE OR REPLACE FUNCTION public.rpc_submit_payment(
  p_tournament_id UUID,
  p_user_id       UUID,
  p_screenshot_url TEXT,
  p_transaction_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg RECORD;
  v_result JSONB;
BEGIN
  -- Security: only the authenticated user can submit their own payment
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: you can only submit your own payment';
  END IF;

  -- Get existing registration
  SELECT * INTO v_reg
  FROM public.registrations
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No registration found for this tournament';
  END IF;

  -- Prevent resubmission if already approved
  IF v_reg.registration_status = 'approved' THEN
    RAISE EXCEPTION 'Registration already approved — no resubmission needed';
  END IF;

  -- Prevent resubmission if payment already under review
  -- Allow resubmission only if rejected
  IF v_reg.registration_status = 'pending' AND v_reg.payment_screenshot_url IS NOT NULL THEN
    RAISE EXCEPTION 'Payment already submitted and is under review';
  END IF;

  -- Update with payment details
  UPDATE public.registrations
  SET
    payment_screenshot_url = p_screenshot_url,
    transaction_id         = p_transaction_id,
    payment_submitted_at   = NOW(),
    registration_status    = 'pending'
  WHERE tournament_id = p_tournament_id
    AND user_id = p_user_id
  RETURNING to_jsonb(registrations.*) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_payment TO authenticated;

-- ─── 5. Update rpc_update_registration_status to handle notifications ─────────
-- Idempotent replacement that also handles the approved/rejected path cleanly.

DROP FUNCTION IF EXISTS public.rpc_update_registration_status(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.rpc_update_registration_status(
  p_registration_id UUID,
  p_status          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reg       RECORD;
  v_result    JSONB;
  v_caller_id UUID := auth.uid();
  v_is_admin  BOOLEAN;
BEGIN
  -- Check if caller is admin or organizer
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = v_caller_id
      AND r.name IN ('admin', 'organizer')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins or organizers can update registration status';
  END IF;

  -- Validate status
  IF p_status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: must be pending, approved, or rejected';
  END IF;

  UPDATE public.registrations
  SET registration_status = p_status
  WHERE id = p_registration_id
  RETURNING to_jsonb(registrations.*) INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_registration_status TO authenticated;

-- ─── 6. Performance index for admin payment review queries ───────────────────

CREATE INDEX IF NOT EXISTS idx_registrations_payment_status
  ON public.registrations (registration_status, payment_submitted_at DESC)
  WHERE payment_screenshot_url IS NOT NULL;
