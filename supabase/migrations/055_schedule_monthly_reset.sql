-- Migration: 055_schedule_monthly_reset.sql
-- Description: Schedule rpc_end_season to run on the 1st of every month at midnight

-- (Will only execute if pg_cron extension is enabled on the instance)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove the old scheduled job if it exists (assuming it was named 'monthly_season_reset')
        -- Ignore error if it doesn't exist
        BEGIN
            PERFORM cron.unschedule('monthly_season_reset');
        EXCEPTION WHEN OTHERS THEN
            -- Do nothing
        END;

        -- Schedule the new job for the 1st of every month at 00:00 (midnight)
        -- The cron expression '0 0 1 * *' means minute 0, hour 0, day 1, any month, any day of week
        PERFORM cron.schedule(
            'monthly_season_reset', 
            '0 0 1 * *', 
            'SELECT rpc_end_season(''Season '' || to_char(CURRENT_DATE, ''YYYY-MM''))'
        );
    END IF;
END
$$;
