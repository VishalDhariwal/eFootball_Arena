-- Migration: 017_revert_tournament.sql
-- Description: RPC to revert a tournament back to registration phase

CREATE OR REPLACE FUNCTION revert_tournament(p_tournament_id UUID)
RETURNS void AS $$
BEGIN
    -- Check permissions (organizer or admin)
    IF NOT (
        EXISTS (SELECT 1 FROM tournaments WHERE id = p_tournament_id AND organizer_id = auth.uid())
        OR 
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = auth.uid() AND r.name = 'admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized to revert this tournament';
    END IF;

    -- Delete associated data (this will cascade to match_submissions, match_detailed_stats, etc. based on schema)
    DELETE FROM tournament_stats WHERE tournament_id = p_tournament_id;
    DELETE FROM brackets WHERE tournament_id = p_tournament_id;
    DELETE FROM matches WHERE tournament_id = p_tournament_id;
    DELETE FROM rounds WHERE tournament_id = p_tournament_id;

    -- Reset tournament status
    UPDATE tournaments SET status = 'registration' WHERE id = p_tournament_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
