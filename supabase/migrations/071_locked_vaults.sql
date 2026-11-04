-- ============================================================================
-- 071: Locked vaults (end-to-end encryption, Phases 1, 2 and 4)
--
-- docs/end-to-end-encryption.md, "The design, as built". A vault its owner
-- locks keeps its documents sealed on members' phones: the server stores
-- what it cannot open. Test builds only, and only where this project allows
-- it: e2e_config.locking_allowed is false until someone sets it, so on PROD
-- nothing here is reachable but the tables.
--
--   e2e_config          one row: may vaults be locked on this project?
--   user_keys           070's; the backup key is now optional, and a person
--                       who lost every way back makes new keys
--                       (replace_my_identity)
--   key_unlocks         a person's identity sealed with a key their phone's
--                       lock gives (a passkey's PRF output); their own only
--   key_device_requests a new device asking a signed-in one for the keys;
--                       answered with the identity locked for the new
--                       device's one-time key
--   locked_vaults       which vaults are locked, by whom, and when every
--                       older document was moved
--   vault_keys          each locked vault's key versions (the keys
--                       themselves never reach the server)
--   vault_key_grants    a version's key locked for one member ("g1."),
--                       read only by that member
--   sealed_documents    a locked document's file key (locked with the vault
--                       key), its sealed details and its sealed passages
--
-- Rules, kept here rather than in the app:
--   * Every write goes through a function below that takes the caller from
--     auth.uid() (CLAUDE.md, point 2). No client INSERT, UPDATE or DELETE on
--     any table here.
--   * Only a vault's owner locks it, once, and only where e2e_config allows.
--   * A member locks the vault key for another member who has none; for a
--     member whose keys CHANGED since an earlier grant (a new phone after
--     losing everything), only an admin may: that is the approval which
--     stops a server slipping its own key in as someone's new phone.
--   * A locked vault takes sealed documents only (insert_family_document
--     refuses a readable one, HINT vault_locked), and no server reader
--     touches a sealed one (start_document_read, rag_documents_to_ingest).
--   * Moving an older document into the lock (seal_existing_document)
--     deletes the server's readable text, passages, details and expiry
--     alerts, and turns off its share links.
--
-- Apply: paste into the SQL editor — DEV, then PROD (so the fingerprint
-- keeps matching). Then, on DEV only:
--     update public.e2e_config set locking_allowed = true, updated_at = now();
-- Safe to run more than once.
-- ============================================================================


-- ─── 1. The switch ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.e2e_config (
  only_row        boolean PRIMARY KEY DEFAULT true CHECK (only_row),
  locking_allowed boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.e2e_config (only_row) VALUES (true) ON CONFLICT DO NOTHING;

ALTER TABLE public.e2e_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.e2e_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.e2e_config TO authenticated;
GRANT ALL ON public.e2e_config TO service_role;
DROP POLICY IF EXISTS e2e_config_read ON public.e2e_config;
CREATE POLICY e2e_config_read ON public.e2e_config FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.e2e_locking_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT coalesce((SELECT c.locking_allowed FROM public.e2e_config c LIMIT 1), false);
$fn$;
REVOKE ALL ON FUNCTION public.e2e_locking_allowed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e2e_locking_allowed() TO service_role;


-- ─── 2. Tables ──────────────────────────────────────────────────────────────

-- The backup key is offered once and may be skipped (the owner, 4 November
-- 2026): the phone's lock and another device are the everyday ways back.
ALTER TABLE public.user_keys ALTER COLUMN backup DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.locked_vaults (
  family_id uuid PRIMARY KEY REFERENCES public.families (id) ON DELETE CASCADE,
  locked_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  moved_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.vault_keys (
  family_id  uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
  version    integer NOT NULL CHECK (version >= 1),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, version)
);

-- "g1." + the ephemeral key (SPKI, 122 characters) + "." + a 16-byte salt
-- + "." + a sealed item, as grantVaultKey() makes it.
CREATE TABLE IF NOT EXISTS public.vault_key_grants (
  family_id        uuid NOT NULL,
  version          integer NOT NULL,
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  identity_version integer NOT NULL CHECK (identity_version >= 1),
  key_grant        text NOT NULL,
  granted_by       uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, version, user_id),
  FOREIGN KEY (family_id, version) REFERENCES public.vault_keys (family_id, version) ON DELETE CASCADE,
  CONSTRAINT vault_key_grants_shape CHECK (
    key_grant ~ '^g1\.[A-Za-z0-9_-]{100,200}\.[A-Za-z0-9_-]{22}\.e1\.[A-Za-z0-9_-]+$'
    AND length(key_grant) BETWEEN 150 AND 2000)
);

CREATE TABLE IF NOT EXISTS public.sealed_documents (
  family_id     uuid NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
  document_id   uuid NOT NULL,
  key_version   integer NOT NULL,
  file_key      text NOT NULL,
  details       text NOT NULL,
  passages      text,
  passage_count integer NOT NULL DEFAULT 0 CHECK (passage_count BETWEEN 0 AND 5000),
  added_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, document_id),
  FOREIGN KEY (family_id, key_version) REFERENCES public.vault_keys (family_id, version) ON DELETE CASCADE,
  CONSTRAINT sealed_documents_file_key_shape CHECK (file_key ~ '^e1\.[A-Za-z0-9_-]+$' AND length(file_key) BETWEEN 40 AND 200),
  CONSTRAINT sealed_documents_details_shape  CHECK (details ~ '^e1\.[A-Za-z0-9_-]+$' AND length(details) BETWEEN 30 AND 400000),
  CONSTRAINT sealed_documents_passages_shape CHECK (passages IS NULL
    OR (passages ~ '^e1\.[A-Za-z0-9_-]+$' AND length(passages) <= 8000000))
);

CREATE TABLE IF NOT EXISTS public.key_device_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  request_key text NOT NULL CHECK (request_key ~ '^[A-Za-z0-9_-]{100,200}$'),
  label       text CHECK (label IS NULL OR length(label) <= 60),
  answer      text CHECK (answer IS NULL OR (answer ~ '^l1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.e1\.[A-Za-z0-9_-]+$' AND length(answer) <= 8000)),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS key_device_requests_user ON public.key_device_requests (user_id);

CREATE TABLE IF NOT EXISTS public.key_unlocks (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  credential_id    text NOT NULL,
  prf_salt         text NOT NULL CHECK (prf_salt ~ '^[A-Za-z0-9_-]{43}$'),
  sealed_identity  text NOT NULL,
  identity_version integer NOT NULL CHECK (identity_version >= 1),
  label            text CHECK (label IS NULL OR length(label) <= 60),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, credential_id),
  CONSTRAINT key_unlocks_credential_shape CHECK (credential_id ~ '^[A-Za-z0-9_-]+$' AND length(credential_id) BETWEEN 16 AND 1400),
  CONSTRAINT key_unlocks_sealed_shape     CHECK (sealed_identity ~ '^e1\.[A-Za-z0-9_-]+$' AND length(sealed_identity) BETWEEN 300 AND 4000)
);

ALTER TABLE public.locked_vaults       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vault_key_grants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sealed_documents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_device_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_unlocks         ENABLE ROW LEVEL SECURITY;

-- Supabase grants every table to anon and authenticated explicitly, so
-- revoke them by name, then give back reads only.
REVOKE ALL ON public.locked_vaults, public.vault_keys, public.vault_key_grants, public.sealed_documents,
              public.key_device_requests, public.key_unlocks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.locked_vaults, public.vault_keys, public.vault_key_grants, public.sealed_documents,
                public.key_device_requests, public.key_unlocks TO authenticated;
GRANT ALL ON public.locked_vaults, public.vault_keys, public.vault_key_grants, public.sealed_documents,
             public.key_device_requests, public.key_unlocks TO service_role;

DROP POLICY IF EXISTS locked_vaults_members ON public.locked_vaults;
CREATE POLICY locked_vaults_members ON public.locked_vaults FOR SELECT TO authenticated
  USING (family_id IN (SELECT public.get_my_family_ids()));
DROP POLICY IF EXISTS vault_keys_members ON public.vault_keys;
CREATE POLICY vault_keys_members ON public.vault_keys FOR SELECT TO authenticated
  USING (family_id IN (SELECT public.get_my_family_ids()));
DROP POLICY IF EXISTS vault_key_grants_own ON public.vault_key_grants;
CREATE POLICY vault_key_grants_own ON public.vault_key_grants FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND family_id IN (SELECT public.get_my_family_ids()));
DROP POLICY IF EXISTS sealed_documents_members ON public.sealed_documents;
CREATE POLICY sealed_documents_members ON public.sealed_documents FOR SELECT TO authenticated
  USING (family_id IN (SELECT public.get_my_family_ids()));
DROP POLICY IF EXISTS key_device_requests_own ON public.key_device_requests;
CREATE POLICY key_device_requests_own ON public.key_device_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS key_unlocks_own ON public.key_unlocks;
CREATE POLICY key_unlocks_own ON public.key_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ─── 3. A person's keys ─────────────────────────────────────────────────────

-- Delete keys (test builds): refused once they open a locked vault, where
-- new keys (replace_my_identity) are the way, so the vault's admins see it.
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
  IF EXISTS (SELECT 1 FROM public.vault_key_grants g WHERE g.user_id = v_me) THEN
    RAISE EXCEPTION 'Your keys open a locked vault. Make new keys instead.'
      USING ERRCODE = 'P0001', HINT = 'holds_vault_keys';
  END IF;
  DELETE FROM public.key_unlocks WHERE user_id = v_me;
  DELETE FROM public.key_device_requests WHERE user_id = v_me;
  DELETE FROM public.user_keys WHERE user_id = v_me;
  IF FOUND THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type)
    VALUES (v_me, 'identity_deleted', 'user_keys');
  END IF;
END;
$fn$;

-- New keys, for someone who lost every way back to the old ones. Their
-- phone-lock unlocks and device requests were for the old keys and go.
-- Their vault grants stay, unopenable: they are the record that this
-- person's keys changed, so only an admin locks a vault key for the new
-- ones (grant_vault_key). The admins of every locked vault they are in are
-- asked to let them back in.
CREATE OR REPLACE FUNCTION public.replace_my_identity(
  p_encrypt_public text,
  p_sign_public    text,
  p_fingerprint    text,
  p_backup         text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_version integer;
  v_name    text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF p_fingerprint IS DISTINCT FROM public.identity_fingerprint(p_encrypt_public, p_sign_public) THEN
    RAISE EXCEPTION 'These keys do not match their fingerprint.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END IF;
  BEGIN
    UPDATE public.user_keys
       SET encrypt_public = p_encrypt_public, sign_public = p_sign_public, fingerprint = p_fingerprint,
           backup = p_backup, key_version = key_version + 1, updated_at = now()
     WHERE user_id = v_me
    RETURNING key_version INTO v_version;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'These keys are not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Your keys are not set up yet.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;

  DELETE FROM public.key_unlocks WHERE user_id = v_me;
  DELETE FROM public.key_device_requests WHERE user_id = v_me;

  SELECT coalesce(nullif(u.display_name, ''), split_part(u.email, '@', 1), 'Someone') INTO v_name
    FROM public.users u WHERE u.id = v_me;
  INSERT INTO public.notifications (user_id, family_id, type, title, message)
  SELECT DISTINCT admin.user_id, lv.family_id, 'keys_changed',
         left(coalesce(v_name, 'Someone') || ' set up a new phone', 200),
         'Open AskLocker to let them back into ' || coalesce(f.name, 'your vault') || '.'
    FROM public.locked_vaults lv
    JOIN public.families f ON f.id = lv.family_id
    JOIN public.family_members me ON me.family_id = lv.family_id AND me.user_id = v_me
    JOIN public.family_members admin ON admin.family_id = lv.family_id AND admin.role = 'admin' AND admin.user_id <> v_me;

  INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
  VALUES (v_me, 'identity_replaced', 'user_keys', jsonb_build_object('fingerprint', p_fingerprint, 'key_version', v_version));
  RETURN v_version;
END;
$fn$;

-- The identity sealed with the key this person's phone lock gives. At most
-- ten (devices and passkeys) a person.
CREATE OR REPLACE FUNCTION public.add_key_unlock(
  p_credential_id   text,
  p_prf_salt        text,
  p_sealed_identity text,
  p_label           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_version integer;
  v_id      uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT k.key_version INTO v_version FROM public.user_keys k WHERE k.user_id = v_me;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Your keys are not set up yet.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  IF (SELECT count(*) FROM public.key_unlocks WHERE user_id = v_me) >= 10 THEN
    RAISE EXCEPTION 'You have ten phones and passkeys set up. Remove one first.' USING ERRCODE = 'P0001', HINT = 'too_many';
  END IF;
  BEGIN
    INSERT INTO public.key_unlocks (user_id, credential_id, prf_salt, sealed_identity, identity_version, label)
    VALUES (v_me, p_credential_id, p_prf_salt, p_sealed_identity, v_version, nullif(left(p_label, 60), ''))
    ON CONFLICT (user_id, credential_id) DO UPDATE
      SET prf_salt = excluded.prf_salt, sealed_identity = excluded.sealed_identity,
          identity_version = excluded.identity_version, label = excluded.label, created_at = now()
    RETURNING id INTO v_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id)
  VALUES (v_me, 'key_unlock_added', 'key_unlocks', v_id);
  RETURN v_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.remove_key_unlock(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.key_unlocks WHERE id = p_id AND user_id = auth.uid();
END;
$fn$;

-- A new device asks for the keys. At most three waiting a person; each lasts
-- fifteen minutes.
CREATE OR REPLACE FUNCTION public.request_device_keys(p_request_key text, p_label text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_keys k WHERE k.user_id = v_me) THEN
    RAISE EXCEPTION 'Your keys are not set up yet.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  DELETE FROM public.key_device_requests WHERE user_id = v_me AND expires_at < now();
  IF (SELECT count(*) FROM public.key_device_requests WHERE user_id = v_me AND answered_at IS NULL) >= 3 THEN
    RAISE EXCEPTION 'Three devices are already waiting. Approve or wait for them first.' USING ERRCODE = 'P0001', HINT = 'too_many';
  END IF;
  BEGIN
    INSERT INTO public.key_device_requests (user_id, request_key, label)
    VALUES (v_me, p_request_key, nullif(left(p_label, 60), ''))
    RETURNING id INTO v_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  RETURN v_id;
END;
$fn$;

-- The signed-in device answers with the identity locked for the request's key.
CREATE OR REPLACE FUNCTION public.answer_device_request(p_id uuid, p_answer text)
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
    UPDATE public.key_device_requests
       SET answer = p_answer, answered_at = now()
     WHERE id = p_id AND user_id = v_me AND answered_at IS NULL AND expires_at > now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request has ended. Ask again on the new device.' USING ERRCODE = 'P0001', HINT = 'request_gone';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id)
  VALUES (v_me, 'device_approved', 'key_device_requests', p_id);
END;
$fn$;

-- The new device takes its answer, once.
CREATE OR REPLACE FUNCTION public.take_device_answer(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_answer text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.key_device_requests
   WHERE id = p_id AND user_id = auth.uid() AND answer IS NOT NULL
  RETURNING answer INTO v_answer;
  RETURN v_answer;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cancel_device_request(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.key_device_requests WHERE id = p_id AND user_id = auth.uid();
END;
$fn$;


-- ─── 4. A vault's key ───────────────────────────────────────────────────────

-- The caller's current key version, or null.
CREATE OR REPLACE FUNCTION public.e2e_my_key_version()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT k.key_version FROM public.user_keys k WHERE k.user_id = auth.uid();
$fn$;
REVOKE ALL ON FUNCTION public.e2e_my_key_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e2e_my_key_version() TO service_role;

-- Lock a vault: its owner, once, where this project allows it. Version 1 of
-- its key, locked for the owner; the members' apps lock it for each other.
CREATE OR REPLACE FUNCTION public.lock_vault(p_family_id uuid, p_grant text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_version integer;
  v_name    text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.e2e_locking_allowed() THEN
    RAISE EXCEPTION 'Locked vaults are not switched on here.' USING ERRCODE = 'P0001', HINT = 'not_allowed';
  END IF;
  IF public.family_owner(p_family_id) IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Only the owner of this vault can lock it.' USING ERRCODE = '42501', HINT = 'owner';
  END IF;
  SELECT k.key_version INTO v_version FROM public.user_keys k WHERE k.user_id = v_me;
  IF v_version IS NULL THEN
    RAISE EXCEPTION 'Set up your keys first.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  PERFORM 1 FROM public.families f WHERE f.id = p_family_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is locked already.' USING ERRCODE = 'P0001', HINT = 'already_locked';
  END IF;

  INSERT INTO public.locked_vaults (family_id, locked_by) VALUES (p_family_id, v_me);
  INSERT INTO public.vault_keys (family_id, version, created_by) VALUES (p_family_id, 1, v_me);
  BEGIN
    INSERT INTO public.vault_key_grants (family_id, version, user_id, identity_version, key_grant, granted_by)
    VALUES (p_family_id, 1, v_me, v_version, p_grant, v_me);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;

  SELECT coalesce(nullif(u.display_name, ''), split_part(u.email, '@', 1), 'Someone') INTO v_name
    FROM public.users u WHERE u.id = v_me;
  INSERT INTO public.notifications (user_id, family_id, type, title, message)
  SELECT m.user_id, p_family_id, 'vault_locked',
         left(coalesce(v_name, 'Someone') || ' locked ' || coalesce(f.name, 'your vault'), 200),
         'Open AskLocker on your phone to keep reading its documents.'
    FROM public.family_members m JOIN public.families f ON f.id = m.family_id
   WHERE m.family_id = p_family_id AND m.user_id <> v_me;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, 'vault_locked', 'family', p_family_id);
  RETURN 1;
END;
$fn$;

-- A new version of the vault's key, after someone left: an admin, locked for
-- themselves first. New documents use it; the others get it as their apps
-- open the vault.
CREATE OR REPLACE FUNCTION public.add_vault_key_version(p_family_id uuid, p_version integer, p_grant text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_mine   integer;
  v_latest integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.family_members m
                  WHERE m.family_id = p_family_id AND m.user_id = v_me AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Only an admin can do this.' USING ERRCODE = '42501', HINT = 'needs_admin';
  END IF;
  SELECT k.key_version INTO v_mine FROM public.user_keys k WHERE k.user_id = v_me;
  IF v_mine IS NULL THEN
    RAISE EXCEPTION 'Set up your keys first.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  PERFORM 1 FROM public.locked_vaults lv WHERE lv.family_id = p_family_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  SELECT max(version) INTO v_latest FROM public.vault_keys WHERE family_id = p_family_id;
  IF p_version IS DISTINCT FROM coalesce(v_latest, 0) + 1 THEN
    RAISE EXCEPTION 'Someone made a new key already.' USING ERRCODE = 'P0001', HINT = 'stale_version';
  END IF;
  INSERT INTO public.vault_keys (family_id, version, created_by) VALUES (p_family_id, p_version, v_me);
  BEGIN
    INSERT INTO public.vault_key_grants (family_id, version, user_id, identity_version, key_grant, granted_by)
    VALUES (p_family_id, p_version, v_me, v_mine, p_grant, v_me);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, metadata)
  VALUES (v_me, p_family_id, 'vault_key_version', 'family', jsonb_build_object('version', p_version));
END;
$fn$;

-- Lock a version of the vault's key for another member. Any member who holds
-- that version may, for a member who has none; for a member whose keys
-- changed since an earlier grant here (a grant for older keys is still
-- there), only an admin: the approval. Members need every version, since
-- documents keep the version they were sealed with.
CREATE OR REPLACE FUNCTION public.grant_vault_key(
  p_family_id        uuid,
  p_version          integer,
  p_member           uuid,
  p_identity_version integer,
  p_grant            text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me       uuid := auth.uid();
  v_mine     integer;
  v_role     text;
  v_theirs   integer;
  v_existing integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  SELECT k.key_version INTO v_mine FROM public.user_keys k WHERE k.user_id = v_me;
  IF v_mine IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.vault_key_grants g
        WHERE g.family_id = p_family_id AND g.version = p_version AND g.user_id = v_me AND g.identity_version = v_mine) THEN
    RAISE EXCEPTION 'You do not hold this key.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = p_member) THEN
    RAISE EXCEPTION 'They are not in this vault.' USING ERRCODE = 'P0001', HINT = 'not_member';
  END IF;
  SELECT k.key_version INTO v_theirs FROM public.user_keys k WHERE k.user_id = p_member;
  IF v_theirs IS NULL OR v_theirs <> p_identity_version THEN
    RAISE EXCEPTION 'Their keys have changed. Open the vault again.' USING ERRCODE = 'P0001', HINT = 'stale_identity';
  END IF;

  SELECT g.identity_version INTO v_existing FROM public.vault_key_grants g
   WHERE g.family_id = p_family_id AND g.version = p_version AND g.user_id = p_member;
  IF v_existing = p_identity_version THEN
    RETURN;  -- someone else's app got there first
  END IF;
  IF v_role <> 'admin' AND EXISTS (
       SELECT 1 FROM public.vault_key_grants g
        WHERE g.family_id = p_family_id AND g.user_id = p_member AND g.identity_version < p_identity_version) THEN
    RAISE EXCEPTION 'Their keys changed. An admin needs to let them back in.' USING ERRCODE = '42501', HINT = 'needs_admin';
  END IF;

  BEGIN
    INSERT INTO public.vault_key_grants (family_id, version, user_id, identity_version, key_grant, granted_by)
    VALUES (p_family_id, p_version, p_member, p_identity_version, p_grant, v_me)
    ON CONFLICT (family_id, version, user_id) DO UPDATE
      SET identity_version = excluded.identity_version, key_grant = excluded.key_grant,
          granted_by = excluded.granted_by, created_at = now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, metadata)
  VALUES (v_me, p_family_id, 'vault_key_granted', 'family',
          jsonb_build_object('member', p_member, 'version', p_version, 'identity_version', p_identity_version));
END;
$fn$;

-- What a member's app needs to keep a locked vault's keys in order: whether
-- it is locked, the latest version, whether someone who left still holds it
-- (a new version is due), and each member's public keys and whether they
-- hold the latest version.
CREATE OR REPLACE FUNCTION public.vault_key_status(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_locked public.locked_vaults%ROWTYPE;
  v_latest integer;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_locked FROM public.locked_vaults WHERE family_id = p_family_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('locked', false, 'allowed', public.e2e_locking_allowed());
  END IF;
  SELECT max(version) INTO v_latest FROM public.vault_keys WHERE family_id = p_family_id;
  RETURN jsonb_build_object(
    'locked', true,
    'allowed', public.e2e_locking_allowed(),
    'locked_at', v_locked.locked_at,
    'moved_at', v_locked.moved_at,
    'latest_version', v_latest,
    'needs_new_key', EXISTS (
      SELECT 1 FROM public.vault_key_grants g
       WHERE g.family_id = p_family_id AND g.version = v_latest
         AND NOT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = g.user_id)),
    'members', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'user_id', m.user_id,
               'name', coalesce(nullif(u.display_name, ''), split_part(u.email, '@', 1)),
               'role', m.role,
               'encrypt_public', k.encrypt_public,
               'sign_public', k.sign_public,
               'fingerprint', k.fingerprint,
               'identity_version', k.key_version,
               'versions', coalesce((SELECT jsonb_agg(g.version ORDER BY g.version) FROM public.vault_key_grants g
                                      WHERE g.family_id = p_family_id AND g.user_id = m.user_id
                                        AND g.identity_version = k.key_version), '[]'::jsonb),
               'needs_approval', k.key_version IS NOT NULL AND EXISTS (
                 SELECT 1 FROM public.vault_key_grants g
                  WHERE g.family_id = p_family_id AND g.user_id = m.user_id AND g.identity_version < k.key_version)
             ) ORDER BY m.joined_at)
        FROM public.family_members m
        JOIN public.users u ON u.id = m.user_id
        LEFT JOIN public.user_keys k ON k.user_id = m.user_id
       WHERE m.family_id = p_family_id), '[]'::jsonb)
  );
END;
$fn$;


-- ─── 5. Sealed documents ────────────────────────────────────────────────────

-- A new locked document: every check insert_family_document makes (the
-- folder, the file, whose it is, the day's limit), then its sealed parts.
-- The row's name says only "Locked document"; its status is 'sealed'.
CREATE OR REPLACE FUNCTION public.insert_sealed_document(
  p_family_id         uuid,
  p_file_type         character varying,
  p_file_size_bytes   bigint,
  p_storage_path      text,
  p_category_id       uuid,
  p_belongs_to_member uuid,
  p_key_version       integer,
  p_file_key          text,
  p_details           text,
  p_passages          text,
  p_passage_count     integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_schema text;
  v_doc    uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
                  WHERE g.family_id = p_family_id AND g.version = p_key_version AND g.user_id = v_me
                    AND g.identity_version = k.key_version) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;

  PERFORM set_config('asklocker.sealed_insert', 'on', true);
  v_doc := public.insert_family_document(p_family_id, v_me, 'Locked document', p_file_type, p_file_size_bytes,
                                         p_storage_path, p_category_id, p_belongs_to_member);
  PERFORM set_config('asklocker.sealed_insert', '', true);

  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('UPDATE %I.documents SET ingestion_status = ''sealed'', ocr_text = NULL WHERE id = $1', v_schema)
    USING v_doc;

  BEGIN
    INSERT INTO public.sealed_documents (family_id, document_id, key_version, file_key, details, passages, passage_count, added_by)
    VALUES (p_family_id, v_doc, p_key_version, p_file_key, p_details, p_passages, coalesce(p_passage_count, 0), v_me);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END;
  RETURN v_doc;
END;
$fn$;

-- An older document moved into the lock: the row points at its sealed file,
-- and the server's readable text, passages, details, expiry alerts and share
-- links go. Whoever added it, or an admin. Returns the readable file's
-- address, which the app then deletes (no document holds it any more).
CREATE OR REPLACE FUNCTION public.seal_existing_document(
  p_family_id     uuid,
  p_document_id   uuid,
  p_storage_path  text,
  p_key_version   integer,
  p_file_key      text,
  p_details       text,
  p_passages      text,
  p_passage_count integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me       uuid := auth.uid();
  v_schema   text;
  v_role     text;
  v_owner    uuid;
  v_status   text;
  v_old      text;
  v_size     bigint;
  v_taken    boolean;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
                  WHERE g.family_id = p_family_id AND g.version = p_key_version AND g.user_id = v_me
                    AND g.identity_version = k.key_version) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;

  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('SELECT d.uploaded_by, d.ingestion_status, d.storage_path FROM %I.documents d WHERE d.id = $1 FOR UPDATE', v_schema)
     INTO v_owner, v_status, v_old USING p_document_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0001', HINT = 'no_document';
  END IF;
  IF v_owner IS DISTINCT FROM v_me AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only whoever added it, or an admin, can lock it.' USING ERRCODE = '42501';
  END IF;
  IF v_status = 'sealed' THEN
    RAISE EXCEPTION 'This document is locked already.' USING ERRCODE = 'P0001', HINT = 'already_sealed';
  END IF;

  IF p_storage_path IS NULL OR length(p_storage_path) > 1024
     OR left(p_storage_path, length(v_schema) + 1) <> v_schema || '/'
     OR length(p_storage_path) = length(v_schema) + 1
     OR p_storage_path ~ '(^|/)\.\.?(/|$)' OR p_storage_path ~ '//' OR position(E'\\' IN p_storage_path) > 0 THEN
    RAISE EXCEPTION 'That file is not in this vault.' USING ERRCODE = '42501', HINT = 'bad_path';
  END IF;
  SELECT (o.metadata->>'size')::bigint INTO v_size
    FROM storage.objects o WHERE o.bucket_id = 'documents' AND o.name = p_storage_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The file is missing. Try again.' USING ERRCODE = 'P0001', HINT = 'no_file';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.documents d WHERE d.storage_path = $1)', v_schema)
     INTO v_taken USING p_storage_path;
  IF v_taken THEN
    RAISE EXCEPTION 'Another document already uses this file.' USING ERRCODE = '42501', HINT = 'bad_path';
  END IF;

  BEGIN
    INSERT INTO public.sealed_documents (family_id, document_id, key_version, file_key, details, passages, passage_count, added_by)
    VALUES (p_family_id, p_document_id, p_key_version, p_file_key, p_details, p_passages, coalesce(p_passage_count, 0), v_me)
    ON CONFLICT (family_id, document_id) DO UPDATE
      SET key_version = excluded.key_version, file_key = excluded.file_key, details = excluded.details,
          passages = excluded.passages, passage_count = excluded.passage_count, updated_at = now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END;

  EXECUTE format('UPDATE %I.documents
                     SET storage_path = $2, file_name = ''Locked document'', file_size_bytes = coalesce($3, file_size_bytes),
                         ocr_text = NULL, ingestion_status = ''sealed'', updated_at = now()
                   WHERE id = $1', v_schema)
    USING p_document_id, p_storage_path, v_size;
  EXECUTE format('DELETE FROM %I.document_chunks WHERE document_id = $1', v_schema) USING p_document_id;
  EXECUTE format('DELETE FROM %I.document_metadata WHERE document_id = $1', v_schema) USING p_document_id;
  EXECUTE format('DELETE FROM %I.expiry_alerts WHERE document_id = $1', v_schema) USING p_document_id;
  UPDATE public.document_shares SET revoked_at = now(), revoked_by = v_me
   WHERE family_id = p_family_id AND document_id = p_document_id AND revoked_at IS NULL;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, 'document_sealed', 'document', p_document_id);
  RETURN v_old;
END;
$fn$;

-- A locked document's details sealed again (renamed, or its own category
-- name changed): never its name in the clear. Whoever added it, or an admin.
CREATE OR REPLACE FUNCTION public.update_sealed_details(p_family_id uuid, p_document_id uuid, p_details text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_role   text;
  v_schema text;
  v_owner  uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('SELECT d.uploaded_by FROM %I.documents d WHERE d.id = $1', v_schema) INTO v_owner USING p_document_id;
  IF v_owner IS DISTINCT FROM v_me AND v_role <> 'admin' THEN
    RAISE EXCEPTION 'Only whoever added it, or an admin, can change it.' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.sealed_documents SET details = p_details, updated_at = now()
     WHERE family_id = p_family_id AND document_id = p_document_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This document is not locked.' USING ERRCODE = 'P0001', HINT = 'not_sealed';
  END IF;
END;
$fn$;

-- Every older document moved: the vault says so. The owner or an admin;
-- returns how many are still readable (0 when it is done).
CREATE OR REPLACE FUNCTION public.finish_vault_move(p_family_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_schema text;
  v_left   integer;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Only an admin can do this.' USING ERRCODE = '42501', HINT = 'needs_admin';
  END IF;
  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('SELECT count(*) FROM %I.documents d WHERE NOT coalesce(d.is_deleted, false)
                    AND coalesce(d.ingestion_status, '''') <> ''sealed''', v_schema) INTO v_left;
  IF v_left = 0 THEN
    UPDATE public.locked_vaults SET moved_at = coalesce(moved_at, now()) WHERE family_id = p_family_id;
  END IF;
  RETURN v_left;
END;
$fn$;

-- Sealed parts whose document is gone (deleted, or removed when a plan
-- ended) go too. Any member; it removes nothing a document still has.
CREATE OR REPLACE FUNCTION public.sealed_documents_sweep(p_family_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_schema text;
  v_gone   integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                        WHERE m.family_id = p_family_id AND m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('DELETE FROM public.sealed_documents s
                   WHERE s.family_id = $1
                     AND NOT EXISTS (SELECT 1 FROM %I.documents d WHERE d.id = s.document_id)', v_schema)
    USING p_family_id;
  GET DIAGNOSTICS v_gone = ROW_COUNT;
  RETURN v_gone;
END;
$fn$;


-- ─── 6. What the server's readers must never take for readable ──────────────
-- 050's insert_family_document, refusing a readable document in a locked
-- vault; 050's start_document_read and 017's rag_documents_to_ingest, which
-- leave a sealed document alone.

CREATE OR REPLACE FUNCTION public.insert_family_document(
  p_family_id uuid,
  p_uploaded_by uuid,
  p_file_name character varying,
  p_file_type character varying,
  p_file_size_bytes bigint,
  p_storage_path text,
  p_category_id uuid DEFAULT NULL::uuid,
  p_belongs_to_member uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_schema TEXT;
  v_doc_id UUID;
  v_size   BIGINT;
  v_taken  BOOLEAN;
  v_claim  JSONB;
BEGIN
  PERFORM public.assert_caller_is(p_uploaded_by);

  SELECT storage_namespace INTO v_schema
  FROM public.families
  WHERE id = p_family_id;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Family not found: %', p_family_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id
      AND user_id = p_uploaded_by
      AND can_upload = true
  ) THEN
    RAISE EXCEPTION 'User does not have upload permission';
  END IF;

  -- A locked vault (071) takes sealed documents only, through
  -- insert_sealed_document(), which sets this for its own call. An older app
  -- would store a readable file and text there.
  IF EXISTS (SELECT 1 FROM public.locked_vaults lv WHERE lv.family_id = p_family_id)
     AND coalesce(current_setting('asklocker.sealed_insert', true), '') <> 'on' THEN
    RAISE EXCEPTION 'This vault is locked. Update AskLocker to add documents to it.'
      USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;

  -- In this vault's own folder, and nowhere else: "<namespace>/<file>".
  IF p_storage_path IS NULL OR length(p_storage_path) > 1024
     OR left(p_storage_path, length(v_schema) + 1) <> v_schema || '/'
     OR length(p_storage_path) = length(v_schema) + 1
     OR p_storage_path ~ '(^|/)\.\.?(/|$)' OR p_storage_path ~ '//' OR position(E'\\' IN p_storage_path) > 0 THEN
    RAISE EXCEPTION 'That file is not in this vault.'
      USING ERRCODE = '42501', HINT = 'bad_path';
  END IF;

  -- The file is there: uploaded first, as the app and Gmail import do.
  SELECT (o.metadata->>'size')::bigint INTO v_size
    FROM storage.objects o
   WHERE o.bucket_id = 'documents' AND o.name = p_storage_path;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The file is missing. Try adding it again.'
      USING ERRCODE = 'P0001', HINT = 'no_file';
  END IF;

  -- And it is no other document's.
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.documents d WHERE d.storage_path = $1)', v_schema)
     INTO v_taken USING p_storage_path;
  IF v_taken THEN
    RAISE EXCEPTION 'Another document already uses this file.'
      USING ERRCODE = '42501', HINT = 'bad_path';
  END IF;

  v_claim := public.claim_daily(p_uploaded_by, 'uploads');
  IF NOT (v_claim->>'allowed')::boolean THEN
    RAISE EXCEPTION '%',
      CASE WHEN (v_claim->>'plus')::boolean
        THEN format('You have reached today''s limit of %s documents. You can add more tomorrow.', v_claim->>'limit')
        ELSE format('You have reached today''s limit of %s documents on Free. You can add more tomorrow.', v_claim->>'limit')
      END
      USING ERRCODE = 'P0001', HINT = 'upload_limit';
  END IF;

  v_doc_id := gen_random_uuid();

  EXECUTE format(
    'INSERT INTO %I.documents (id, uploaded_by, file_name, file_type, file_size_bytes, storage_path, category_id, belongs_to_member, ingestion_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, ''pending'')',
    v_schema
  ) USING v_doc_id, p_uploaded_by, p_file_name, p_file_type, coalesce(v_size, p_file_size_bytes),
          p_storage_path, p_category_id, p_belongs_to_member;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (p_uploaded_by, p_family_id, 'upload_document', 'document', v_doc_id);

  RETURN v_doc_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.start_document_read(p_family_id uuid, p_document_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_schema text;
  v_path   text;
  v_status text;
  v_size   bigint;
  v_claim  jsonb;
BEGIN
  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  IF v_schema IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_document');
  END IF;

  EXECUTE format('SELECT d.storage_path, d.ingestion_status FROM %I.documents d
                   WHERE d.id = $1 AND NOT coalesce(d.is_deleted, false)', v_schema)
     INTO v_path, v_status USING p_document_id;
  IF v_path IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_document');
  END IF;
  -- 'sealed' (071): a locked document, which the server cannot read.
  IF v_status IN ('completed', 'failed', 'sealed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_read', 'status', v_status);
  END IF;
  IF left(v_path, length(v_schema) + 1) <> v_schema || '/' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_path');
  END IF;

  SELECT (o.metadata->>'size')::bigint INTO v_size
    FROM storage.objects o
   WHERE o.bucket_id = 'documents' AND o.name = v_path;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_file');
  END IF;

  v_claim := public.claim_daily(p_user_id, 'reads');
  IF NOT (v_claim->>'allowed')::boolean THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'read_limit', 'limit', v_claim->'limit');
  END IF;

  RETURN jsonb_build_object('ok', true, 'storage_path', v_path, 'file_bytes', v_size, 'schema', v_schema);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.rag_documents_to_ingest(
  p_schema TEXT,
  p_limit  INTEGER DEFAULT 2
)
RETURNS TABLE(id UUID, storage_path TEXT, file_name CHARACTER VARYING)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT d.id, d.storage_path, d.file_name
     FROM %I.documents d
     WHERE d.is_deleted = false
       AND d.storage_path IS NOT NULL
       AND COALESCE(d.ingestion_status, '''') NOT IN (''failed'', ''sealed'')
       AND NOT EXISTS (
         SELECT 1 FROM %I.document_chunks c WHERE c.document_id = d.id
       )
     ORDER BY d.created_at
     LIMIT $1',
    p_schema, p_schema
  ) USING p_limit;
END;
$function$;


-- ─── 7. Who may call what ───────────────────────────────────────────────────
-- Every function above takes the caller from auth.uid(); none is for anon.

REVOKE ALL ON FUNCTION public.delete_my_identity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_my_identity(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_key_unlock(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_key_unlock(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_device_keys(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_device_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.take_device_answer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_device_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lock_vault(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_vault_key_version(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.grant_vault_key(uuid, integer, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vault_key_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_sealed_document(uuid, character varying, bigint, text, uuid, uuid, integer, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seal_existing_document(uuid, uuid, text, integer, text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_sealed_details(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_vault_move(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sealed_documents_sweep(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.delete_my_identity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.replace_my_identity(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_key_unlock(text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.remove_key_unlock(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_device_keys(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_device_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.take_device_answer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_device_request(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lock_vault(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_vault_key_version(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_vault_key(uuid, integer, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vault_key_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_sealed_document(uuid, character varying, bigint, text, uuid, uuid, integer, text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seal_existing_document(uuid, uuid, text, integer, text, text, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sealed_details(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_vault_move(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sealed_documents_sweep(uuid) TO authenticated, service_role;

-- The three restated above keep their grants from 050 and 017 (CREATE OR
-- REPLACE keeps a function's privileges); said again so a fresh project
-- reads the same.
REVOKE ALL ON FUNCTION public.insert_family_document(uuid, uuid, character varying, character varying, bigint, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_family_document(uuid, uuid, character varying, character varying, bigint, text, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.start_document_read(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_document_read(uuid, uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.rag_documents_to_ingest(TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rag_documents_to_ingest(TEXT, INTEGER) TO service_role;
