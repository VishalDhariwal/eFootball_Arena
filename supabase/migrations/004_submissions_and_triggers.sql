-- Migration: 004_submissions_and_triggers.sql
-- Description: Storage setup for screenshots and auto-verification trigger.

-- 1. Setup Storage for Screenshots
INSERT INTO storage.buckets (id, name, public) 
VALUES ('match_screenshots', 'match_screenshots', true) 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects (it usually is by default, but let's be explicit)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public Access" 
  ON storage.objects FOR SELECT 
  USING ( bucket_id = 'match_screenshots' );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated Users can upload screenshots" 
  ON storage.objects FOR INSERT 
  WITH CHECK ( bucket_id = 'match_screenshots' AND auth.role() = 'authenticated' );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Create the Auto-Verification Trigger
CREATE OR REPLACE FUNCTION verify_match_score()
RETURNS TRIGGER AS $$
DECLARE
    v_other_submission RECORD;
    v_match RECORD;
    v_winner_id UUID;
    v_p1_score INT;
    v_p2_score INT;
    v_clean_new_score TEXT;
    v_clean_other_score TEXT;
BEGIN
    -- Remove spaces for clean comparison
    v_clean_new_score := REPLACE(NEW.score_reported, ' ', '');

    -- Check if there is another submission for this match by the opponent
    SELECT * INTO v_other_submission
    FROM match_submissions
    WHERE match_id = NEW.match_id AND player_id != NEW.player_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_clean_other_score := REPLACE(v_other_submission.score_reported, ' ', '');
        
        -- Both have submitted
        IF v_clean_new_score = v_clean_other_score THEN
            -- Scores match. Determine winner based on the score format "P1-P2"
            SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;

            BEGIN
                v_p1_score := split_part(v_clean_new_score, '-', 1)::INT;
                v_p2_score := split_part(v_clean_new_score, '-', 2)::INT;
            EXCEPTION WHEN OTHERS THEN
                -- If parsing fails, flag as disputed
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END;

            IF v_p1_score > v_p2_score THEN
                v_winner_id := v_match.player1_id;
            ELSIF v_p2_score > v_p1_score THEN
                v_winner_id := v_match.player2_id;
            ELSE
                -- Draw - flag as disputed
                UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
                RETURN NEW;
            END IF;

            -- Update match
            UPDATE matches SET status = 'verified', winner_id = v_winner_id WHERE id = NEW.match_id;

            -- Advance the winner in the bracket
            DECLARE
                v_next_match_id UUID;
                v_position INT;
            BEGIN
                SELECT next_match_id, position INTO v_next_match_id, v_position 
                FROM brackets WHERE match_id = NEW.match_id;

                IF v_next_match_id IS NOT NULL THEN
                    -- If v_position is odd, winner becomes player1. If even, player2.
                    IF v_position % 2 = 1 THEN
                        UPDATE matches SET player1_id = v_winner_id WHERE id = v_next_match_id;
                    ELSE
                        UPDATE matches SET player2_id = v_winner_id WHERE id = v_next_match_id;
                    END IF;
                    
                    -- Run sweep to auto-resolve any empty branches this winner just entered
                    PERFORM sweep_bracket(v_match.tournament_id);
                END IF;
            END;
        ELSE
            -- Scores mismatch
            UPDATE matches SET status = 'disputed' WHERE id = NEW.match_id;
        END IF;
    ELSE
        -- Only one submission so far
        UPDATE matches SET status = 'waiting_submission' WHERE id = NEW.match_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS match_verification_trigger ON match_submissions;

CREATE TRIGGER match_verification_trigger
AFTER INSERT ON match_submissions
FOR EACH ROW
EXECUTE FUNCTION verify_match_score();
