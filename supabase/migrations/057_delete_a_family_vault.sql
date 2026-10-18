-- ============================================================================
-- 057: Delete a family vault, from Settings › Your vaults
--
-- The owner asked on 18 October 2026 for every vault a person is in to be
-- listed in Settings, family vaults and business vaults apart, with deleting
-- there too, so that Manage Family only manages the family. A business could
-- already be deleted (051: any admin, typing its name). A family went only
-- with its last admin's account (029). Now its owner deletes it on purpose.
--
--   1. family_owner(): the family's creator while they are an admin of it;
--      once they are not (left, or made a viewer), its longest-standing
--      admin. The same person 029 hands created_by to when a creator
--      deletes their account. Only the owner deletes a family: since 047 an
--      admin cannot delete another member's documents one by one, so a
--      second admin cannot delete them all at once either.
--   2. family_deletion_plan(): what goes, for an admin of a family vault
--      (42501 otherwise): its name, its folder, who else loses it, how many
--      documents, and whether this admin is its owner (and if not, who is).
--      Never a personal vault (HINT personal_vault: it goes only with its
--      account) or a business (HINT business: 051's way).
--   3. purge_family_vault(): its owner, the name typed, then 029's
--      purge_family(): rows, schema, index state, invitations and
--      notifications. The delete-account function removes the files first,
--      as for a business. Everyone else in it is told, in their personal
--      vault, since a notification goes with its vault.
--
-- All three take ids, so all three are service role only (point 2 at the
-- top of CLAUDE.md); the delete-account function passes the caller from the
-- session. Nothing a client calls changes.
--
-- Apply after 056, DEV first, then PROD. Then run qa/sql/sweep.sql (zero
-- rows) and qa/sql/fingerprint.sql on both. Safe to run more than once.
-- ============================================================================

-- ─── 1. Whose family it is ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.family_owner(p_family_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(
    (SELECT f.created_by
       FROM public.families f
       JOIN public.family_members m
         ON m.family_id = f.id AND m.user_id = f.created_by AND m.role = 'admin'
      WHERE f.id = p_family_id),
    (SELECT m.user_id
       FROM public.family_members m
      WHERE m.family_id = p_family_id AND m.role = 'admin'
      ORDER BY m.joined_at NULLS LAST, m.user_id
      LIMIT 1));
$fn$;


-- ─── 2. What deleting a family takes ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.family_deletion_plan(p_user_id uuid, p_family_id uuid)
RETURNS TABLE (family_id uuid, family_name text, storage_namespace text, is_owner boolean,
               owner_name text, other_members text[], document_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_f     public.families%ROWTYPE;
  v_owner uuid;
BEGIN
  SELECT f.* INTO v_f
    FROM public.families f
    JOIN public.family_members m ON m.family_id = f.id AND m.user_id = p_user_id AND m.role = 'admin'
   WHERE f.id = p_family_id;
  IF v_f.id IS NULL THEN
    RAISE EXCEPTION 'Not allowed: only an admin of this family can see this' USING ERRCODE = '42501';
  END IF;
  IF v_f.is_personal THEN
    RAISE EXCEPTION 'Your personal vault goes only with your account.' USING ERRCODE = 'P0001', HINT = 'personal_vault';
  END IF;
  IF v_f.kind = 'business' THEN
    RAISE EXCEPTION 'A business is deleted as a business.' USING ERRCODE = 'P0001', HINT = 'business';
  END IF;

  v_owner           := public.family_owner(p_family_id);
  family_id         := v_f.id;
  family_name       := v_f.name;
  storage_namespace := v_f.storage_namespace;
  is_owner          := v_owner = p_user_id;
  SELECT coalesce(u.display_name, u.email) INTO owner_name FROM public.users u WHERE u.id = v_owner;
  SELECT coalesce(array_agg(coalesce(u.display_name, u.email) ORDER BY m.joined_at), '{}')
    INTO other_members
    FROM public.family_members m
    JOIN public.users u ON u.id = m.user_id
   WHERE m.family_id = p_family_id AND m.user_id <> p_user_id;
  document_count := 0;
  IF to_regclass(format('%I.documents', v_f.storage_namespace)) IS NOT NULL THEN
    EXECUTE format('SELECT count(*)::int FROM %I.documents', v_f.storage_namespace) INTO document_count;
  END IF;
  RETURN NEXT;
END;
$fn$;


-- ─── 3. Deleting it ────────────────────────────────────────────────────────
-- Returns the folder, for files added while it was being deleted.
CREATE OR REPLACE FUNCTION public.purge_family_vault(p_user_id uuid, p_family_id uuid, p_confirm_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_f    public.families%ROWTYPE;
  v_who  text;
  r      record;
BEGIN
  SELECT f.* INTO v_f FROM public.families f WHERE f.id = p_family_id FOR UPDATE;
  IF v_f.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                    WHERE m.family_id = p_family_id AND m.user_id = p_user_id AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Not allowed: only an admin of this family can see this' USING ERRCODE = '42501';
  END IF;
  IF v_f.is_personal THEN
    RAISE EXCEPTION 'Your personal vault goes only with your account.' USING ERRCODE = 'P0001', HINT = 'personal_vault';
  END IF;
  IF v_f.kind = 'business' THEN
    RAISE EXCEPTION 'A business is deleted as a business.' USING ERRCODE = 'P0001', HINT = 'business';
  END IF;
  IF public.family_owner(p_family_id) IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Only its owner can delete %.', v_f.name USING ERRCODE = '42501', HINT = 'not_owner';
  END IF;
  IF lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_f.name)) THEN
    RAISE EXCEPTION 'Type the family''s name, %, to delete it.', v_f.name
      USING ERRCODE = '22023', HINT = 'wrong_name';
  END IF;

  -- The others are told in their own personal vault: a notification in this
  -- family would go with it.
  SELECT coalesce(u.display_name, u.email) INTO v_who FROM public.users u WHERE u.id = p_user_id;
  FOR r IN
    SELECT m.user_id, pv.id AS personal_id
      FROM public.family_members m
      JOIN public.families pv ON pv.created_by = m.user_id AND pv.is_personal
      JOIN public.family_members pm ON pm.family_id = pv.id AND pm.user_id = m.user_id
     WHERE m.family_id = p_family_id AND m.user_id <> p_user_id
  LOOP
    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    VALUES (r.user_id, r.personal_id, 'member',
            format('%s was deleted', v_f.name),
            format('%s deleted %s and everything in it.', coalesce(v_who, 'Its owner'), v_f.name));
  END LOOP;

  RETURN public.purge_family(p_family_id);
END;
$fn$;


-- ─── Grants: the server's alone ────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.family_owner(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_deletion_plan(uuid, uuid)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_family_vault(uuid, uuid, text)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION
  public.family_owner(uuid), public.family_deletion_plan(uuid, uuid), public.purge_family_vault(uuid, uuid, text)
  TO service_role;
