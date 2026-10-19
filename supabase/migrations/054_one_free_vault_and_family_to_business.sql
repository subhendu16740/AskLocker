-- ============================================================================
-- 054: One free vault, and a family vault that becomes a business
--
-- A small business may start in a family vault on Family Plus, which costs
-- less, and move to a business vault when it grows, keeping every document.
-- The owner chose this on 17 October 2026. Three parts:
--
--   1. On Free, a person creates one vault besides their personal vault: a
--      family or a business (plan_limits.vaults_per_person, 1). Until now it
--      was one of each (050's families_per_person and 051's
--      businesses_per_person, both kept, and still checked within it). A
--      vault on a paid plan does not count, so paying for one lets a person
--      create another. Vaults made before stay.
--   2. Numbers no family comes near and a busy office does, so the move to a
--      business pays: Family Plus 100 documents a day (was 500) and 50
--      question tries a day (was 100), only where still the old number. One
--      person's fair use on Family Plus is the family's 200 where a project
--      has 150 (an unmerged 053 that set it was applied to DEV), so one
--      person may use the family's whole month, as 053 means. Business Plus
--      10 people (was 5), more than Family Plus's 8.
--   3. "Make this a business vault": business_vault_preview() and
--      make_business_vault(), for an admin of a family vault, the caller
--      from auth.uid(). One way only: a business keeps its records when
--      people leave (051), and turning back would undo that. Every document,
--      member, invitation, share link and saved chat stays, and business
--      rules apply from then on. What only a family uses goes, because a
--      business's members are its team: emergency cards (health details),
--      the tree's links, people in the tree without an account (their
--      documents stay, unmarked, and an invitation to be one of them goes
--      with its notification), and every member's birth date, gender and
--      nickname. Refused:
--        - for a personal vault, or a vault that is already a business;
--        - while Family Plus is paid up: what was paid for is not lost
--          (wait for it to end, or ask us);
--        - while the vault holds more than a free business may keep. A
--          business is never cleaned up (051), so without this one month of
--          Family Plus could buy 10 GB kept for nothing for ever.
--      An ended plan row goes: a business whose paid plan ended reads as
--      closed (051), and this one starts on Free. Every other member is told
--      (a 'member' notification, which opens Manage Family).
--
-- business_vault_blocker() is the rule, in one place. It takes an id, so it
-- is the server's alone; the two client functions ask it after checking
-- that the caller is an admin.
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both.
-- Safe to run more than once. Needs 053.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'family_questions_per_month') THEN
    RAISE EXCEPTION 'Apply 053_family_plus_shares_questions.sql first.';
  END IF;
END
$do$;


-- ─── 1. One free vault, of either kind ─────────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'vaults_per_person') THEN
    ALTER TABLE public.plan_limits ADD COLUMN vaults_per_person integer
      CONSTRAINT plan_limits_vaults_per_person CHECK (vaults_per_person IS NULL OR vaults_per_person >= 0);
    UPDATE public.plan_limits SET vaults_per_person = 1 WHERE plan = 'free';
  END IF;
END
$do$;

COMMENT ON COLUMN public.plan_limits.vaults_per_person IS
  'Vaults, families and businesses together, on this plan one person may have created besides their personal vault (054). NULL: no combined limit. A new vault starts on Free, so the free row is the one read.';


-- ─── 2. The numbers that make the move pay ─────────────────────────────────
UPDATE public.plan_limits SET
  uploads_per_day        = CASE WHEN uploads_per_day = 500        THEN 100 ELSE uploads_per_day END,
  question_tries_per_day = CASE WHEN question_tries_per_day = 100 THEN 50  ELSE question_tries_per_day END,
  questions_fair_use     = CASE WHEN questions_fair_use = 150     THEN 200 ELSE questions_fair_use END
WHERE plan = 'plus';

UPDATE public.plan_limits SET max_members = 10
 WHERE plan = 'business_plus' AND max_members = 5;


-- ─── 3. Creating a vault: one free one in all ──────────────────────────────
-- 051's create_family, with the combined count first.
CREATE OR REPLACE FUNCTION public.create_family(
  p_user_id       uuid,
  p_family_name   character varying,
  p_description   text              DEFAULT NULL::text,
  p_family_icon   character varying DEFAULT NULL::character varying,
  p_is_personal   boolean           DEFAULT false,
  p_kind          text              DEFAULT 'family'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
declare
  v_family_id  uuid;
  v_short_id   text;
  v_storage_ns text;
  v_vector_ns  text;
  v_cap        integer;
  v_vaults     integer;
  v_kind       text := coalesce(nullif(btrim(p_kind), ''), 'family');
begin
  perform public.assert_caller_is(p_user_id);

  if v_kind not in ('family', 'business') then
    raise exception 'A vault is a family or a business.' using errcode = '22023';
  end if;
  if coalesce(p_is_personal, false) and v_kind <> 'family' then
    raise exception 'A personal vault is always a family vault.' using errcode = '22023';
  end if;

  -- On Free, a person creates plan_limits.vaults_per_person vaults of either
  -- kind (1, 054) besides their personal vault, and within that
  -- families_per_person families and businesses_per_person businesses. A
  -- vault on a paid plan does not count. Serialised per person, so two tabs
  -- cannot both make the last one.
  if not coalesce(p_is_personal, false) then
    perform pg_advisory_xact_lock(hashtext('create_family:' || p_user_id::text));
    select pl.vaults_per_person into v_vaults from public.plan_limits pl where pl.plan = 'free';
    if v_vaults is not null and (
      select count(*) from public.families f
       where f.created_by = p_user_id
         and not coalesce(f.is_personal, false)
         and public.family_plan_now(f.id) = 'free'
    ) >= v_vaults then
      raise exception '%',
        case
          when v_vaults = 0
            then 'On Free, you cannot create a family or a business. Ask someone to invite you instead.'
          when v_vaults = 1
            then 'On Free, you can create one family or one business besides your personal vault. To create another, move the one you created to a paid plan.'
          else format('On Free, you can create %s families or businesses besides your personal vault. To create another, move one you created to a paid plan.', v_vaults)
        end
        using errcode = 'P0001', hint = 'family_limit';
    end if;

    select case when v_kind = 'business' then pl.businesses_per_person else pl.families_per_person end
      into v_cap
      from public.plan_limits pl where pl.plan = 'free';
    if v_cap is not null and (
      select count(*) from public.families f
       where f.created_by = p_user_id
         and not coalesce(f.is_personal, false)
         and f.kind = v_kind
         and public.family_plan_now(f.id) = 'free'
    ) >= v_cap then
      raise exception '%',
        case
          when v_kind = 'business' and v_cap = 0
            then 'On Free, you cannot create a business. Ask your business''s admin to invite you instead.'
          when v_kind = 'business'
            then format('On Free, you can create %s. To create another, move the one you created to a paid plan.',
                        case when v_cap = 1 then 'one business' else v_cap || ' businesses' end)
          when v_cap = 0
            then 'On Free, you cannot create a family. Ask someone in your family to invite you instead.'
          else format('On Free, you can create %s besides your personal vault. To create another, move a family you created to Family Plus.',
                      case when v_cap = 1 then 'one family' else v_cap || ' families' end)
        end
        using errcode = 'P0001', hint = 'family_limit';
    end if;
  end if;

  v_family_id  := gen_random_uuid();
  v_short_id   := replace(left(v_family_id::text, 8), '-', '');
  v_storage_ns := 'family_' || v_short_id;
  v_vector_ns  := 'fv_' || v_short_id;

  insert into public.families (id, name, description, created_by, family_icon, storage_namespace, vector_namespace, is_personal, kind)
  values (v_family_id, p_family_name, p_description, p_user_id, p_family_icon, v_storage_ns, v_vector_ns, p_is_personal, v_kind);

  execute format('create schema %I', v_storage_ns);

  execute format('create table %I.documents (
    id uuid primary key default gen_random_uuid(),
    uploaded_by uuid not null,
    file_name varchar(255) not null,
    file_type varchar(20) not null,
    file_size_bytes bigint,
    storage_path text not null,
    category_id uuid,
    belongs_to_member uuid,
    ocr_text text,
    ingestion_status varchar(20) default ''pending'',
    is_deleted boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
  )', v_storage_ns);

  execute format('create table %I.document_metadata (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    key varchar(100) not null,
    value text not null,
    auto_extracted boolean default false,
    confidence float
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.document_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    chunk_index integer not null,
    content text not null,
    token_count integer,
    embedding_id varchar(100),
    created_at timestamptz default now()
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.expiry_alerts (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references %I.documents(id) on delete cascade,
    expiry_date date not null,
    alert_days_before integer[] default ''{90, 30, 7}'',
    last_notified_at timestamptz,
    is_expired boolean default false,
    auto_detected boolean default false
  )', v_storage_ns, v_storage_ns);

  execute format('create table %I.family_relationships (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null,
    related_to uuid not null,
    relationship_type varchar(50) not null,
    aliases text[]
  )', v_storage_ns);

  execute format('create index idx_%s_docs_category on %I.documents(category_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_docs_member on %I.documents(belongs_to_member)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_docs_status on %I.documents(ingestion_status)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_chunks_doc on %I.document_chunks(document_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_metadata_doc on %I.document_metadata(document_id)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_metadata_key on %I.document_metadata(key)', v_short_id, v_storage_ns);
  execute format('create index idx_%s_expiry_date on %I.expiry_alerts(expiry_date)', v_short_id, v_storage_ns);

  perform public.upgrade_family_schema_for_search(v_family_id);

  insert into public.family_members (family_id, user_id, role, can_upload, can_delete)
  values (v_family_id, p_user_id, 'admin', true, true);

  insert into public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  values (p_user_id, v_family_id, 'create_family', 'family', v_family_id);

  return v_family_id;
end;
$fn$;


-- ─── 4. What stands in the way of a family vault becoming a business ───────
-- The rule, in one place: { reason, message, used_bytes, free_bytes,
-- paid_until }, reason null when nothing does. Takes an id: the server's alone.
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
  v_reason text;
  v_msg    text;
BEGIN
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('reason', 'missing', 'message', 'This vault no longer exists.');
  END IF;
  v_used := coalesce(public.family_files_bytes(v_f.storage_namespace), 0)
          + coalesce(public.family_chats_bytes(p_family_id), 0);
  v_free := public.vault_storage_bytes(p_family_id, 'free');
  v_plan := public.family_plan_now(p_family_id);
  SELECT fp.paid_until INTO v_paid FROM public.family_plans fp WHERE fp.family_id = p_family_id;

  IF coalesce(v_f.is_personal, false) THEN
    v_reason := 'personal_vault';
    v_msg    := 'A personal vault stays personal.';
  ELSIF v_f.kind = 'business' THEN
    v_reason := 'already_business';
    v_msg    := 'This is already a business vault.';
  ELSIF v_plan <> 'free' THEN
    v_reason := 'plan_active';
    v_msg    := format('Family Plus runs until %s. Make this a business vault after it ends, or ask us in Settings › Feedback.',
                       to_char((v_paid AT TIME ZONE 'Asia/Kolkata')::date, 'FMDD FMMonth YYYY'));
  ELSIF v_used > v_free THEN
    v_reason := 'storage_over';
    v_msg    := format('This vault holds %s. A free business keeps %s. Make room first, or ask us in Settings › Feedback.',
                       public.size_text(v_used), public.size_text(v_free));
  END IF;

  RETURN jsonb_build_object('reason', v_reason, 'message', v_msg,
                            'used_bytes', v_used, 'free_bytes', v_free,
                            'paid_until', CASE WHEN v_plan <> 'free' THEN v_paid END);
END;
$fn$;


-- ─── 5. What the move would do: for the admin, before they say yes ─────────
CREATE OR REPLACE FUNCTION public.business_vault_preview(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me    uuid := auth.uid();
  v_ns    text;
  v_block jsonb;
  v_docs  bigint;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me AND m.role = 'admin') THEN
    RAISE EXCEPTION 'Only an admin of this family can do this.' USING ERRCODE = '42501';
  END IF;
  v_block := public.business_vault_blocker(p_family_id);
  SELECT f.storage_namespace INTO v_ns FROM public.families f WHERE f.id = p_family_id;
  EXECUTE format('SELECT count(*) FROM %I.documents WHERE NOT coalesce(is_deleted, false)', v_ns) INTO v_docs;

  RETURN v_block || jsonb_build_object(
    'allowed',      (v_block->>'reason') IS NULL,
    'documents',    v_docs,
    'members',      (SELECT count(*) FROM public.family_members m WHERE m.family_id = p_family_id),
    'free_members', (SELECT pl.max_members FROM public.plan_limits pl WHERE pl.plan = 'free'),
    'cards',        (SELECT count(*) FROM public.family_emergency_cards c WHERE c.family_id = p_family_id),
    'people',       (SELECT count(*) FROM public.family_people p WHERE p.family_id = p_family_id AND p.user_id IS NULL),
    'links',        (SELECT count(*) FROM public.family_links l WHERE l.family_id = p_family_id));
END;
$fn$;


-- ─── 6. Making it a business ───────────────────────────────────────────────
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
  -- so nothing changes its plan or its people halfway through.
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id FOR UPDATE;
  v_block := public.business_vault_blocker(p_family_id);
  IF (v_block->>'reason') IS NOT NULL THEN
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


-- ─── Grants ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.business_vault_blocker(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.business_vault_blocker(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.business_vault_preview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_vault_preview(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.make_business_vault(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.make_business_vault(uuid) TO authenticated, service_role;
