-- Migration: 007_engagement_systems.sql
-- Description: ELO Ratings, Notifications, and Achievements

-- 1. ELO Rating
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_rating INT DEFAULT 1000;

-- 2. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    condition_type TEXT NOT NULL,
    condition_value INT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, achievement_id)
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Achievements viewable by all" ON achievements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "User achievements viewable by all" ON user_achievements FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Insert base achievements
INSERT INTO achievements (name, description, icon_name, condition_type, condition_value) VALUES
('First Blood', 'Win your first match', 'trophy', 'wins', 1),
('Veteran', 'Win 10 matches', 'medal', 'wins', 10),
('Champion', 'Win a tournament', 'crown', 'tournament_wins', 1)
ON CONFLICT (name) DO NOTHING;

-- Enable Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 4. Match Verification Trigger (Handles ELO, Notifications, Achievements)
CREATE OR REPLACE FUNCTION process_verified_match()
RETURNS TRIGGER AS $$
DECLARE
    v_loser_id UUID;
    v_winner_elo INT;
    v_loser_elo INT;
    v_expected_score_winner FLOAT;
    v_expected_score_loser FLOAT;
    v_new_winner_elo INT;
    v_new_loser_elo INT;
    v_k_factor INT := 32;
    v_total_wins INT;
BEGIN
    -- Only run when status changes to 'verified'
    IF NEW.status = 'verified' AND OLD.status != 'verified' THEN
        
        -- Determine loser
        IF NEW.winner_id = NEW.player1_id THEN
            v_loser_id := NEW.player2_id;
        ELSE
            v_loser_id := NEW.player1_id;
        END IF;

        -- Create Notifications
        IF NEW.winner_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, message) 
            VALUES (NEW.winner_id, 'match_won', 'Your match was verified. You won!');
        END IF;

        IF v_loser_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, message) 
            VALUES (v_loser_id, 'match_lost', 'Your match was verified. You lost.');
        END IF;

        -- Calculate ELO if both players exist (not a BYE)
        IF NEW.winner_id IS NOT NULL AND v_loser_id IS NOT NULL THEN
            SELECT elo_rating INTO v_winner_elo FROM profiles WHERE id = NEW.winner_id;
            SELECT elo_rating INTO v_loser_elo FROM profiles WHERE id = v_loser_id;

            -- Default to 1000 if null for some reason
            v_winner_elo := COALESCE(v_winner_elo, 1000);
            v_loser_elo := COALESCE(v_loser_elo, 1000);

            v_expected_score_winner := 1.0 / (1.0 + power(10.0, (v_loser_elo - v_winner_elo) / 400.0));
            v_expected_score_loser := 1.0 / (1.0 + power(10.0, (v_winner_elo - v_loser_elo) / 400.0));

            v_new_winner_elo := v_winner_elo + round(v_k_factor * (1 - v_expected_score_winner));
            v_new_loser_elo := v_loser_elo + round(v_k_factor * (0 - v_expected_score_loser));

            UPDATE profiles SET elo_rating = v_new_winner_elo WHERE id = NEW.winner_id;
            UPDATE profiles SET elo_rating = v_new_loser_elo WHERE id = v_loser_id;
        END IF;

        -- Check Achievements for Winner
        IF NEW.winner_id IS NOT NULL THEN
            SELECT count(*) INTO v_total_wins FROM matches WHERE winner_id = NEW.winner_id AND status = 'verified';
            
            IF v_total_wins = 1 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'First Blood'
                ON CONFLICT DO NOTHING;
            END IF;

            IF v_total_wins = 10 THEN
                INSERT INTO user_achievements (user_id, achievement_id)
                SELECT NEW.winner_id, id FROM achievements WHERE name = 'Veteran'
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS match_verified_trigger ON matches;
CREATE TRIGGER match_verified_trigger
AFTER UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION process_verified_match();
