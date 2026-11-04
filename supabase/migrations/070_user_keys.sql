-- ============================================================================
-- 070: Each person's encryption keys (end-to-end encryption, Phase 1)
--
-- docs/end-to-end-encryption.md. Nothing is encrypted yet: this keeps, for
-- each person who sets keys up, what the server is allowed to hold of them.
--
--   user_keys   one row a person:
--     encrypt_public, sign_public   their two PUBLIC keys (ECDH and ECDSA
--                   P-256, SPKI, base64url). Others lock vault keys for them
--                   with the first and check their signatures with the second
--                   (later phases).
--     fingerprint   the first 15 bytes of SHA-256("<encrypt>.<sign>"),
--                   base64url, as vault-crypto.ts's identityFingerprint()
--                   makes it; checked here, so a row cannot carry a
--                   fingerprint of other keys.
--     backup        their private keys, locked on their own device with their
--                   Recovery Key ("r1." … from vault-crypto.ts's
--                   sealIdentity()). The server cannot open it: the Recovery
--                   Key never leaves the person. It opens only as theirs (the
--                   account id is sealed in).
--     key_version   1 for now; a later phase replaces keys under a new one.
--
-- Rules, kept here rather than in the app:
--   * Written only through the functions below, which take the caller from
--     auth.uid() (CLAUDE.md, point 2). No client INSERT, UPDATE or DELETE.
--   * The backup is read only by its owner, through my_identity(): the
--     column grant leaves it out, so not even a vault-mate's SELECT reaches
--     it. Public keys are read by their owner and by people who share a
--     vault with them (who will lock vault keys for them).
--   * Set up once: a second register_my_identity() is refused (HINT
--     identity_exists). A new Recovery Key re-locks the SAME keys
--     (update_my_identity_backup()); delete_my_identity() is for test builds
--     while nothing is encrypted, and later phases will refuse it once a
--     person holds vault keys.
--   * A row goes with the account (ON DELETE CASCADE on auth.users), like
--     everything else an account has (029, 030).
--
-- Apply: paste into the SQL editor — DEV, then PROD. Safe to run more than
-- once. Without it the app's Encryption keys screen (test builds only) says
-- keys aren't switched on yet.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_keys (
  user_id        uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  encrypt_public text NOT NULL,
  sign_public    text NOT NULL,
  fingerprint    text NOT NULL,
  backup         text NOT NULL,
  key_version    integer NOT NULL DEFAULT 1 CHECK (key_version >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- A P-256 public key in SPKI is 91 bytes: 122 characters of base64url.
  CONSTRAINT user_keys_encrypt_public_shape CHECK (encrypt_public ~ '^[A-Za-z0-9_-]{100,200}$'),
  CONSTRAINT user_keys_sign_public_shape    CHECK (sign_public ~ '^[A-Za-z0-9_-]{100,200}$'),
  CONSTRAINT user_keys_fingerprint_shape    CHECK (fingerprint ~ '^[A-Za-z0-9_-]{20}$'),
  -- "r1." + 16-byte salt + "." + a sealed item (988 characters in all
  -- today). Postgres allows at most 255 repeats in a pattern, so the length
  -- is checked apart.
  CONSTRAINT user_keys_backup_shape         CHECK (backup ~ '^r1\.[A-Za-z0-9_-]{22}\.e1\.[A-Za-z0-9_-]+$'
                                                   AND length(backup) BETWEEN 300 AND 4000)
);

ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

-- Supabase grants every table to anon and authenticated explicitly, so
-- revoke them by name (CLAUDE.md, the migration gap).
REVOKE ALL ON public.user_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT (user_id, encrypt_public, sign_public, fingerprint, key_version, created_at, updated_at)
  ON public.user_keys TO authenticated;
GRANT ALL ON public.user_keys TO service_role;

DROP POLICY IF EXISTS user_keys_read ON public.user_keys;
CREATE POLICY user_keys_read ON public.user_keys
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
        FROM public.family_members me
        JOIN public.family_members them ON them.family_id = me.family_id
       WHERE me.user_id = auth.uid()
         AND them.user_id = user_keys.user_id
    )
  );

-- The fingerprint of a pair of public keys, as identityFingerprint() makes it.
CREATE OR REPLACE FUNCTION public.identity_fingerprint(p_encrypt_public text, p_sign_public text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $fn$
  SELECT translate(
           rtrim(encode(substring(sha256(convert_to(p_encrypt_public || '.' || p_sign_public, 'UTF8')) FROM 1 FOR 15), 'base64'), '='),
           '+/', '-_');
$fn$;

REVOKE ALL ON FUNCTION public.identity_fingerprint(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_fingerprint(text, text) TO service_role;

-- Set up: the caller's public keys and their Recovery-Key-locked backup.
CREATE OR REPLACE FUNCTION public.register_my_identity(
  p_encrypt_public text,
  p_sign_public    text,
  p_fingerprint    text,
  p_backup         text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF p_fingerprint IS DISTINCT FROM public.identity_fingerprint(p_encrypt_public, p_sign_public) THEN
    RAISE EXCEPTION 'These keys do not match their fingerprint.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_keys WHERE user_id = v_me) THEN
    RAISE EXCEPTION 'Your keys are already set up. Unlock this device with your Recovery Key.'
      USING ERRCODE = 'P0001', HINT = 'identity_exists';
  END IF;

  BEGIN
    INSERT INTO public.user_keys (user_id, encrypt_public, sign_public, fingerprint, backup)
    VALUES (v_me, p_encrypt_public, p_sign_public, p_fingerprint, p_backup);
  EXCEPTION
    WHEN check_violation THEN
      RAISE EXCEPTION 'These keys are not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Your keys are already set up. Unlock this device with your Recovery Key.'
        USING ERRCODE = 'P0001', HINT = 'identity_exists';
  END;

  INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
  VALUES (v_me, 'identity_registered', 'user_keys', jsonb_build_object('fingerprint', p_fingerprint));
  RETURN 1;
END;
$fn$;

-- The caller's own keys, the backup included, for a new device to unlock
-- with the Recovery Key. Nothing when the caller has not set keys up.
CREATE OR REPLACE FUNCTION public.my_identity()
RETURNS TABLE (
  encrypt_public text,
  sign_public    text,
  fingerprint    text,
  backup         text,
  key_version    integer,
  created_at     timestamptz,
  updated_at     timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT k.encrypt_public, k.sign_public, k.fingerprint, k.backup, k.key_version, k.created_at, k.updated_at
    FROM public.user_keys k
   WHERE k.user_id = auth.uid();
$fn$;

-- A new Recovery Key: the same keys, locked again on the device.
CREATE OR REPLACE FUNCTION public.update_my_identity_backup(p_backup text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.user_keys SET backup = p_backup, updated_at = now() WHERE user_id = v_me;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This backup is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Your keys are not set up yet.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, resource_type)
  VALUES (v_me, 'identity_backup_changed', 'user_keys');
END;
$fn$;

-- Test builds only, while nothing is encrypted: forget the caller's keys.
CREATE OR REPLACE FUNCTION public.delete_my_identity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_keys WHERE user_id = v_me;
  IF FOUND THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type)
    VALUES (v_me, 'identity_deleted', 'user_keys');
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.register_my_identity(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_my_identity_backup(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_my_identity(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_identity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_my_identity_backup(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_my_identity() TO authenticated, service_role;
