-- Add indexes to foreign keys to improve query performance

-- Registrations
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_id ON registrations(tournament_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);

-- Matches
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_player1_id ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2_id ON matches(player2_id);

-- Tournament Stats
CREATE INDEX IF NOT EXISTS idx_tournament_stats_tournament_id ON tournament_stats(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_stats_user_id ON tournament_stats(user_id);

-- Match Submissions
CREATE INDEX IF NOT EXISTS idx_match_submissions_match_id ON match_submissions(match_id);
