-- Migration: 054_auto_delete_screenshots.sql
-- Description: Update rpc_update_tournament_status to automatically delete payment screenshots from storage and clear urls from registrations when tournament is completed.

CREATE OR REPLACE FUNCTION rpc_update_tournament_status(
    p_tournament_id UUID,
    p_status TEXT
)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_is_admin BOOLEAN;
BEGIN
    -- Validate status
    IF p_status NOT IN ('upcoming', 'registration', 'live', 'completed') THEN
        RAISE EXCEPTION 'Invalid tournament status.';
    END IF;

    SELECT organizer_id INTO v_organizer_id
    FROM tournaments WHERE id = p_tournament_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tournament not found.';
    END IF;

    -- Check authorization
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name = 'admin'
    ) INTO v_is_admin;

    IF auth.uid() != v_organizer_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Only organizers or admins can update tournament status.';
    END IF;

    UPDATE tournaments SET status = p_status WHERE id = p_tournament_id;

    -- If the tournament is marked as completed, delete the payment screenshots
    IF p_status = 'completed' THEN
        -- Delete the files from the storage bucket
        DELETE FROM storage.objects 
        WHERE bucket_id = 'payment-proofs' 
          AND name LIKE (p_tournament_id::text || '/%');
        
        -- Clear the screenshot URLs from the registrations to avoid broken images
        UPDATE registrations
        SET payment_screenshot_url = NULL
        WHERE tournament_id = p_tournament_id
          AND payment_screenshot_url IS NOT NULL;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
