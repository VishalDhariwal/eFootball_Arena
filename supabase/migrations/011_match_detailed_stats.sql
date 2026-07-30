-- Migration: 011_match_detailed_stats.sql
-- Description: Store detailed stats extracted from match screenshots.

CREATE TABLE IF NOT EXISTS match_detailed_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    goals INT DEFAULT 0,
    possession INT DEFAULT 0,
    shots INT DEFAULT 0,
    shots_on_target INT DEFAULT 0,
    passes INT DEFAULT 0,
    passes_completed INT DEFAULT 0,
    tackles INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(match_id, player_id)
);

ALTER TABLE match_detailed_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Stats viewable by all" ON match_detailed_stats FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own stats" ON match_detailed_stats FOR INSERT WITH CHECK (auth.uid() = player_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;
