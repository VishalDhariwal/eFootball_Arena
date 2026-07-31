-- Migration: 046_auto_approve_users.sql
-- Description: Changes default profile status to 'approved' so users don't need admin approval to login.

-- Change the default value for new users
ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'approved';

-- Approve all currently pending users
UPDATE profiles SET status = 'approved' WHERE status = 'pending';
