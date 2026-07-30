-- Migration: 027_expand_match_stats.sql
-- Description: Expand match_detailed_stats schema to support new OCR fields

-- 1. Rename existing columns to match the RPC arguments
ALTER TABLE match_detailed_stats 
  RENAME COLUMN goals TO goals_scored;

ALTER TABLE match_detailed_stats 
  RENAME COLUMN passes_completed TO pass_accuracy;

-- Change pass_accuracy type from INT to DECIMAL
ALTER TABLE match_detailed_stats 
  ALTER COLUMN pass_accuracy TYPE DECIMAL USING pass_accuracy::DECIMAL;

-- 2. Add the new columns that OCR now extracts
ALTER TABLE match_detailed_stats
  ADD COLUMN IF NOT EXISTS goals_conceded INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interceptions INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fouls INT DEFAULT 0;
