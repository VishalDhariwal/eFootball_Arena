-- Migration: 048_tournament_prizes.sql
-- Description: Add prize_first and prize_second columns to tournaments table.
--   - prize_first: optional 1st place prize (decimal, nullable)
--   - prize_second: optional 2nd place prize (decimal, nullable)
--   entry_fee already exists from the initial schema.

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS prize_first DECIMAL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prize_second DECIMAL DEFAULT NULL;
