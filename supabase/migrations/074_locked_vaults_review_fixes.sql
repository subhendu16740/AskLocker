-- 074: Locked vaults, what our own security review found (8 November 2026),
-- fixed before the outside review (docs/end-to-end-encryption.md, Phase 5).
-- Test builds only, like 071: nothing changes in a vault that is not locked,
-- and on a project where locking is off (PROD) a person's keys cannot be
-- made at all. Apply after 073.
--
-- Keys
--   • Each version of a vault's key carries a commitment to the key (an HMAC
--     under it) and its maker's signature, with the maker's public keys. A
--     member's app takes a grant only when the key in it matches, so a grant
--     planted by another member, or made up by a server, is caught; the app
--     can then throw that grant away (discard_my_vault_grant) for an honest
--     one. lock_vault() and add_vault_key_version() take both.
--   • An admin's grant replaces anyone else's; a member's only fills a gap.
--   • A new version is made only by an admin who holds the latest one (or,
--     when no admin does, by any admin, to start again).
--   • Someone leaving a locked vault marks it for a new version
--     (locked_vaults.rotate_needed), so deleting their account afterwards no
--     longer hides that a new key is due.
--   • Everything new is sealed with the latest version: a member who left
--     holds the older ones (also in 073's seal_vault_item).
--
-- A new device
--   • The six digits come from both devices' random values, each committed
--     before the other is seen (request_device_keys() takes the new device's
--     commitment; offer_device_nonce() and reveal_device_nonce() carry the
--     two values), so a server cannot pick a key that shows the same code.
--
-- Documents
--   • insert_sealed_document() checks the caller is in the vault first; a
--     sealed document's category is kept only when it is a built-in one,
--     and whose it is goes inside its sealed details, not on the row.
--   • seal_existing_document(): in a family vault only whoever added a
--     document locks it (047's rule: nobody else deletes it, admins
--     included); in a business, an admin too (051). Its old notifications
--     and reminders go with its readable copy.
--   • update_family_document() and set_document_description() write no
--     readable name, description, owner or own category on a sealed
--     document.
--   • A sealed document's parts are capped by its file's size, and they,
--     with a vault's sealed records, count toward the vault's space and,
--     on Free, the person's (038, 060).
--
-- Limits
--   • A person's keys, their phone locks and new devices only where this
--     project allows locking (e2e_config).
--   • New keys at most three times a day, and one notice an admin a day.
--   • A phone lock already there is replaced without a new log row.
--
-- Safe to run twice. DEV, then PROD.


-- ─── 1. Signed versions of a vault's key ────────────────────────────────────
ALTER TABLE public.vault_keys ADD COLUMN IF NOT EXISTS commitment text;
ALTER TABLE public.vault_keys ADD COLUMN IF NOT EXISTS signature text;
ALTER TABLE public.vault_keys ADD COLUMN IF NOT EXISTS maker_encrypt_public text;
ALTER TABLE public.vault_keys ADD COLUMN IF NOT EXISTS maker_sign_public text;
ALTER TABLE public.vault_keys DROP CONSTRAINT IF EXISTS vault_keys_signed_shape;
ALTER TABLE public.vault_keys ADD CONSTRAINT vault_keys_signed_shape CHECK (
  (commitment IS NULL OR commitment ~ '^kc1\.[A-Za-z0-9_-]{43}$')
  AND (signature IS NULL OR signature ~ '^[A-Za-z0-9_-]{86}$')
  AND (maker_encrypt_public IS NULL OR maker_encrypt_public ~ '^[A-Za-z0-9_-]{100,200}$')
  AND (maker_sign_public IS NULL OR maker_sign_public ~ '^[A-Za-z0-9_-]{100,200}$'));

ALTER TABLE public.locked_vaults ADD COLUMN IF NOT EXISTS rotate_needed boolean NOT NULL DEFAULT false;

-- The caller holds the latest version of this vault's key, for their current keys.
CREATE OR REPLACE FUNCTION public.e2e_holds_latest(p_family_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
     WHERE g.family_id = p_family_id AND g.user_id = p_user AND g.identity_version = k.key_version
       AND g.version = (SELECT max(v.version) FROM public.vault_keys v WHERE v.family_id = p_family_id));
$fn$;
REVOKE ALL ON FUNCTION public.e2e_holds_latest(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e2e_holds_latest(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.lock_vault(uuid, text);
CREATE OR REPLACE FUNCTION public.lock_vault(p_family_id uuid, p_grant text, p_commitment text, p_signature text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_keys    public.user_keys%ROWTYPE;
  v_name    text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF public.family_owner(p_family_id) IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Only the owner of this vault can lock it.' USING ERRCODE = '42501', HINT = 'owner';
  END IF;
  IF NOT public.e2e_locking_allowed() THEN
    RAISE EXCEPTION 'Locked vaults are not switched on here.' USING ERRCODE = 'P0001', HINT = 'not_allowed';
  END IF;
  SELECT * INTO v_keys FROM public.user_keys k WHERE k.user_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set up your keys first.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  PERFORM 1 FROM public.families f WHERE f.id = p_family_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is locked already.' USING ERRCODE = 'P0001', HINT = 'already_locked';
  END IF;
  IF p_commitment IS NULL OR p_signature IS NULL THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END IF;

  INSERT INTO public.locked_vaults (family_id, locked_by) VALUES (p_family_id, v_me);
  BEGIN
    INSERT INTO public.vault_keys (family_id, version, created_by, commitment, signature, maker_encrypt_public, maker_sign_public)
    VALUES (p_family_id, 1, v_me, p_commitment, p_signature, v_keys.encrypt_public, v_keys.sign_public);
    INSERT INTO public.vault_key_grants (family_id, version, user_id, identity_version, key_grant, granted_by)
    VALUES (p_family_id, 1, v_me, v_keys.key_version, p_grant, v_me);
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

DROP FUNCTION IF EXISTS public.add_vault_key_version(uuid, integer, text);
CREATE OR REPLACE FUNCTION public.add_vault_key_version(
  p_family_id uuid, p_version integer, p_grant text, p_commitment text, p_signature text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_keys   public.user_keys%ROWTYPE;
  v_latest integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.family_members m
                  WHERE m.family_id = p_family_id AND m.user_id = v_me AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Only an admin can do this.' USING ERRCODE = '42501', HINT = 'needs_admin';
  END IF;
  SELECT * INTO v_keys FROM public.user_keys k WHERE k.user_id = v_me;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Set up your keys first.' USING ERRCODE = 'P0001', HINT = 'no_identity';
  END IF;
  PERFORM 1 FROM public.locked_vaults lv WHERE lv.family_id = p_family_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  -- An admin whose keys were never let back in cannot start a key of their
  -- own, unless no admin holds the latest one (then any admin starts again).
  IF NOT public.e2e_holds_latest(p_family_id, v_me)
     AND EXISTS (SELECT 1 FROM public.family_members m
                  WHERE m.family_id = p_family_id AND m.role = 'admin' AND public.e2e_holds_latest(p_family_id, m.user_id)) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;
  SELECT max(version) INTO v_latest FROM public.vault_keys WHERE family_id = p_family_id;
  IF p_version IS DISTINCT FROM coalesce(v_latest, 0) + 1 THEN
    RAISE EXCEPTION 'Someone made a new key already.' USING ERRCODE = 'P0001', HINT = 'stale_version';
  END IF;
  IF p_commitment IS NULL OR p_signature IS NULL THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END IF;
  BEGIN
    INSERT INTO public.vault_keys (family_id, version, created_by, commitment, signature, maker_encrypt_public, maker_sign_public)
    VALUES (p_family_id, p_version, v_me, p_commitment, p_signature, v_keys.encrypt_public, v_keys.sign_public);
    INSERT INTO public.vault_key_grants (family_id, version, user_id, identity_version, key_grant, granted_by)
    VALUES (p_family_id, p_version, v_me, v_keys.key_version, p_grant, v_me);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This key is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  UPDATE public.locked_vaults SET rotate_needed = false WHERE family_id = p_family_id;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, metadata)
  VALUES (v_me, p_family_id, 'vault_key_version', 'family', jsonb_build_object('version', p_version));
END;
$fn$;

-- 071's grant, with an admin's grant replacing anyone else's.
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
  IF v_existing = p_identity_version AND v_role <> 'admin' THEN
    RETURN;  -- someone else's app got there first; only an admin's replaces it
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

-- A grant whose key is not the one its version committed to: the member's
-- app throws it away, so an honest app can lock the right one.
CREATE OR REPLACE FUNCTION public.discard_my_vault_grant(p_family_id uuid, p_version integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.vault_key_grants g
   USING public.user_keys k
   WHERE k.user_id = v_me AND g.family_id = p_family_id AND g.version = p_version
     AND g.user_id = v_me AND g.identity_version = k.key_version
     AND g.granted_by IS DISTINCT FROM v_me;
  IF FOUND THEN
    INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, metadata)
    VALUES (v_me, p_family_id, 'vault_key_discarded', 'family', jsonb_build_object('version', p_version));
  END IF;
END;
$fn$;

-- Someone leaving a locked vault: a new version is due, whatever happens to
-- their account afterwards.
CREATE OR REPLACE FUNCTION public.locked_vault_member_left()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  UPDATE public.locked_vaults SET rotate_needed = true WHERE family_id = OLD.family_id AND NOT rotate_needed;
  RETURN OLD;
END;
$fn$;
DROP TRIGGER IF EXISTS locked_vault_member_left ON public.family_members;
CREATE TRIGGER locked_vault_member_left
  AFTER DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.locked_vault_member_left();

-- 071's status, with 074's flag.
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
    'needs_new_key', v_locked.rotate_needed OR EXISTS (
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


-- ─── 2. A new device: a code from both devices ──────────────────────────────
ALTER TABLE public.key_device_requests ADD COLUMN IF NOT EXISTS commitment text;
ALTER TABLE public.key_device_requests ADD COLUMN IF NOT EXISTS approver_nonce text;
ALTER TABLE public.key_device_requests ADD COLUMN IF NOT EXISTS request_nonce text;
ALTER TABLE public.key_device_requests DROP CONSTRAINT IF EXISTS key_device_requests_code_shape;
ALTER TABLE public.key_device_requests ADD CONSTRAINT key_device_requests_code_shape CHECK (
  (commitment IS NULL OR commitment ~ '^[A-Za-z0-9_-]{43}$')
  AND (approver_nonce IS NULL OR approver_nonce ~ '^[A-Za-z0-9_-]{22}$')
  AND (request_nonce IS NULL OR request_nonce ~ '^[A-Za-z0-9_-]{22}$'));

DROP FUNCTION IF EXISTS public.request_device_keys(text, text);
CREATE OR REPLACE FUNCTION public.request_device_keys(p_request_key text, p_commitment text, p_label text DEFAULT NULL)
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
  IF p_commitment IS NULL THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END IF;
  BEGIN
    INSERT INTO public.key_device_requests (user_id, request_key, commitment, label)
    VALUES (v_me, p_request_key, p_commitment, nullif(left(p_label, 60), ''))
    RETURNING id INTO v_id;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  RETURN v_id;
END;
$fn$;

-- The signed-in device's value, once. True when it is the one kept.
CREATE OR REPLACE FUNCTION public.offer_device_nonce(p_id uuid, p_nonce text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.key_device_requests SET approver_nonce = p_nonce
     WHERE id = p_id AND user_id = auth.uid() AND approver_nonce IS NULL AND answered_at IS NULL AND expires_at > now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  RETURN FOUND;
END;
$fn$;

-- The new device's value, once, after the other device's.
CREATE OR REPLACE FUNCTION public.reveal_device_nonce(p_id uuid, p_nonce text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  BEGIN
    UPDATE public.key_device_requests SET request_nonce = p_nonce
     WHERE id = p_id AND user_id = auth.uid() AND approver_nonce IS NOT NULL AND request_nonce IS NULL
       AND answered_at IS NULL AND expires_at > now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request has ended. Ask again on the new device.' USING ERRCODE = 'P0001', HINT = 'request_gone';
  END IF;
END;
$fn$;

-- 071's answer, only once both values are there.
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
     WHERE id = p_id AND user_id = v_me AND answered_at IS NULL AND expires_at > now()
       AND approver_nonce IS NOT NULL AND request_nonce IS NOT NULL;
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


-- ─── 3. Sealed documents ────────────────────────────────────────────────────

-- The most a document's sealed passages and details can need, from its
-- file's size: 050's text limits (20,000 characters plus twenty a byte, at
-- most 500,000), its vectors and the seal, with room to spare.
CREATE OR REPLACE FUNCTION public.e2e_sealed_fits(p_file_bytes bigint, p_details text, p_passages text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_catalog
AS $fn$
  SELECT char_length(coalesce(p_details, '')) <= 100000
     AND char_length(coalesce(p_passages, '')) <= least(4000000, 6 * least(500000, 20000 + 20 * greatest(coalesce(p_file_bytes, 0), 0)));
$fn$;
REVOKE ALL ON FUNCTION public.e2e_sealed_fits(bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e2e_sealed_fits(bigint, text, text) TO service_role;

-- A built-in category, or none: a family's own category name is readable.
CREATE OR REPLACE FUNCTION public.e2e_builtin_category(p_category_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
  SELECT c.id FROM public.document_categories c WHERE c.id = p_category_id AND coalesce(c.is_system, false);
$fn$;
REVOKE ALL ON FUNCTION public.e2e_builtin_category(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.e2e_builtin_category(uuid) TO service_role;

-- 072's insert: the caller in the vault first, the latest key, its parts to
-- size, a built-in category only, and whose it is sealed.
CREATE OR REPLACE FUNCTION public.insert_sealed_document(
  p_family_id         uuid,
  p_document_id       uuid,
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
  v_taken  boolean;
  v_size   bigint;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
                  WHERE g.family_id = p_family_id AND g.version = p_key_version AND g.user_id = v_me
                    AND g.identity_version = k.key_version) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  IF p_key_version IS DISTINCT FROM (SELECT max(k.version) FROM public.vault_keys k WHERE k.family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault has a newer key. Open it again.' USING ERRCODE = 'P0001', HINT = 'stale_version';
  END IF;

  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.documents d WHERE d.id = $1)', v_schema) INTO v_taken USING p_document_id;
  IF v_taken OR EXISTS (SELECT 1 FROM public.sealed_documents s WHERE s.family_id = p_family_id AND s.document_id = p_document_id) THEN
    RAISE EXCEPTION 'This document is there already.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;
  SELECT (o.metadata->>'size')::bigint INTO v_size
    FROM storage.objects o WHERE o.bucket_id = 'documents' AND o.name = p_storage_path;
  IF NOT public.e2e_sealed_fits(v_size, p_details, p_passages) THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;

  PERFORM set_config('asklocker.sealed_insert', 'on', true);
  v_doc := public.insert_family_document(p_family_id, v_me, 'Locked document', p_file_type, p_file_size_bytes,
                                         p_storage_path, public.e2e_builtin_category(p_category_id), NULL);
  PERFORM set_config('asklocker.sealed_insert', '', true);

  EXECUTE format('UPDATE %I.documents SET id = $2, ingestion_status = ''sealed'', ocr_text = NULL WHERE id = $1', v_schema)
    USING v_doc, p_document_id;
  UPDATE public.audit_logs SET resource_id = p_document_id
   WHERE action = 'upload_document' AND resource_id = v_doc AND family_id = p_family_id;
  v_doc := p_document_id;

  BEGIN
    INSERT INTO public.sealed_documents (family_id, document_id, key_version, file_key, details, passages, passage_count, added_by)
    VALUES (p_family_id, v_doc, p_key_version, p_file_key, p_details, p_passages, coalesce(p_passage_count, 0), v_me);
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END;
  RETURN v_doc;
END;
$fn$;

-- 071's move of an older document: in a family vault, only whoever added it.
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
  v_business boolean;
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
  IF p_key_version IS DISTINCT FROM (SELECT max(k.version) FROM public.vault_keys k WHERE k.family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault has a newer key. Open it again.' USING ERRCODE = 'P0001', HINT = 'stale_version';
  END IF;

  SELECT f.storage_namespace, f.kind = 'business' INTO v_schema, v_business FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('SELECT d.uploaded_by, d.ingestion_status, d.storage_path FROM %I.documents d WHERE d.id = $1 FOR UPDATE', v_schema)
     INTO v_owner, v_status, v_old USING p_document_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Document not found.' USING ERRCODE = 'P0001', HINT = 'no_document';
  END IF;
  IF v_owner IS DISTINCT FROM v_me AND NOT (coalesce(v_business, false) AND v_role = 'admin') THEN
    RAISE EXCEPTION 'Only whoever added it can lock it.' USING ERRCODE = '42501', HINT = 'not_yours';
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
  IF NOT public.e2e_sealed_fits(v_size, p_details, p_passages) THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
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

  -- Its own category and whose it is are in its sealed details now.
  EXECUTE format('UPDATE %I.documents
                     SET storage_path = $2, file_name = ''Locked document'', file_size_bytes = coalesce($3, file_size_bytes),
                         ocr_text = NULL, ingestion_status = ''sealed'', updated_at = now(),
                         category_id = public.e2e_builtin_category(category_id), belongs_to_member = NULL
                   WHERE id = $1', v_schema)
    USING p_document_id, p_storage_path, v_size;
  EXECUTE format('UPDATE %I.documents SET description = NULL WHERE id = $1 AND description IS NOT NULL', v_schema)
    USING p_document_id;
  EXECUTE format('DELETE FROM %I.document_chunks WHERE document_id = $1', v_schema) USING p_document_id;
  EXECUTE format('DELETE FROM %I.document_metadata WHERE document_id = $1', v_schema) USING p_document_id;
  EXECUTE format('DELETE FROM %I.expiry_alerts WHERE document_id = $1', v_schema) USING p_document_id;
  UPDATE public.document_shares SET revoked_at = now(), revoked_by = v_me
   WHERE family_id = p_family_id AND document_id = p_document_id AND revoked_at IS NULL;
  -- Its reminders said its name and dates.
  DELETE FROM public.notifications WHERE family_id = p_family_id AND document_ref = p_document_id;
  DELETE FROM public.reminders_sent WHERE family_id = p_family_id AND ref_id = p_document_id;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, 'document_sealed', 'document', p_document_id);
  RETURN v_old;
END;
$fn$;

-- 071's re-seal of details, to size.
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
  IF char_length(coalesce(p_details, '')) > 100000 THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
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

-- 023's edit, writing nothing readable on a sealed document.
CREATE OR REPLACE FUNCTION public.update_family_document(
  p_family_id uuid,
  p_document_id uuid,
  p_user_id uuid,
  p_file_name character varying DEFAULT NULL::character varying,
  p_category_id uuid DEFAULT NULL::uuid,
  p_belongs_to_member uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_schema TEXT;
  v_role TEXT;
  v_status TEXT;
  v_set_clauses TEXT[] := '{}';
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  SELECT storage_namespace INTO v_schema
  FROM public.families
  WHERE id = p_family_id;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Family not found: %', p_family_id;
  END IF;

  SELECT role INTO v_role
  FROM public.family_members
  WHERE family_id = p_family_id
    AND user_id = p_user_id;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this family';
  END IF;

  IF v_role NOT IN ('admin', 'editor') THEN
    RAISE EXCEPTION 'User does not have permission to edit documents';
  END IF;

  EXECUTE format('SELECT d.ingestion_status FROM %I.documents d WHERE d.id = $1', v_schema) INTO v_status USING p_document_id;
  IF v_status = 'sealed' AND (
       p_file_name IS NOT NULL OR p_belongs_to_member IS NOT NULL
       OR (p_category_id IS NOT NULL AND public.e2e_builtin_category(p_category_id) IS NULL)) THEN
    RAISE EXCEPTION 'This document is locked: its name, whose it is and its own category are changed on your phone.'
      USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;

  IF p_file_name IS NOT NULL THEN
    v_set_clauses := array_append(v_set_clauses, format('file_name = %L', p_file_name));
  END IF;
  IF p_category_id IS NOT NULL THEN
    v_set_clauses := array_append(v_set_clauses, format('category_id = %L', p_category_id));
  END IF;
  IF p_belongs_to_member IS NOT NULL THEN
    v_set_clauses := array_append(v_set_clauses, format('belongs_to_member = %L', p_belongs_to_member));
  END IF;

  v_set_clauses := array_append(v_set_clauses, 'updated_at = now()');

  EXECUTE format(
    'UPDATE %I.documents SET %s WHERE id = %L',
    v_schema,
    array_to_string(v_set_clauses, ', '),
    p_document_id
  );

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (p_user_id, p_family_id, 'update_document', 'document', p_document_id);
END;
$fn$;

-- 024's description, never on a sealed document.
CREATE OR REPLACE FUNCTION public.set_document_description(
  p_family_id uuid, p_document_id uuid, p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ns TEXT;
  v_status TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this family';
  END IF;

  SELECT storage_namespace INTO v_ns
  FROM public.families WHERE id = p_family_id;

  IF v_ns IS NULL THEN
    RAISE EXCEPTION 'Family not found';
  END IF;

  EXECUTE format(
    'ALTER TABLE %I.documents ADD COLUMN IF NOT EXISTS description TEXT',
    v_ns
  );

  EXECUTE format('SELECT d.ingestion_status FROM %I.documents d WHERE d.id = $1', v_ns) INTO v_status USING p_document_id;
  IF v_status = 'sealed' AND p_description IS NOT NULL THEN
    RAISE EXCEPTION 'This document is locked: its description is not kept readable.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;

  EXECUTE format(
    'UPDATE %I.documents SET description = $1, updated_at = now() WHERE id = $2',
    v_ns
  ) USING p_description, p_document_id;
END;
$fn$;


-- ─── 4. Sealed parts count toward the space ─────────────────────────────────
-- 040's count of a vault's files, with its sealed parts and records.
CREATE OR REPLACE FUNCTION public.family_files_bytes(p_ns text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT (
    coalesce((SELECT sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,15}$' THEN (o.metadata->>'size')::bigint END)
                FROM storage.objects o
               WHERE p_ns ~ '^family_[0-9a-f]{8}$'
                 AND o.bucket_id = 'documents'
                 AND o.name LIKE replace(p_ns, '_', '\_') || '/%'), 0)
    + coalesce((SELECT sum(octet_length(s.file_key) + octet_length(s.details) + coalesce(octet_length(s.passages), 0))
                  FROM public.sealed_documents s JOIN public.families f ON f.id = s.family_id
                 WHERE f.storage_namespace = p_ns), 0)
    + coalesce((SELECT sum(octet_length(i.sealed))
                  FROM public.sealed_vault_items i JOIN public.families f ON f.id = i.family_id
                 WHERE f.storage_namespace = p_ns), 0)
  )::bigint;
$fn$;

-- 060's count of what one person added on Free, with their sealed parts.
CREATE OR REPLACE FUNCTION public.person_free_files_bytes(p_user uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT (
    coalesce((SELECT sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,15}$' THEN (o.metadata->>'size')::bigint END)
                FROM public.family_members m
                JOIN public.families f ON f.id = m.family_id
                JOIN storage.objects o ON o.bucket_id = 'documents'
                                      AND o.owner_id = p_user::text
                                      AND o.name LIKE replace(f.storage_namespace, '_', '\_') || '/%'
               WHERE m.user_id = p_user
                 AND f.storage_namespace ~ '^family_[0-9a-f]{8}$'
                 AND public.family_plan_now(f.id) = 'free'), 0)
    + coalesce((SELECT sum(octet_length(s.file_key) + octet_length(s.details) + coalesce(octet_length(s.passages), 0))
                  FROM public.sealed_documents s
                  JOIN public.family_members m ON m.family_id = s.family_id AND m.user_id = p_user
                 WHERE s.added_by = p_user
                   AND public.family_plan_now(s.family_id) = 'free'), 0)
  )::bigint;
$fn$;


-- ─── 5. A person's keys: only where locking is on, and not without limit ────
CREATE OR REPLACE FUNCTION public.e2e_keys_writes_allowed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF NOT public.e2e_locking_allowed() THEN
    RAISE EXCEPTION 'Encryption keys are not switched on here.' USING ERRCODE = 'P0001', HINT = 'not_allowed';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS user_keys_allowed ON public.user_keys;
CREATE TRIGGER user_keys_allowed BEFORE INSERT OR UPDATE ON public.user_keys
  FOR EACH ROW EXECUTE FUNCTION public.e2e_keys_writes_allowed();
DROP TRIGGER IF EXISTS key_unlocks_allowed ON public.key_unlocks;
CREATE TRIGGER key_unlocks_allowed BEFORE INSERT OR UPDATE ON public.key_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.e2e_keys_writes_allowed();
DROP TRIGGER IF EXISTS key_device_requests_allowed ON public.key_device_requests;
CREATE TRIGGER key_device_requests_allowed BEFORE INSERT ON public.key_device_requests
  FOR EACH ROW EXECUTE FUNCTION public.e2e_keys_writes_allowed();

-- 071's new keys: three times a day at most, one notice an admin a day.
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
  IF (SELECT count(*) FROM public.audit_logs a
       WHERE a.user_id = v_me AND a.action = 'identity_replaced' AND a.created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'You made new keys three times today. Try again tomorrow.' USING ERRCODE = 'P0001', HINT = 'identity_limit';
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
    JOIN public.family_members admin ON admin.family_id = lv.family_id AND admin.role = 'admin' AND admin.user_id <> v_me
   WHERE NOT EXISTS (SELECT 1 FROM public.notifications n
                      WHERE n.user_id = admin.user_id AND n.family_id = lv.family_id AND n.type = 'keys_changed'
                        AND n.title = left(coalesce(v_name, 'Someone') || ' set up a new phone', 200)
                        AND n.created_at > now() - interval '1 day');

  INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
  VALUES (v_me, 'identity_replaced', 'user_keys', jsonb_build_object('fingerprint', p_fingerprint, 'key_version', v_version));
  RETURN v_version;
END;
$fn$;

-- 071's phone lock: one log row when it is new, none when it is replaced.
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
  v_new     boolean;
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
    RETURNING id, (xmax = 0) INTO v_id, v_new;
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_keys';
  END;
  IF v_new THEN
    INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id)
    VALUES (v_me, 'key_unlock_added', 'key_unlocks', v_id);
  END IF;
  RETURN v_id;
END;
$fn$;


-- ─── Grants ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.lock_vault(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_vault_key_version(uuid, integer, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.discard_my_vault_grant(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_device_keys(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.offer_device_nonce(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reveal_device_nonce(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_vault(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_vault_key_version(uuid, integer, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.discard_my_vault_grant(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.request_device_keys(text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.offer_device_nonce(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reveal_device_nonce(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.family_files_bytes(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_free_files_bytes(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_files_bytes(text), public.person_free_files_bytes(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.locked_vault_member_left() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.e2e_keys_writes_allowed() FROM PUBLIC, anon, authenticated;
