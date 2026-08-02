-- Migration: 051_whatsapp_group.sql
-- Description: Add WhatsApp group link access control for tournaments

-- 1. Extend tournaments table to indicate if a WhatsApp group exists
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS has_whatsapp_group boolean DEFAULT false;

-- 2. Create tournament_secrets table to store sensitive tournament data like the WhatsApp link
CREATE TABLE IF NOT EXISTS public.tournament_secrets (
    tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
    whatsapp_group_link text
);

-- 3. Enable RLS on tournament_secrets
ALTER TABLE public.tournament_secrets ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Admins and Organizers can manage tournament secrets
DROP POLICY IF EXISTS "Admins and organizers can manage tournament secrets" ON public.tournament_secrets;
CREATE POLICY "Admins and organizers can manage tournament secrets"
ON public.tournament_secrets
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid()
          AND r.name IN ('admin', 'organizer')
    )
);

-- Approved players can view tournament secrets for the specific tournament they are approved in
DROP POLICY IF EXISTS "Approved players can view tournament secrets" ON public.tournament_secrets;
CREATE POLICY "Approved players can view tournament secrets"
ON public.tournament_secrets
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.registrations
        WHERE tournament_id = tournament_secrets.tournament_id
          AND user_id = auth.uid()
          AND registration_status = 'approved'
    )
);
