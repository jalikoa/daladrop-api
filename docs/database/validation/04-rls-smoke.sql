-- RLS smoke checks (read-only metadata)

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'users','sessions','orders','rides','payments','notifications',
    'saved_places','saved_items','menu_favourites','event_bookings',
    'wallets','wallet_transactions','merchants','stores','age_verifications'
  )
ORDER BY 1;

SELECT schemaname, tablename, policyname, cmd, qual IS NOT NULL AS has_using
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Helper functions present
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE 'daladrop_%'
ORDER BY 1;
