-- Migration: 012_access_control.sql
-- Description: Access control, registration approval flow, and extended stats.

-- 1. Add status column to profiles (pending = awaiting admin approval, approved = can access, rejected = denied)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

-- Give existing users approved status (they were already active before this migration)
UPDATE profiles SET status = 'approved' WHERE status = 'pending';

-- 2. Add registration_status to registrations (replaces payment_status as the approval mechanism)
--    pending = awaiting organizer/admin approval
--    approved = can participate in tournament
--    rejected = denied
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'pending';

-- Migrate existing 'paid' payment_status rows to 'approved'
UPDATE registrations SET registration_status = 'approved' WHERE payment_status = 'paid';
UPDATE registrations SET registration_status = 'rejected' WHERE payment_status = 'rejected';

-- 3. Extend match_detailed_stats with more fields from the eFootball stats screen
ALTER TABLE match_detailed_stats 
  ADD COLUMN IF NOT EXISTS fouls INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interceptions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corners INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offsides INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_kicks INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS crosses INTEGER DEFAULT 0;

-- 4. RLS policy for admin to update profile status
DO $$ BEGIN
  CREATE POLICY "Service role can update profile status" 
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. RLS policy for organizer/admin to update registration status
DO $$ BEGIN
  CREATE POLICY "Organizers can update registration status"
  ON registrations FOR UPDATE
  USING (true)
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;
