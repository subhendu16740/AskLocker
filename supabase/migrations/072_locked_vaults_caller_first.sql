-- 072: who is asking comes first, in two of 071's functions.
--
-- 071's lock_vault() said whether locking is switched on before it checked
-- the caller owns the vault, and insert_sealed_document() said whether a
-- vault is locked before it checked the caller holds its key. Nothing was
-- let through either way, but anyone signed in could learn whether a vault
-- they are not in is locked, by naming its id. QA's access probes found it:
-- they want a stranger refused for being a stranger.
--
-- Now each checks the caller first: lock_vault() the owner, then the
-- switch; insert_sealed_document() the key, then the lock (holding a key
-- means the vault is locked, so that check stays only as a guard). The
-- bodies are otherwise 071's, unchanged. Grants are restated as 071 gave
-- them.
--
-- Apply to DEV, then PROD. Safe to run twice. Nothing a person sees changes.

-- The owner first, then the switch.
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
  IF public.family_owner(p_family_id) IS DISTINCT FROM v_me THEN
    RAISE EXCEPTION 'Only the owner of this vault can lock it.' USING ERRCODE = '42501', HINT = 'owner';
  END IF;
  IF NOT public.e2e_locking_allowed() THEN
    RAISE EXCEPTION 'Locked vaults are not switched on here.' USING ERRCODE = 'P0001', HINT = 'not_allowed';
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

-- The vault's key first, then the lock.
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
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
                  WHERE g.family_id = p_family_id AND g.version = p_key_version AND g.user_id = v_me
                    AND g.identity_version = k.key_version) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;

  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id;
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'This document is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.documents d WHERE d.id = $1)', v_schema) INTO v_taken USING p_document_id;
  IF v_taken OR EXISTS (SELECT 1 FROM public.sealed_documents s WHERE s.family_id = p_family_id AND s.document_id = p_document_id) THEN
    RAISE EXCEPTION 'This document is there already.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;

  PERFORM set_config('asklocker.sealed_insert', 'on', true);
  v_doc := public.insert_family_document(p_family_id, v_me, 'Locked document', p_file_type, p_file_size_bytes,
                                         p_storage_path, p_category_id, p_belongs_to_member);
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

REVOKE ALL ON FUNCTION public.lock_vault(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_sealed_document(uuid, uuid, character varying, bigint, text, uuid, uuid, integer, text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lock_vault(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_sealed_document(uuid, uuid, character varying, bigint, text, uuid, uuid, integer, text, text, text, integer) TO authenticated, service_role;
