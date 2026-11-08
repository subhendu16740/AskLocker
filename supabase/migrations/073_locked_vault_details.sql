-- 073: A locked vault's name, family tree, emergency cards and notes, sealed
-- on the phone (docs/end-to-end-encryption.md, Phase 3). Test builds only,
-- like 071: nothing changes in a vault that is not locked.
--
-- 071 sealed a locked vault's documents. Everything else it holds stayed
-- readable to the server: its name, the family tree (names, nicknames,
-- genders, dates of birth, how people are related), the emergency cards and
-- the business notes. Now each is sealed with the vault's key on a member's
-- device, bound to its place (the vault, the kind of record, the person), and
-- the readable copy goes:
--
--   sealed_vault_items   one row per sealed record: the vault's name, its
--                        tree links, each person, each emergency card.
--                        Members read their vault's rows; no client writes.
--   seal_vault_item()    writes one record and blanks the readable copy:
--                        the vault's name becomes "Locked vault" (and the
--                        vault's own notifications stop saying the old one),
--                        a person "Person" with no gender, birth date or
--                        nickname, the tree's readable links and a person's
--                        readable card are deleted. An admin, or for a person
--                        or a card, that person themselves (031's and 032's
--                        rule). The caller from auth.uid().
--   add_sealed_person()  someone new in the tree, an admin's. The phone
--                        chooses the id, since the sealed record is bound to it.
--   delete_vault_item()  an emptied emergency card. An admin, or the person.
--   paid_bills()         a locked business's bills marked paid (056's
--                        set_bill_paid, unchanged), for the overview the
--                        phone works out. A member's.
--
-- Notes stay in scratch_notes, each person's own (056): in a locked vault the
-- body is sealed on the phone ("n1.<version>.<id>.<sealed>"), and a reminder
-- on one says "A note reminder" instead of its first line.
--
-- In a locked vault the database refuses the readable versions, on every
-- path: a vault name or description changed, a person added without an
-- account or given a readable name, gender, date of birth or nickname, a
-- readable tree link, a readable emergency card, a readable note. A member's
-- own entry, made with their membership (031's trigger), keeps their account
-- name until their app seals it. The tree's rules (two parents at most,
-- nobody their own ancestor, one link a pair) are kept by the app there,
-- since the server cannot see the links; who may write is still the server's.
--
-- Still readable in a locked vault: who is a member, with what role; how
-- many people the tree has (its rows, without names); which bills were
-- marked paid and when (the activity log records it anyway); a note's
-- reminder date. Birthday reminders stop for a locked vault: the server no
-- longer knows anyone's birthday.
--
-- Apply to DEV, then PROD. Safe to run twice. Nothing a person sees changes
-- in a vault that is not locked.


-- ─── 1. Sealed records ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sealed_vault_items (
  family_id    uuid        NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('vault-name', 'tree-links', 'person', 'emergency-card')),
  -- The vault's own id for its name and links; the person's for the others.
  item_id      uuid        NOT NULL,
  key_version  integer     NOT NULL CHECK (key_version >= 1),
  sealed       text        NOT NULL CHECK (sealed ~ '^e1\.[A-Za-z0-9_-]+$' AND char_length(sealed) <= 400000),
  updated_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, kind, item_id)
);

ALTER TABLE public.sealed_vault_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sealed_vault_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.sealed_vault_items TO authenticated;
GRANT ALL ON public.sealed_vault_items TO service_role;
DROP POLICY IF EXISTS sealed_vault_items_read ON public.sealed_vault_items;
CREATE POLICY sealed_vault_items_read ON public.sealed_vault_items FOR SELECT TO authenticated
  USING (family_id IN (SELECT public.get_my_family_ids()));


-- ─── 2. Writing a sealed record ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seal_vault_item(
  p_family_id   uuid,
  p_kind        text,
  p_item_id     uuid,
  p_key_version integer,
  p_sealed      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_role    text;
  v_person  public.family_people%ROWTYPE;
  v_old     text;
  v_pattern text;
  v_cap     integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS NULL THEN
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
  IF p_kind NOT IN ('vault-name', 'tree-links', 'person', 'emergency-card') THEN
    RAISE EXCEPTION 'Unknown kind of record.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END IF;

  IF p_kind IN ('vault-name', 'tree-links') THEN
    IF v_role <> 'admin' THEN
      RAISE EXCEPTION 'Only an admin can change this.' USING ERRCODE = '42501', HINT = 'needs_admin';
    END IF;
    IF p_item_id IS DISTINCT FROM p_family_id THEN
      RAISE EXCEPTION 'This record is not in the form AskLocker expects.' USING ERRCODE = '22023', HINT = 'bad_sealed';
    END IF;
  ELSE
    SELECT * INTO v_person FROM public.family_people p WHERE p.id = p_item_id AND p.family_id = p_family_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That person is not in this family''s tree.' USING ERRCODE = '22023', HINT = 'no_person';
    END IF;
    IF v_role <> 'admin' AND NOT (v_person.user_id IS NOT NULL AND v_person.user_id = v_me) THEN
      RAISE EXCEPTION 'Only a family admin, or the person themselves, can change these details.' USING ERRCODE = '42501';
    END IF;
  END IF;
  v_cap := CASE p_kind WHEN 'tree-links' THEN 400000 WHEN 'emergency-card' THEN 20000 ELSE 4000 END;
  IF char_length(coalesce(p_sealed, '')) > v_cap THEN
    RAISE EXCEPTION 'This is too long to keep.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END IF;

  BEGIN
    INSERT INTO public.sealed_vault_items (family_id, kind, item_id, key_version, sealed, updated_by)
    VALUES (p_family_id, p_kind, p_item_id, p_key_version, p_sealed, v_me)
    ON CONFLICT (family_id, kind, item_id) DO UPDATE
      SET key_version = EXCLUDED.key_version, sealed = EXCLUDED.sealed,
          updated_by = EXCLUDED.updated_by, updated_at = now();
  EXCEPTION WHEN check_violation THEN
    RAISE EXCEPTION 'This record is not in the form AskLocker expects.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END;

  -- The readable copy goes.
  PERFORM set_config('asklocker.sealed_write', 'on', true);
  IF p_kind = 'vault-name' THEN
    SELECT f.name INTO v_old FROM public.families f WHERE f.id = p_family_id;
    UPDATE public.families SET name = 'Locked vault', description = NULL
     WHERE id = p_family_id AND (name IS DISTINCT FROM 'Locked vault' OR description IS NOT NULL);
    -- The vault's own notifications stop naming it (whole words only).
    IF v_old IS NOT NULL AND btrim(v_old) <> '' AND v_old <> 'Locked vault' THEN
      v_pattern := '\m' || regexp_replace(v_old, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g') || '\M';
      UPDATE public.notifications
         SET title   = left(regexp_replace(title, v_pattern, 'Locked vault', 'g'), 200),
             message = regexp_replace(message, v_pattern, 'Locked vault', 'g')
       WHERE family_id = p_family_id
         AND (title ~ v_pattern OR coalesce(message, '') ~ v_pattern);
    END IF;
  ELSIF p_kind = 'tree-links' THEN
    DELETE FROM public.family_links WHERE family_id = p_family_id;
  ELSIF p_kind = 'person' THEN
    UPDATE public.family_people
       SET display_name = 'Person', gender = NULL, birth_date = NULL, nickname = NULL, updated_at = now()
     WHERE id = p_item_id AND family_id = p_family_id
       AND (display_name IS DISTINCT FROM 'Person' OR gender IS NOT NULL OR birth_date IS NOT NULL OR nickname IS NOT NULL);
  ELSE
    DELETE FROM public.family_emergency_cards WHERE family_id = p_family_id AND person_id = p_item_id;
  END IF;
  PERFORM set_config('asklocker.sealed_write', '', true);
END;
$fn$;

-- Someone new in a locked vault's tree. An admin; the phone chooses the id.
CREATE OR REPLACE FUNCTION public.add_sealed_person(
  p_family_id   uuid,
  p_person_id   uuid,
  p_key_version integer,
  p_sealed      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me   uuid := auth.uid();
  v_role text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only a family admin can change the family tree.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vault_key_grants g JOIN public.user_keys k ON k.user_id = g.user_id
                  WHERE g.family_id = p_family_id AND g.version = p_key_version AND g.user_id = v_me
                    AND g.identity_version = k.key_version) THEN
    RAISE EXCEPTION 'You do not hold this vault''s key yet.' USING ERRCODE = '42501', HINT = 'no_key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = p_family_id) THEN
    RAISE EXCEPTION 'This vault is not locked.' USING ERRCODE = 'P0001', HINT = 'not_locked';
  END IF;
  IF p_person_id IS NULL OR EXISTS (SELECT 1 FROM public.family_people WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'This person is in the tree already.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END IF;
  IF char_length(coalesce(p_sealed, '')) > 4000 OR coalesce(p_sealed, '') !~ '^e1\.[A-Za-z0-9_-]+$' THEN
    RAISE EXCEPTION 'This record is not in the form AskLocker expects.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END IF;

  PERFORM set_config('asklocker.sealed_write', 'on', true);
  INSERT INTO public.family_people (id, family_id, display_name, created_by)
  VALUES (p_person_id, p_family_id, 'Person', v_me);
  PERFORM set_config('asklocker.sealed_write', '', true);

  INSERT INTO public.sealed_vault_items (family_id, kind, item_id, key_version, sealed, updated_by)
  VALUES (p_family_id, 'person', p_person_id, p_key_version, p_sealed, v_me);
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, 'add_person', 'family_person', p_person_id);
  RETURN p_person_id;
END;
$fn$;

-- An emergency card emptied: its sealed record goes. An admin, or the person.
CREATE OR REPLACE FUNCTION public.delete_vault_item(p_family_id uuid, p_kind text, p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_role   text;
  v_user   uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT m.role INTO v_role FROM public.family_members m WHERE m.family_id = p_family_id AND m.user_id = v_me;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not in this vault.' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS DISTINCT FROM 'emergency-card' THEN
    RAISE EXCEPTION 'Only an emergency card is deleted this way.' USING ERRCODE = '22023', HINT = 'bad_sealed';
  END IF;
  SELECT p.user_id INTO v_user FROM public.family_people p WHERE p.id = p_item_id AND p.family_id = p_family_id;
  IF v_role <> 'admin' AND NOT (v_user IS NOT NULL AND v_user = v_me) THEN
    RAISE EXCEPTION 'Only a family admin, or the person themselves, can change an emergency card.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.sealed_vault_items WHERE family_id = p_family_id AND kind = p_kind AND item_id = p_item_id;
END;
$fn$;

-- A locked business's bills marked paid: what 056's set_bill_paid keeps,
-- for the overview the phone works out from the documents it opens.
CREATE OR REPLACE FUNCTION public.paid_bills(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_schema text;
  v_out    jsonb;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  SELECT f.storage_namespace INTO v_schema FROM public.families f WHERE f.id = p_family_id AND f.kind = 'business';
  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'This is for business vaults.' USING ERRCODE = 'P0001', HINT = 'not_business';
  END IF;
  EXECUTE format($q$
    SELECT coalesce(jsonb_agg(jsonb_build_object('document_id', m.document_id, 'paid_on', m.value)), '[]'::jsonb)
      FROM %1$I.document_metadata m JOIN %1$I.documents d ON d.id = m.document_id AND NOT coalesce(d.is_deleted, false)
     WHERE m.key = 'paid_on'
  $q$, v_schema) INTO v_out;
  RETURN v_out;
END;
$fn$;


-- ─── 3. A locked vault refuses readable copies ──────────────────────────────
-- Every path: the app, an older app, a script with the public key. The seal
-- functions above write placeholders under asklocker.sealed_write.

CREATE OR REPLACE FUNCTION public.locked_vault_name_stays_sealed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF coalesce(current_setting('asklocker.sealed_write', true), '') = 'on'
     OR NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name
     OR (NEW.description IS DISTINCT FROM OLD.description AND NEW.description IS NOT NULL) THEN
    RAISE EXCEPTION 'This vault is locked: its name is changed on a member''s phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS families_locked_name ON public.families;
CREATE TRIGGER families_locked_name
  BEFORE UPDATE OF name, description ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.locked_vault_name_stays_sealed();

CREATE OR REPLACE FUNCTION public.locked_vault_people_stay_sealed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF coalesce(current_setting('asklocker.sealed_write', true), '') = 'on'
     OR NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = NEW.family_id) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    -- A member's own entry, made with their membership: their account's
    -- name, until their app seals it.
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION 'This vault is locked: people are added to its tree on your phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
    END IF;
    RETURN NEW;
  END IF;
  IF (NEW.display_name IS DISTINCT FROM OLD.display_name AND NEW.display_name <> 'Person')
     OR (NEW.gender IS DISTINCT FROM OLD.gender AND NEW.gender IS NOT NULL)
     OR (NEW.birth_date IS DISTINCT FROM OLD.birth_date AND NEW.birth_date IS NOT NULL)
     OR (NEW.nickname IS DISTINCT FROM OLD.nickname AND NEW.nickname IS NOT NULL) THEN
    RAISE EXCEPTION 'This vault is locked: its family tree is changed on your phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS family_people_locked ON public.family_people;
CREATE TRIGGER family_people_locked
  BEFORE INSERT OR UPDATE ON public.family_people
  FOR EACH ROW EXECUTE FUNCTION public.locked_vault_people_stay_sealed();

CREATE OR REPLACE FUNCTION public.locked_vault_links_stay_sealed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF coalesce(current_setting('asklocker.sealed_write', true), '') <> 'on'
     AND EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = NEW.family_id) THEN
    RAISE EXCEPTION 'This vault is locked: its family tree is changed on your phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS family_links_locked ON public.family_links;
CREATE TRIGGER family_links_locked
  BEFORE INSERT ON public.family_links
  FOR EACH ROW EXECUTE FUNCTION public.locked_vault_links_stay_sealed();

CREATE OR REPLACE FUNCTION public.locked_vault_cards_stay_sealed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  IF coalesce(current_setting('asklocker.sealed_write', true), '') = 'on'
     OR NOT EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = NEW.family_id) THEN
    RETURN NEW;
  END IF;
  -- A card moved with its person (033's merge) is not new content.
  IF TG_OP = 'INSERT'
     OR (to_jsonb(NEW) - 'person_id' - 'updated_at' - 'updated_by') IS DISTINCT FROM (to_jsonb(OLD) - 'person_id' - 'updated_at' - 'updated_by') THEN
    RAISE EXCEPTION 'This vault is locked: emergency cards are saved on your phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS family_emergency_cards_locked ON public.family_emergency_cards;
CREATE TRIGGER family_emergency_cards_locked
  BEFORE INSERT OR UPDATE ON public.family_emergency_cards
  FOR EACH ROW EXECUTE FUNCTION public.locked_vault_cards_stay_sealed();


-- ─── 4. Notes: sealed in a locked vault ─────────────────────────────────────
-- A sealed body is longer than 2,000 characters of text: 056's column check
-- is replaced by one that takes either.
DO $do$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.conrelid = 'public.scratch_notes'::regclass AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) ILIKE '%char_length%body%'
       AND c.conname <> 'scratch_notes_body_sealed_or_text'
  LOOP
    EXECUTE format('ALTER TABLE public.scratch_notes DROP CONSTRAINT %I', v_name);
  END LOOP;
END
$do$;

ALTER TABLE public.scratch_notes DROP CONSTRAINT IF EXISTS scratch_notes_body_sealed_or_text;
ALTER TABLE public.scratch_notes ADD CONSTRAINT scratch_notes_body_sealed_or_text CHECK (
  (body ~ '^n1\.[0-9]+\.[0-9a-f-]{36}\.e1\.[A-Za-z0-9_-]+$' AND char_length(body) <= 12000)
  OR (body !~ '^n1\.' AND char_length(btrim(body)) BETWEEN 1 AND 2000)
);

CREATE OR REPLACE FUNCTION public.scratch_notes_sealed_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
DECLARE
  v_locked boolean := EXISTS (SELECT 1 FROM public.locked_vaults WHERE family_id = NEW.family_id);
  v_sealed boolean := NEW.body ~ '^n1\.';
BEGIN
  IF v_locked AND NOT v_sealed THEN
    RAISE EXCEPTION 'This vault is locked: notes are locked on your phone.' USING ERRCODE = 'P0001', HINT = 'vault_locked';
  END IF;
  IF v_sealed AND NOT v_locked THEN
    RAISE EXCEPTION 'This note is not in the form AskLocker expects.' USING ERRCODE = 'P0001', HINT = 'bad_sealed';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS scratch_notes_sealed ON public.scratch_notes;
CREATE TRIGGER scratch_notes_sealed
  BEFORE INSERT OR UPDATE OF body ON public.scratch_notes
  FOR EACH ROW EXECUTE FUNCTION public.scratch_notes_sealed_rules();

-- 056's reminder, with a sealed note's title said in words.
CREATE OR REPLACE FUNCTION public.queue_note_reminders(p_now timestamptz DEFAULT now())
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_local timestamp := coalesce(p_now, now()) AT TIME ZONE 'Asia/Kolkata';
  v_today date := (coalesce(p_now, now()) AT TIME ZONE 'Asia/Kolkata')::date;
  v_n     integer;
BEGIN
  IF extract(hour FROM v_local) < 9 THEN
    RETURN 0;
  END IF;
  WITH due AS (
    SELECT n.id, n.user_id, n.family_id, n.body, f.name
      FROM public.scratch_notes n
      JOIN public.families f ON f.id = n.family_id
     WHERE NOT n.done
       AND n.reminded_at IS NULL
       AND n.remind_on BETWEEN v_today - 7 AND v_today
       AND f.kind = 'business'
       AND public.family_plan_now(n.family_id) <> 'free'
     ORDER BY n.remind_on
     LIMIT 1000
     FOR UPDATE OF n SKIP LOCKED
  ), made AS (
    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    SELECT d.user_id, d.family_id, 'note',
           CASE WHEN d.body ~ '^n1\.' THEN 'A note reminder'
                ELSE left(split_part(btrim(d.body), E'\n', 1), 80) END,
           format('Your note in %s', d.name)
      FROM due d
    RETURNING 1
  )
  UPDATE public.scratch_notes n SET reminded_at = coalesce(p_now, now())
    FROM due d WHERE n.id = d.id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$fn$;


-- ─── 5. Records go with their person ────────────────────────────────────────
-- Someone taken out of the tree takes their sealed details and card; someone
-- who leaves takes their card (032's rule), and stays in the tree by name.
CREATE OR REPLACE FUNCTION public.sealed_items_follow_people()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  DELETE FROM public.sealed_vault_items
   WHERE family_id = OLD.family_id AND item_id = OLD.id AND kind IN ('person', 'emergency-card');
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS sealed_items_follow_people ON public.family_people;
CREATE TRIGGER sealed_items_follow_people
  AFTER DELETE ON public.family_people
  FOR EACH ROW EXECUTE FUNCTION public.sealed_items_follow_people();

CREATE OR REPLACE FUNCTION public.sealed_cards_follow_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $fn$
BEGIN
  DELETE FROM public.sealed_vault_items
   WHERE family_id = OLD.family_id AND kind = 'emergency-card'
     AND item_id IN (SELECT p.id FROM public.family_people p
                      WHERE p.family_id = OLD.family_id AND (p.id = OLD.id OR p.user_id = OLD.user_id));
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS sealed_cards_follow_members ON public.family_members;
CREATE TRIGGER sealed_cards_follow_members
  BEFORE DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.sealed_cards_follow_members();


-- ─── Grants ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.seal_vault_item(uuid, text, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_sealed_person(uuid, uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_vault_item(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.paid_bills(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seal_vault_item(uuid, text, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_sealed_person(uuid, uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_vault_item(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.paid_bills(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.locked_vault_name_stays_sealed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.locked_vault_people_stay_sealed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.locked_vault_links_stay_sealed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.locked_vault_cards_stay_sealed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.scratch_notes_sealed_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sealed_items_follow_people() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sealed_cards_follow_members() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_note_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_note_reminders(timestamptz) TO service_role;
