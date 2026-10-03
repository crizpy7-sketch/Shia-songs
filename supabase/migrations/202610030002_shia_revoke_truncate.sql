-- Separate security approval required. TRUNCATE bypasses row-level security.
-- This changes only the confirmed SHIA order grant; preserves other admin privileges.
BEGIN;
REVOKE TRUNCATE ON TABLE public.shia_song_orders FROM authenticated;
COMMIT;
