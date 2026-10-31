-- ============================================================================
-- 068: the owner stays the owner; only the owner makes a family a business;
--      the activity log is the server's; an invitation's lookup is counted
--
-- 057 made deleting a whole vault the owner's alone (family_owner(): its
-- creator while an admin, else its longest-standing admin), because since 047
-- one admin cannot delete another member's documents. Three gaps remained:
--
--   • Any admin could remove the owner, or make them a viewer, and so become
--     the owner. A trigger on family_members now refuses removing or
--     demoting the owner unless the owner does it (leaving, stepping down)
--     or the server does (account deletion, deleting a vault: no session).
--   • Any admin could make a free family vault a business (054), after which
--     every admin may delete anyone's documents (051). Only the owner may
--     now, and the move counts as the creator's one free business: before,
--     making families into businesses one after another gave one account any
--     number of free businesses (create_family() counts kinds as they are).
--     business_vault_preview() says why for another admin (not_owner).
--   • Clients could write public.audit_logs (Supabase's default grants and
--     002's audit_logs_insert policy). The app never does: every function
--     that writes it runs as its owner. But 050's invitation limits count
--     its invite_sent rows, so any account could use up another vault's
--     invitations for the day. Client writes are revoked and the policy
--     dropped; reading stays as it was (superusers only).
--
-- And the two functions that look an address up in auth.users for an
-- invitation (invite_family_member, invite_family_person_account) refused a
-- personal vault only after the lookup, and counted nothing when no account
-- was found: any account could ask, without limit or trace, whether an
-- email belongs to someone on AskLocker. invite_lookup_guard() now runs
-- before the lookup: it refuses a personal vault (HINT personal_vault) and
-- more than twice the plan's invitations a day in lookups by one admin
-- (HINT invite_limit), and writes an invite_lookup row to the activity log.
-- The two functions are 051's and 037's, with the guard added.
--
-- my_vault_owners() tells the app who owns each vault the caller is in, so
-- Manage Family hides Remove and Make viewer on the owner, and Settings ›
-- Your vaults offers Make it a business to the owner alone.
--
-- Run it in the SQL editor of DEV, then PROD. Then run qa/sql/sweep.sql
-- (zero rows) and compare qa/sql/fingerprint.sql on both projects.
-- ============================================================================


-- ─── 1. The owner stays the owner ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vault_owner_stays()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me    uuid := auth.uid();
  v_owner uuid;
  v_name  text;
BEGIN
  -- Only an admin can be the owner, and staying an admin changes nothing.
  IF OLD.role IS DISTINCT FROM 'admin'
     OR (TG_OP = 'UPDATE' AND NEW.role = 'admin') THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  -- The server (no session), or the person themselves.
  IF v_me IS NULL OR v_me = OLD.user_id THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  v_owner := public.family_owner(OLD.family_id);
  IF v_owner = OLD.user_id THEN
    SELECT coalesce(nullif(btrim(u.display_name), ''), split_part(u.email, '@', 1)) INTO v_name
      FROM public.users u WHERE u.id = v_owner;
    RAISE EXCEPTION '% owns this vault. Only they can leave it or stop being an admin.', coalesce(v_name, 'This person')
      USING ERRCODE = '42501', HINT = 'owner';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS family_members_owner_stays ON public.family_members;
CREATE TRIGGER family_members_owner_stays
  BEFORE DELETE OR UPDATE OF role ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.vault_owner_stays();

-- Who owns each vault the caller is in.
CREATE OR REPLACE FUNCTION public.my_vault_owners()
RETURNS TABLE (family_id uuid, owner_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT m.family_id, public.family_owner(m.family_id)
    FROM public.family_members m
   WHERE m.user_id = auth.uid();
$fn$;


-- ─── 2. Only the owner makes a family a business, and it counts ─────────────
-- 064's rule, with the creator's free businesses counted (create_family()'s
-- businesses_per_person, 051/055) and, for a caller other than the owner,
-- not_owner.
CREATE OR REPLACE FUNCTION public.business_vault_blocker(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_f      public.families%ROWTYPE;
  v_plan   text;
  v_paid   timestamptz;
  v_used   bigint;
  v_free   bigint;
  v_cap    integer;
  v_owner  uuid;
  v_name   text;
  v_reason text;
  v_msg    text;
BEGIN
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason', 'missing', 'message', 'This vault no longer exists.');
  END IF;
  v_used := coalesce(public.family_files_bytes(v_f.storage_namespace), 0)
          + coalesce(public.family_chats_bytes(p_family_id), 0);
  SELECT coalesce(pl.business_storage_bytes, pl.storage_bytes), pl.businesses_per_person INTO v_free, v_cap
    FROM public.plan_limits pl WHERE pl.plan = 'free';
  v_plan := public.family_plan_now(p_family_id);
  SELECT fp.paid_until INTO v_paid FROM public.family_plans fp WHERE fp.family_id = p_family_id;
  v_owner := public.family_owner(p_family_id);

  IF coalesce(v_f.is_personal, false) THEN
    v_reason := 'personal_vault';
    v_msg    := 'A personal vault stays personal.';
  ELSIF v_f.kind = 'business' THEN
    v_reason := 'already_business';
    v_msg    := 'This is already a business vault.';
  ELSIF auth.uid() IS NOT NULL AND v_owner IS DISTINCT FROM auth.uid() THEN
    SELECT coalesce(nullif(btrim(u.display_name), ''), split_part(u.email, '@', 1)) INTO v_name
      FROM public.users u WHERE u.id = v_owner;
    v_reason := 'not_owner';
    v_msg    := format('Only %s can make this a business vault. They own it.', coalesce(v_name, 'its owner'));
  ELSIF v_plan <> 'free' THEN
    v_reason := 'plan_active';
    v_msg    := format('%s runs until %s. Make this a business vault after it ends, or ask us in Settings › Feedback.',
                       public.family_plan_name(v_plan), to_char((v_paid AT TIME ZONE 'Asia/Kolkata')::date, 'FMDD FMMonth YYYY'));
  ELSIF v_used > v_free THEN
    v_reason := 'storage_over';
    v_msg    := format('This vault holds %s. A free business keeps %s. Make room first, or ask us in Settings › Feedback.',
                       public.size_text(v_used), public.size_text(v_free));
  ELSIF v_cap IS NOT NULL AND (
    SELECT count(*) FROM public.families f
     WHERE f.created_by = v_f.created_by
       AND f.id <> p_family_id
       AND NOT coalesce(f.is_personal, false)
       AND f.kind = 'business'
       AND public.family_plan_now(f.id) = 'free'
  ) >= v_cap THEN
    v_reason := 'business_limit';
    v_msg    := CASE
                  WHEN v_cap = 0 THEN 'On Free, a family cannot become a business. Ask us in Settings › Feedback.'
                  WHEN v_f.created_by = auth.uid()
                    THEN format('On Free, you can have %s, and you have it already. Move it to a paid plan first, or ask us in Settings › Feedback.',
                                CASE WHEN v_cap = 1 THEN 'one business' ELSE v_cap || ' businesses' END)
                  ELSE format('On Free, a person can have %s, and whoever created this family has it already. Ask us in Settings › Feedback.',
                              CASE WHEN v_cap = 1 THEN 'one business' ELSE v_cap || ' businesses' END)
                END;
  END IF;

  RETURN jsonb_build_object('reason', v_reason, 'message', v_msg,
                            'used_bytes', v_used, 'free_bytes', v_free,
                            'paid_until', CASE WHEN v_plan <> 'free' THEN v_paid END);
END;
$fn$;

-- 054's, refusing anyone but the owner. The rule is the blocker's, so
-- another admin is told who can (not_owner) before anything is changed.
CREATE OR REPLACE FUNCTION public.make_business_vault(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_f      public.families%ROWTYPE;
  v_block  jsonb;
  v_people uuid[];
  v_cards  integer;
  v_links  integer;
  v_name   text;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Only an admin of this family can do this.' USING ERRCODE = '42501';
  END IF;
  -- The family's row is locked, as when a plan is given or a member joins,
  -- so nothing changes its plan or its people halfway through. The
  -- creator's businesses are counted under the same lock create_family()
  -- takes, so two at once cannot both take the last one.
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtext('create_family:' || v_f.created_by::text));
  v_block := public.business_vault_blocker(p_family_id);
  IF (v_block->>'reason') = 'not_owner' THEN
    RAISE EXCEPTION '%', v_block->>'message' USING ERRCODE = '42501', HINT = 'owner';
  ELSIF (v_block->>'reason') IS NOT NULL THEN
    RAISE EXCEPTION '%', v_block->>'message' USING ERRCODE = 'P0001', HINT = v_block->>'reason';
  END IF;

  -- What only a family uses.
  DELETE FROM public.family_emergency_cards c WHERE c.family_id = p_family_id;
  GET DIAGNOSTICS v_cards = ROW_COUNT;
  DELETE FROM public.family_links l WHERE l.family_id = p_family_id;
  GET DIAGNOSTICS v_links = ROW_COUNT;
  SELECT coalesce(array_agg(p.id), '{}') INTO v_people
    FROM public.family_people p WHERE p.family_id = p_family_id AND p.user_id IS NULL;
  IF cardinality(v_people) > 0 THEN
    EXECUTE format('UPDATE %I.documents SET belongs_to_member = NULL WHERE belongs_to_member = ANY($1)', v_f.storage_namespace)
      USING v_people;
    -- An invitation to be one of them goes with them (a cascade), and its
    -- notification with it, as when an admin withdraws one (037).
    DELETE FROM public.notifications n
     USING public.family_invites i
     WHERE i.family_id = p_family_id AND i.person_id = ANY(v_people)
       AND n.user_id = i.user_id AND n.family_id = p_family_id AND n.type = 'invite';
    DELETE FROM public.family_people p WHERE p.family_id = p_family_id AND p.id = ANY(v_people);
  END IF;
  UPDATE public.family_people p SET gender = NULL, birth_date = NULL, nickname = NULL, updated_at = now()
   WHERE p.family_id = p_family_id
     AND (p.gender IS NOT NULL OR p.birth_date IS NOT NULL OR p.nickname IS NOT NULL);
  -- An ended plan: a business whose paid plan ended reads as closed (051).
  DELETE FROM public.family_plans fp WHERE fp.family_id = p_family_id;

  UPDATE public.families f SET kind = 'business' WHERE f.id = p_family_id;

  SELECT coalesce(nullif(btrim(u.display_name), ''), split_part(u.email, '@', 1)) INTO v_name
    FROM public.users u WHERE u.id = v_me;
  INSERT INTO public.notifications (user_id, family_id, type, title, message)
  SELECT m.user_id, p_family_id, 'member', 'Now a business vault',
         format('%s made %s a business vault.', coalesce(v_name, 'An admin'), v_f.name)
    FROM public.family_members m
   WHERE m.family_id = p_family_id AND m.user_id <> v_me;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id, metadata)
  VALUES (v_me, p_family_id, 'make_business', 'family', p_family_id,
          jsonb_build_object('cards', v_cards, 'links', v_links, 'people', cardinality(v_people)));

  RETURN jsonb_build_object('kind', 'business', 'cards', v_cards, 'links', v_links,
                            'people', cardinality(v_people));
END;
$fn$;

-- business_vault_preview (064) is unchanged: it shows any admin the
-- blocker's answer, not_owner and business_limit included.


-- ─── 3. The activity log is the server's ────────────────────────────────────
DROP POLICY IF EXISTS audit_logs_insert ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.audit_logs FROM PUBLIC, anon, authenticated;


-- ─── 4. An invitation's lookup is checked and counted ───────────────────────
CREATE OR REPLACE FUNCTION public.invite_lookup_guard(p_family_id uuid, p_invited_by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_max integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.families f WHERE f.id = p_family_id AND f.is_personal) THEN
    RAISE EXCEPTION 'A personal vault is for its owner alone: nobody else can be invited to it or join it. Create a family to share documents.'
      USING HINT = 'personal_vault';
  END IF;
  SELECT pl.invites_per_day INTO v_max FROM public.plan_limits pl WHERE pl.plan = public.family_plan_now(p_family_id);
  v_max := 2 * coalesce(v_max, 20);
  -- One admin at a time, so two requests at once cannot both take the last.
  PERFORM pg_advisory_xact_lock(hashtext('invite_lookup:' || p_invited_by::text));
  IF (SELECT count(*) FROM public.audit_logs a
       WHERE a.user_id = p_invited_by AND a.action = 'invite_lookup'
         AND a.created_at > now() - interval '1 day') >= v_max THEN
    RAISE EXCEPTION 'You have tried % addresses today. You can invite more tomorrow.', v_max
      USING ERRCODE = 'P0001', HINT = 'invite_limit';
  END IF;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type)
  VALUES (p_invited_by, p_family_id, 'invite_lookup', 'family');
END;
$fn$;

CREATE INDEX IF NOT EXISTS audit_logs_user_action_time ON public.audit_logs (user_id, action, created_at);

-- 051's invite_family_member, with the guard before the lookup.
CREATE OR REPLACE FUNCTION public.invite_family_member(
  p_family_id    uuid,
  p_invited_by   uuid,
  p_email        text,
  p_role         text DEFAULT 'viewer',
  p_alias        text DEFAULT NULL,
  p_relationship text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_role   text := coalesce(nullif(btrim(p_role), ''), 'viewer');
  v_user   uuid;
  v_name   text;
  v_invite uuid;
  v_family text;
  v_kind   text;
  v_adder  text;
BEGIN
  IF v_role NOT IN ('admin', 'viewer') THEN
    RAISE EXCEPTION 'Unknown role: %', v_role USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
     WHERE family_id = p_family_id AND user_id = p_invited_by AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not allowed: only a family admin can add members' USING ERRCODE = '42501';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(v_email) > 320 THEN
    RETURN jsonb_build_object('status', 'invalid_email');
  END IF;
  PERFORM public.invite_lookup_guard(p_family_id, p_invited_by);

  -- The same account lookup as 025 and 033.
  SELECT a.id, u.display_name INTO v_user, v_name
    FROM auth.users a
    JOIN public.users u ON u.id = a.id
   WHERE lower(a.email) = v_email
     AND a.email_confirmed_at IS NOT NULL
     AND a.deleted_at IS NULL
     AND NOT coalesce(a.is_anonymous, false)
     AND (a.banned_until IS NULL OR a.banned_until < now())
   LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family_id AND user_id = v_user) THEN
    RETURN jsonb_build_object('status', 'already_member', 'display_name', v_name);
  END IF;

  INSERT INTO public.family_invites (family_id, user_id, email, role, alias, relationship, invited_by)
  VALUES (p_family_id, v_user, v_email, v_role,
          left(nullif(btrim(p_alias), ''), 120), left(nullif(btrim(p_relationship), ''), 40), p_invited_by)
  ON CONFLICT (family_id, user_id) DO NOTHING
  RETURNING id INTO v_invite;
  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('status', 'already_invited', 'email', v_email);
  END IF;

  SELECT name, kind INTO v_family, v_kind FROM public.families WHERE id = p_family_id;
  SELECT display_name INTO v_adder FROM public.users WHERE id = p_invited_by;
  INSERT INTO public.notifications (user_id, family_id, type, title, message)
  VALUES (
    v_user, p_family_id, 'invite',
    left(format('%s invited you to join %s', coalesce(v_adder, CASE WHEN v_kind = 'business' THEN 'An admin' ELSE 'A family admin' END), v_family), 200),
    CASE WHEN v_kind = 'business'
      THEN format('Join %s as %s? You see its records only if you accept. Answer on Home.',
                  v_family, CASE v_role WHEN 'admin' THEN 'an admin' ELSE 'a viewer' END)
      ELSE format('Join %s as %s? You see its documents only if you accept. Answer on Home or in Manage Family.',
                  v_family, CASE v_role WHEN 'admin' THEN 'an admin' ELSE 'a viewer' END) END
  );
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (p_invited_by, p_family_id, 'invite_member', 'family_invite', v_invite);

  RETURN jsonb_build_object('status', 'invited', 'invite_id', v_invite, 'email', v_email, 'role', v_role);
END;
$fn$;

-- 037's invite_family_person_account, with the guard before the lookup.
CREATE OR REPLACE FUNCTION public.invite_family_person_account(
  p_family_id  uuid,
  p_invited_by uuid,
  p_person_id  uuid,
  p_email      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_person public.family_people%ROWTYPE;
  v_user   uuid;
  v_name   text;
  v_other  text;
  v_invite uuid;
  v_new    boolean;
  v_family text;
  v_adder  text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.family_members
     WHERE family_id = p_family_id AND user_id = p_invited_by AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not allowed: only a family admin can link someone to their account' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_person FROM public.family_people
   WHERE id = p_person_id AND family_id = p_family_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'no_person');
  END IF;
  IF v_person.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_linked', 'display_name', v_person.display_name);
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' OR length(v_email) > 320 THEN
    RETURN jsonb_build_object('status', 'invalid_email');
  END IF;
  PERFORM public.invite_lookup_guard(p_family_id, p_invited_by);

  SELECT a.id, u.display_name INTO v_user, v_name
    FROM auth.users a
    JOIN public.users u ON u.id = a.id
   WHERE lower(a.email) = v_email
     AND a.email_confirmed_at IS NOT NULL
     AND a.deleted_at IS NULL
     AND NOT coalesce(a.is_anonymous, false)
     AND (a.banned_until IS NULL OR a.banned_until < now())
   LIMIT 1;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('status', 'no_account');
  END IF;

  -- In the family already: nothing new opens up to them, so the two entries
  -- become one now, as 033 does it.
  IF EXISTS (SELECT 1 FROM public.family_members WHERE family_id = p_family_id AND user_id = v_user) THEN
    RETURN public.link_family_person_account(p_family_id, p_invited_by, p_person_id, p_email);
  END IF;
  IF EXISTS (SELECT 1 FROM public.family_members WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'That entry cannot be linked: its id is already a membership.' USING ERRCODE = '23505';
  END IF;

  -- Someone else is already asked to be this person.
  SELECT email INTO v_other FROM public.family_invites WHERE person_id = p_person_id AND user_id <> v_user;
  IF v_other IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_invited', 'email', v_other);
  END IF;

  -- Asked already, by email alone: when they accept, they join as this
  -- person, so their place in the tree is kept.
  INSERT INTO public.family_invites AS fi (family_id, user_id, email, person_id, invited_by)
  VALUES (p_family_id, v_user, v_email, p_person_id, p_invited_by)
  ON CONFLICT (family_id, user_id) DO UPDATE SET person_id = EXCLUDED.person_id
  RETURNING fi.id, (fi.xmax = 0) INTO v_invite, v_new;

  IF v_new THEN
    SELECT name INTO v_family FROM public.families WHERE id = p_family_id;
    SELECT display_name INTO v_adder FROM public.users WHERE id = p_invited_by;
    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    VALUES (
      v_user, p_family_id, 'invite',
      left(format('%s invited you to join %s', coalesce(v_adder, 'A family admin'), v_family), 200),
      format('Join %s as a viewer, as %s in the family tree? You see its documents only if you accept. Answer on Home or in Manage Family.',
             v_family, v_person.display_name)
    );
  END IF;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (p_invited_by, p_family_id, 'invite_person_account', 'family_person', p_person_id);

  RETURN jsonb_build_object(
    'status', 'invited', 'invite_id', v_invite, 'email', v_email, 'display_name', v_person.display_name
  );
END;
$fn$;


-- ─── Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.vault_owner_stays()                       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invite_lookup_guard(uuid, uuid)          FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_lookup_guard(uuid, uuid)       TO service_role;
REVOKE ALL ON FUNCTION public.business_vault_blocker(uuid)             FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_vault_blocker(uuid)          TO service_role;
REVOKE ALL ON FUNCTION public.make_business_vault(uuid)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_business_vault(uuid)             TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.my_vault_owners()                        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vault_owners()                     TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.invite_family_member(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_family_member(uuid, uuid, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.invite_family_person_account(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_family_person_account(uuid, uuid, uuid, text) TO service_role;
