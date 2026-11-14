-- ============================================================================
-- 075: notifications in the Android app, sent straight to Google's FCM
--
-- 034's reminders reach a browser by Web Push. The Android app has no
-- browser push service, so a phone there gets a Firebase Cloud Messaging
-- registration token, and the push Edge Function sends to Google's FCM
-- HTTP v1 API with this project's own Firebase service account. Nothing
-- passes through anyone else's push service.
--
--   • push_subscriptions gets `kind`: 'webpush' (every row before this) or
--     'fcm'. An fcm row keeps its token in `endpoint`, the device's address
--     as before, so 034's one-row-per-device rule (UNIQUE endpoint) and
--     050's newest 10 a person hold for both. Its token is never a URL —
--     the server posts only to fcm.googleapis.com and names the token in
--     the body — and it has no Web Push keys.
--   • save_fcm_token() saves the caller's own token, from auth.uid(), as
--     save_push_subscription() does: a token is one installed app, so when
--     someone else signs in there it moves to them.
--   • push_pending() keeps its shape and returns Web Push devices only, so
--     a push function deployed before this one never posts a token to a
--     Web Push address. push_pending_devices() returns both kinds, with
--     the kind; the push function deployed with this reads it.
--
-- Clients still only SELECT and DELETE their own rows (034's policies);
-- the new function is the caller's own; everything else is service role
-- only. The 023 sweep stays at zero.
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both.
-- Idempotent.
-- ============================================================================

BEGIN;

-- ─── 1. A device is a browser or an installed Android app ──────────────────

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'webpush';

ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_kind_check;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_kind_check CHECK (kind IN ('webpush', 'fcm'));

ALTER TABLE public.push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN auth DROP NOT NULL;

-- 034's endpoint check named only browsers' push services. It moves into
-- one check per kind: a Web Push row as before, with its two keys; an FCM
-- row a token (letters, digits and _ : . -, no slash, so never an address)
-- with none. 034's own checks on p256dh and auth stay, and pass on NULL.
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_check;
ALTER TABLE public.push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_device_shape;
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_device_shape CHECK (
    (kind = 'webpush'
       AND length(endpoint) <= 2000
       AND endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)/'
       AND p256dh IS NOT NULL AND auth IS NOT NULL)
    OR
    (kind = 'fcm'
       AND length(endpoint) BETWEEN 32 AND 4096
       AND endpoint ~ '^[A-Za-z0-9_:.-]+$'
       AND p256dh IS NULL AND auth IS NULL)
  );


-- ─── 2. Saving the Android app's token: the caller's own ───────────────────

CREATE OR REPLACE FUNCTION public.save_fcm_token(p_token text, p_label text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me    uuid := auth.uid();
  v_token text := btrim(coalesce(p_token, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to turn on reminders.' USING ERRCODE = '42501';
  END IF;
  IF length(v_token) NOT BETWEEN 32 AND 4096 OR v_token !~ '^[A-Za-z0-9_:.-]+$' THEN
    RAISE EXCEPTION 'This phone did not give a notification address AskLocker can use.'
      USING ERRCODE = '22023', HINT = 'bad_token';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, kind, endpoint, p256dh, auth, label)
  VALUES (v_me, 'fcm', v_token, NULL, NULL, nullif(left(btrim(coalesce(p_label, '')), 80), ''))
  ON CONFLICT (endpoint) DO UPDATE
     SET user_id = excluded.user_id, kind = 'fcm', p256dh = NULL, auth = NULL,
         label = excluded.label, created_at = now(), last_used_at = NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.save_fcm_token(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_fcm_token(text, text) TO authenticated, service_role;


-- ─── 3. What is waiting, by kind ───────────────────────────────────────────

-- 034's shape, Web Push devices only: a push function from before 075 reads
-- this and sends Web Push to every row it gets.
CREATE OR REPLACE FUNCTION public.push_pending(p_limit integer DEFAULT 100)
RETURNS TABLE (
  notification_id uuid, kind text, title text, message text, document_ref uuid, family_id uuid,
  subscription_id uuid, endpoint text, p256dh text, auth text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH waiting AS (
    SELECT n.id, n.type, n.title, n.message, n.document_ref, n.family_id, n.user_id, n.created_at
      FROM public.notifications n
      JOIN public.users u ON u.id = n.user_id
     WHERE n.pushed_at IS NULL
       AND n.created_at > now() - interval '1 day'
       AND NOT coalesce(n.is_read, false)
       AND coalesce(u.notifications_enabled, true)
       AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = n.user_id AND s.kind = 'webpush')
     ORDER BY n.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
  )
  SELECT w.id, w.type::text, w.title::text, w.message, w.document_ref, w.family_id,
         s.id, s.endpoint, s.p256dh, s.auth
    FROM waiting w
    JOIN public.push_subscriptions s ON s.user_id = w.user_id AND s.kind = 'webpush'
   ORDER BY w.created_at, s.created_at;
$fn$;

-- Every device, with its kind: what the push function deployed with 075
-- reads. The limit counts notifications, so none is half sent.
CREATE OR REPLACE FUNCTION public.push_pending_devices(p_limit integer DEFAULT 100)
RETURNS TABLE (
  notification_id uuid, kind text, title text, message text, document_ref uuid, family_id uuid,
  subscription_id uuid, device_kind text, endpoint text, p256dh text, auth text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  WITH waiting AS (
    SELECT n.id, n.type, n.title, n.message, n.document_ref, n.family_id, n.user_id, n.created_at
      FROM public.notifications n
      JOIN public.users u ON u.id = n.user_id
     WHERE n.pushed_at IS NULL
       AND n.created_at > now() - interval '1 day'
       AND NOT coalesce(n.is_read, false)
       AND coalesce(u.notifications_enabled, true)
       AND EXISTS (SELECT 1 FROM public.push_subscriptions s WHERE s.user_id = n.user_id)
     ORDER BY n.created_at
     LIMIT greatest(1, least(coalesce(p_limit, 100), 500))
  )
  SELECT w.id, w.type::text, w.title::text, w.message, w.document_ref, w.family_id,
         s.id, s.kind, s.endpoint, s.p256dh, s.auth
    FROM waiting w
    JOIN public.push_subscriptions s ON s.user_id = w.user_id
   ORDER BY w.created_at, s.created_at;
$fn$;

REVOKE ALL ON FUNCTION public.push_pending(integer)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.push_pending_devices(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_pending(integer)         TO service_role;
GRANT EXECUTE ON FUNCTION public.push_pending_devices(integer) TO service_role;

COMMIT;
