-- ============================================================================
-- 051: Business vaults — a pilot for small businesses
--
-- A business is a vault like any other — its own schema, folder, plan,
-- limits, invitations and share links — with families.kind = 'business'.
-- Set once, when the vault is made (create_family's new last parameter),
-- and never by a client afterwards: 025's column grants let clients change
-- a vault's name, description and icon, nothing else. A personal vault is
-- always a family.
--
-- Family vaults keep every rule they had. A business changes four:
--
--   1. An admin deletes any document, and its file. Everyone else deletes
--      only what they added (047's rule).
--   2. A business always keeps an admin. The last admin cannot leave or
--      make themselves a viewer (a trigger, so every way in obeys it), and
--      deleting their account is refused until someone else is an admin or
--      the business itself is deleted — by an admin who types its name
--      (purge_business, through the delete-account function).
--   3. Nothing is ever removed when a plan ends. A paid plan that ends keeps
--      every record and stops adding (family_storage_status().closed) until
--      it is renewed; a trial that ends (source 'trial') puts the business
--      back on Free. One notice either way.
--   4. Birthday reminders are not made for a business. The app hides the
--      family tree, emergency cards and the "whose document" picker, and
--      rag-search does not read relations ("Nani") in a business vault.
--      031's trigger still makes a family_people row per member.
--
-- Plans — a business has its own three, and never Family Plus:
--   • Plus ('business_plus'):             5 members,  25 GB
--   • Pro ('business_pro'):              15 members, 100 GB
--   • Enterprise ('business_enterprise'): 50 members, 200 GB
--   On each, 100 questions a person a month (fair use, no monthly limit
--   shown), no voice limit, 300 uploads and 30 question tries a day each,
--   and 20 invitations a day (50 on Enterprise). Rows to change in the
--   Table editor; the prices are BUSINESS_PRICE in
--   supabase/functions/_shared/plan-text.ts. Even a business that used
--   every limit at once would cost less than its plan's price.
--   • plan_limits gains invites_per_day (20 on Free and Plus) and
--     businesses_per_person (1 on Free: a person on Free creates one family
--     AND one business, besides their personal vault).
--   • set_family_plan() takes the plan name as a new last parameter. A
--     business must be given one of its two by name; Family Plus is refused
--     for a business, and the business plans for a family. So a Razorpay
--     payment (apply_plan_payment(), which names no plan) can only ever make
--     a family Plus — the payments function refuses a business before that.
--   • person_plans(user): the plans of the vaults a person is in, and Free.
--     049's person_on_plus(), question_allowance() and 050's
--     person_daily_limit() take the best of them, number by number, so
--     joining a business never lowers what a Family Plus member had. Voice
--     still follows the vault asked in.
--   • Expiry reminders and 30-day links are for any paid plan, not just Plus.
--
--   Given by hand, from the SQL editor — on PROD only once the Supabase
--   organisation is on Pro, and Groq and HuggingFace are paid:
--     select set_family_plan('<vault id>', now() + interval '14 days', 'trial', null, 'business_pro');
--     select set_family_plan('<vault id>', now() + interval '1 month', 'manual', null, 'business_plus');
--     (or 'business_enterprise')
--
-- Also: document_categories.audience ('family', 'business', 'both') and the
-- business categories; users.use_for (what the person said they would use
-- AskLocker for, written only on their own row).
--
-- Two functions change signature, so the old ones are DROPPED first (with
-- both present, a call naming the older arguments is ambiguous): create_family
-- gains p_kind, set_family_plan gains p_plan. Older callers still resolve,
-- through the defaults. Four change their result and are dropped and made
-- again: family_storage_status (+ business, closed, trial), get_my_invitations
-- (+ family_kind), account_deletion_plan (+ kind, blocked).
--
-- Apply after 050: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and compare qa/sql/fingerprint.sql. Idempotent.
-- ============================================================================

BEGIN;

-- ─── 1. A vault's kind ─────────────────────────────────────────────────────
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'family';
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'families_kind' AND conrelid = 'public.families'::regclass) THEN
    ALTER TABLE public.families ADD CONSTRAINT families_kind CHECK (kind IN ('family', 'business'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'families_personal_is_family' AND conrelid = 'public.families'::regclass) THEN
    ALTER TABLE public.families ADD CONSTRAINT families_personal_is_family
      CHECK (NOT coalesce(is_personal, false) OR kind = 'family');
  END IF;
END
$do$;
COMMENT ON COLUMN public.families.kind IS
  'family or business (051). Set by create_family() when the vault is made; no client writes it.';

-- Is this vault a business? For the functions below; the server's alone.
CREATE OR REPLACE FUNCTION public.is_business_vault(p_family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce((SELECT f.kind = 'business' FROM public.families f WHERE f.id = p_family_id), false);
$fn$;


-- ─── 2. The business plans: Plus, Pro and Enterprise ──────────────────────
-- 038's CHECKs on the plan names, and on family_plans.source, are replaced
-- (found by what they say: their names are Postgres's own).
DO $do$
DECLARE
  c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.plan_limits'::regclass AND contype = 'c'
              AND conname <> 'plan_limits_plan_known'
              AND pg_get_constraintdef(oid) ~ '^CHECK \(\(plan = '
  LOOP
    EXECUTE format('ALTER TABLE public.plan_limits DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'plan_limits_plan_known' AND conrelid = 'public.plan_limits'::regclass) THEN
    ALTER TABLE public.plan_limits ADD CONSTRAINT plan_limits_plan_known
      CHECK (plan IN ('free', 'plus', 'business_plus', 'business_pro', 'business_enterprise'));
  END IF;

  FOR c IN SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.family_plans'::regclass AND contype = 'c'
              AND conname NOT IN ('family_plans_plan_paid', 'family_plans_source_known')
              AND pg_get_constraintdef(oid) ~ '^CHECK \(\((plan|source) = '
  LOOP
    EXECUTE format('ALTER TABLE public.family_plans DROP CONSTRAINT %I', c.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'family_plans_plan_paid' AND conrelid = 'public.family_plans'::regclass) THEN
    ALTER TABLE public.family_plans ADD CONSTRAINT family_plans_plan_paid
      CHECK (plan IN ('plus', 'business_plus', 'business_pro', 'business_enterprise'));
  END IF;
  -- 'trial': a plan switched on by hand for a demo. When it ends, a business
  -- is back on Free rather than closed.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'family_plans_source_known' AND conrelid = 'public.family_plans'::regclass) THEN
    ALTER TABLE public.family_plans ADD CONSTRAINT family_plans_source_known
      CHECK (source IN ('manual', 'razorpay', 'dodo', 'trial'));
  END IF;

  -- Added once, with Free's 1; applying 051 again changes no number someone
  -- has since set in the Table editor.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits' AND column_name = 'businesses_per_person') THEN
    ALTER TABLE public.plan_limits
      ADD COLUMN businesses_per_person integer CHECK (businesses_per_person IS NULL OR businesses_per_person >= 0);
    UPDATE public.plan_limits SET businesses_per_person = 1 WHERE plan = 'free';
  END IF;
END
$do$;

ALTER TABLE public.plan_limits
  ADD COLUMN IF NOT EXISTS invites_per_day integer NOT NULL DEFAULT 20 CHECK (invites_per_day BETWEEN 1 AND 500);

COMMENT ON COLUMN public.plan_limits.invites_per_day IS
  'Invitations a vault on this plan may send in a day (051; 050 kept 20 for every vault). Three to the same person, on every plan.';
COMMENT ON COLUMN public.plan_limits.businesses_per_person IS
  'Businesses on this plan one person may have created (051), counted apart from families_per_person. NULL: no limit. A new vault starts on Free, so the free row is the one read.';

INSERT INTO public.plan_limits (plan, storage_bytes, max_members, voice_answers, questions_per_month,
                                questions_fair_use, uploads_per_day, question_tries_per_day, invites_per_day)
VALUES ('business_plus',        25::bigint * 1024 * 1024 * 1024,  5, NULL, NULL, 100, 300, 30, 20),
       ('business_pro',        100::bigint * 1024 * 1024 * 1024, 15, NULL, NULL, 100, 300, 30, 20),
       ('business_enterprise', 200::bigint * 1024 * 1024 * 1024, 50, NULL, NULL, 100, 300, 30, 50)
ON CONFLICT (plan) DO NOTHING;


-- ─── 3. Which plans a person is on ─────────────────────────────────────────
-- The plans of the vaults a person is in, and Free. No plan is best at
-- everything (Family Plus has more questions each than Business Plus), so
-- each number is the best any of them gives. Take a user id, so they are
-- the server's alone.
CREATE OR REPLACE FUNCTION public.person_plans(p_user_id uuid)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT 'free'
  UNION
  SELECT public.family_plan_now(m.family_id)
    FROM public.family_members m
   WHERE m.user_id = p_user_id;
$fn$;

-- 049's, on any paid plan.
CREATE OR REPLACE FUNCTION public.person_on_plus(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.person_plans(p_user_id) p WHERE p <> 'free');
$fn$;

-- 049's, from whichever of the person's plans allows the most questions.
CREATE OR REPLACE FUNCTION public.question_allowance(p_user_id uuid)
RETURNS TABLE (plus boolean, monthly integer, ceiling integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  RETURN QUERY
  SELECT public.person_on_plus(p_user_id), pl.questions_per_month,
         coalesce(pl.questions_per_month, pl.questions_fair_use)
    FROM public.plan_limits pl
   WHERE pl.plan IN (SELECT public.person_plans(p_user_id))
   ORDER BY coalesce(pl.questions_per_month, pl.questions_fair_use) DESC,
            (pl.questions_per_month IS NULL) DESC
   LIMIT 1;
END;
$fn$;

-- 050's, the most any of the person's plans allows; NULL (no limit) wins.
CREATE OR REPLACE FUNCTION public.person_daily_limit(p_user_id uuid, p_what text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_n        integer;
  v_no_limit boolean;
BEGIN
  SELECT max(x.n), bool_or(x.n IS NULL)
    INTO v_n, v_no_limit
    FROM (SELECT CASE p_what
                   WHEN 'uploads'        THEN pl.uploads_per_day
                   WHEN 'reads'          THEN pl.uploads_per_day * 2
                   WHEN 'question_tries' THEN pl.question_tries_per_day
                 END AS n
            FROM public.plan_limits pl
           WHERE pl.plan IN (SELECT public.person_plans(p_user_id))) x;
  RETURN CASE WHEN v_no_limit THEN NULL ELSE v_n END;
END;
$fn$;


-- ─── 4. Creating a business ────────────────────────────────────────────────
-- 050's create_family, with p_kind last. The five-argument version goes
-- first: beside this one, a call naming its five arguments would be
-- ambiguous. The app's four named arguments and ensure_personal_vault()'s
-- five positional ones resolve to this, through the default.
DROP FUNCTION IF EXISTS public.create_family(uuid, character varying, text, character varying, boolean);
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
  v_kind       text := coalesce(nullif(btrim(p_kind), ''), 'family');
begin
  perform public.assert_caller_is(p_user_id);

  if v_kind not in ('family', 'business') then
    raise exception 'A vault is a family or a business.' using errcode = '22023';
  end if;
  if coalesce(p_is_personal, false) and v_kind <> 'family' then
    raise exception 'A personal vault is always a family vault.' using errcode = '22023';
  end if;

  -- On Free, a person creates plan_limits.families_per_person families and
  -- businesses_per_person businesses (1 each), besides their personal vault.
  -- A vault on a paid plan does not count. Serialised per person, so two
  -- tabs cannot both make the last one.
  if not coalesce(p_is_personal, false) then
    perform pg_advisory_xact_lock(hashtext('create_family:' || p_user_id::text));
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


-- ─── 5. A vault's storage: is it a business, is adding closed, a trial ─────
-- 048's, with three more columns. Its result changes shape, so it is
-- dropped and made again, and family_storage_has_room() (which the upload
-- policy calls) is restated after it.
--   closed  a business whose paid plan ended (not a trial): it keeps every
--           record and adds nothing until the plan is renewed.
--   trial   the plan running now was switched on for a demo.
DROP FUNCTION IF EXISTS public.family_storage_status(uuid);
CREATE FUNCTION public.family_storage_status(p_family_id uuid)
RETURNS TABLE (plan text, paid_until timestamptz, limit_bytes bigint, used_bytes bigint,
               removal_at timestamptz, chats_bytes bigint, personal boolean,
               business boolean, closed boolean, trial boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_ns       text;
  v_personal boolean;
  v_business boolean;
  v_plan     text;
  v_until    timestamptz;
  v_source   text;
  v_chats    bigint;
  v_closed   boolean;
BEGIN
  PERFORM public.assert_caller_in_family(p_family_id);

  SELECT f.storage_namespace, f.is_personal, f.kind = 'business' INTO v_ns, v_personal, v_business
    FROM public.families f WHERE f.id = p_family_id;
  IF v_ns IS NULL OR v_ns !~ '^family_[0-9a-f]{8}$' THEN
    RETURN;
  END IF;

  SELECT fp.plan, fp.paid_until, fp.source INTO v_plan, v_until, v_source
    FROM public.family_plans fp
   WHERE fp.family_id = p_family_id AND fp.paid_until > now();
  IF NOT FOUND THEN
    v_plan := 'free'; v_until := NULL; v_source := NULL;
  END IF;

  v_closed := coalesce(v_business, false) AND v_plan = 'free'
              AND EXISTS (SELECT 1 FROM public.family_plans fp
                           WHERE fp.family_id = p_family_id AND fp.source <> 'trial');

  v_chats := public.family_chats_bytes(p_family_id);
  RETURN QUERY
  SELECT v_plan, v_until,
         public.vault_storage_bytes(p_family_id, v_plan),
         public.family_files_bytes(v_ns) + v_chats,
         public.plan_removal_at(p_family_id),
         v_chats,
         coalesce(v_personal, false),
         coalesce(v_business, false),
         v_closed,
         coalesce(v_source = 'trial', false);
END;
$fn$;

-- 048's, and no room at all in a closed business.
CREATE OR REPLACE FUNCTION public.family_storage_has_room(p_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_family uuid;
  r        record;
BEGIN
  SELECT f.id INTO v_family
    FROM public.families f
    JOIN public.family_members m ON m.family_id = f.id AND m.user_id = auth.uid()
   WHERE f.storage_namespace = p_folder;
  IF v_family IS NULL THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public.family_storage_status(v_family);
  RETURN coalesce(NOT r.closed AND r.used_bytes < r.limit_bytes, false);
END;
$fn$;


-- ─── 6. Giving a plan, by hand or from a payment ───────────────────────────
-- 040's set_family_plan, with p_plan last. The four-argument version goes
-- first, for the reason in section 4; apply_plan_payment()'s four arguments
-- resolve to this, with no plan named.
--   'plus'                           family vaults only (their default)
--   'business_plus', 'business_pro', 'business_enterprise'
--                                    business vaults only, always by name:
--                                    a business has no default, so a
--                                    payment for Family Plus can never
--                                    turn into a business plan
--   p_source 'trial'  a plan switched on for a demo
DROP FUNCTION IF EXISTS public.set_family_plan(uuid, timestamptz, text, text);
CREATE OR REPLACE FUNCTION public.set_family_plan(
  p_family_id  uuid,
  p_paid_until timestamptz,
  p_source     text DEFAULT 'manual',
  p_source_ref text DEFAULT NULL,
  p_plan       text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_plan     text := nullif(btrim(p_plan), '');
  v_source   text := coalesce(p_source, 'manual');
  v_family   text;
  v_kind     text;
  v_was      timestamptz;
  v_was_plan text;
  v_limit    bigint;
BEGIN
  IF p_paid_until IS NULL OR p_paid_until <= now() THEN
    RAISE EXCEPTION 'paid_until must be in the future.' USING ERRCODE = '22023';
  END IF;
  SELECT f.name, f.kind INTO v_family, v_kind FROM public.families f WHERE f.id = p_family_id;
  IF v_family IS NULL THEN
    RAISE EXCEPTION 'No such family.' USING ERRCODE = '22023';
  END IF;
  IF v_kind = 'business' THEN
    IF v_plan IS NULL OR v_plan NOT IN ('business_plus', 'business_pro', 'business_enterprise') THEN
      RAISE EXCEPTION 'A business is on business_plus, business_pro or business_enterprise, named as the last argument. Family Plus is for family vaults.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_plan := coalesce(v_plan, 'plus');
    IF v_plan <> 'plus' THEN
      RAISE EXCEPTION 'A family is on plus. The business plans are for business vaults.' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT fp.paid_until, fp.plan INTO v_was, v_was_plan
    FROM public.family_plans fp WHERE fp.family_id = p_family_id FOR UPDATE;

  INSERT INTO public.family_plans (family_id, plan, paid_until, source, source_ref, updated_at)
  VALUES (p_family_id, v_plan, p_paid_until, v_source, p_source_ref, now())
  ON CONFLICT (family_id) DO UPDATE
     SET plan = EXCLUDED.plan, paid_until = EXCLUDED.paid_until, source = EXCLUDED.source,
         source_ref = EXCLUDED.source_ref, updated_at = now(),
         ended_notice_at = NULL, warned_week_at = NULL, warned_day_at = NULL,
         settled_at = NULL, removed_count = 0, cleanup_until = NULL;

  IF v_was IS NULL OR v_was <= now() OR v_was_plan IS DISTINCT FROM v_plan THEN
    v_limit := public.vault_storage_bytes(p_family_id, v_plan);
    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    SELECT fm.user_id, p_family_id, 'plan',
           left(format(CASE v_plan WHEN 'business_enterprise' THEN '%s has Enterprise'
                                   WHEN 'business_pro'        THEN '%s has Pro'
                                   WHEN 'business_plus'       THEN '%s has Plus'
                                   ELSE '%s has Family Plus' END, v_family), 200),
           CASE WHEN v_kind = 'business' AND v_source = 'trial'
                THEN format('A trial until %s, with room for %s GB of records.',
                            public.ist_day(p_paid_until), trim_scale(round(v_limit / 1073741824.0, 1))::text)
                ELSE format('Room for %s GB of %s, until %s.',
                            trim_scale(round(v_limit / 1073741824.0, 1))::text,
                            CASE WHEN v_kind = 'business' THEN 'records' ELSE 'documents' END,
                            public.ist_day(p_paid_until)) END
      FROM public.family_members fm
     WHERE fm.family_id = p_family_id;
  END IF;

  INSERT INTO public.audit_logs (family_id, action, resource_type, resource_id, metadata)
  VALUES (p_family_id, 'set_family_plan', 'family', p_family_id,
          jsonb_build_object('plan', v_plan, 'source', v_source));
END;
$fn$;


-- ─── 7. When a business's plan ends: one notice, nothing removed, ever ─────
-- 048's queue_plan_notices, with a business settled at once: a paid plan
-- that ended closes adding (family_storage_status), a trial puts it on Free.
-- Family vaults are handled exactly as before.
CREATE OR REPLACE FUNCTION public.queue_plan_notices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r       record;
  v_free  bigint;
  v_days  integer;
  v_used  bigint;
  v_when  timestamptz;
  v_who   text;
  v_head  text;
  v_title text;
  v_msg   text;
  v_made  integer := 0;
BEGIN
  SELECT pl.grace_days INTO v_days FROM public.plan_limits pl WHERE pl.plan = 'plus';
  v_days := coalesce(v_days, 30);

  FOR r IN
    SELECT fp.family_id, fp.plan, fp.source, fp.paid_until, fp.ended_notice_at, fp.warned_week_at, fp.warned_day_at,
           f.name AS family_name, f.storage_namespace AS ns, f.is_personal, f.kind
      FROM public.family_plans fp
      JOIN public.families f ON f.id = fp.family_id
     WHERE fp.paid_until <= now() AND fp.settled_at IS NULL
       FOR UPDATE OF fp SKIP LOCKED
  LOOP
    v_free := public.vault_storage_bytes(r.family_id, 'free');

    IF r.kind = 'business' THEN
      IF r.source = 'trial' THEN
        v_title := format('Your trial has ended for %s', r.family_name);
        v_msg   := format('Your records stay. You''re on Free, with room for %s.', public.size_text(v_free));
      ELSE
        v_title := format('%s has ended for %s',
                          CASE r.plan WHEN 'business_enterprise' THEN 'Enterprise'
                                      WHEN 'business_pro' THEN 'Pro' ELSE 'Plus' END, r.family_name);
        v_msg   := 'Your records stay. To add new ones, renew the plan.';
      END IF;
      UPDATE public.family_plans
         SET ended_notice_at = coalesce(ended_notice_at, now()), settled_at = now(), cleanup_until = NULL
       WHERE family_id = r.family_id;
      INSERT INTO public.notifications (user_id, family_id, type, title, message)
      SELECT fm.user_id, r.family_id, 'plan', left(v_title, 200), v_msg
        FROM public.family_members fm
       WHERE fm.family_id = r.family_id;
      v_made := v_made + 1;
      CONTINUE;
    END IF;

    CONTINUE WHEN v_free IS NULL;
    v_used  := public.family_files_bytes(r.ns);
    v_who   := CASE WHEN r.is_personal THEN 'your personal vault' ELSE r.family_name END;
    v_head := CASE WHEN r.is_personal THEN 'Your personal vault' ELSE r.family_name END;
    v_title := NULL;

    IF v_used <= v_free THEN
      -- Within the free limit: nothing will be removed, and this lapse is done.
      IF r.ended_notice_at IS NULL THEN
        v_title := format('Family Plus has ended for %s', v_who);
        v_msg   := 'Your documents stay. Expiry reminders, the Reminders page and Import from Gmail are part of Family Plus; renew any time to have them again.';
      ELSE
        v_title := format('%s is within the free %s', v_head, public.size_text(v_free));
        v_msg   := 'Nothing will be removed.';
      END IF;
      UPDATE public.family_plans
         SET ended_notice_at = coalesce(ended_notice_at, now()), settled_at = now(), cleanup_until = NULL
       WHERE family_id = r.family_id;
    ELSE
      v_when := greatest(r.paid_until, coalesce(r.ended_notice_at, now())) + make_interval(days => v_days);
      IF r.ended_notice_at IS NULL THEN
        v_title := format('Family Plus has ended for %s', v_who);
        v_msg   := format('%s holds %s, more than the free %s. Renew Family Plus, or delete documents, by %s. After that, the newest documents above %s are removed. Expiry reminders, the Reminders page and Import from Gmail are part of Family Plus.',
                          v_head, public.size_text(v_used), public.size_text(v_free),
                          public.ist_day(v_when), public.size_text(v_free));
        UPDATE public.family_plans SET ended_notice_at = now() WHERE family_id = r.family_id;
      ELSIF r.warned_week_at IS NULL AND now() >= v_when - interval '7 days' AND v_when - now() > interval '1 day' THEN
        v_title := format('In 7 days, documents will be removed from %s', v_who);
        v_msg   := format('On %s, the newest documents above the free %s will be removed. Renew Family Plus, or delete documents to get under %s, to keep them.',
                          public.ist_day(v_when), public.size_text(v_free), public.size_text(v_free));
        UPDATE public.family_plans SET warned_week_at = now() WHERE family_id = r.family_id;
      ELSIF r.warned_day_at IS NULL AND now() >= v_when - interval '1 day' THEN
        v_title := format('Tomorrow, documents will be removed from %s', v_who);
        v_msg   := format('On %s, the newest documents above the free %s will be removed, unless Family Plus is renewed or documents are deleted to get under %s.',
                          public.ist_day(greatest(v_when, now() + interval '20 hours')),
                          public.size_text(v_free), public.size_text(v_free));
        UPDATE public.family_plans SET warned_day_at = now() WHERE family_id = r.family_id;
      END IF;
    END IF;

    IF v_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, family_id, type, title, message)
      SELECT fm.user_id, r.family_id, 'plan', left(v_title, 200), v_msg
        FROM public.family_members fm
       WHERE fm.family_id = r.family_id;
      v_made := v_made + 1;
    END IF;
  END LOOP;

  RETURN v_made;
END;
$fn$;

-- 048's: never a removal date for a business.
CREATE OR REPLACE FUNCTION public.plan_removal_at(p_family_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  fp     record;
  v_ns   text;
  v_free bigint;
  v_days integer;
BEGIN
  IF public.is_business_vault(p_family_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO fp FROM public.family_plans WHERE family_id = p_family_id;
  IF NOT FOUND OR fp.paid_until > now() OR fp.settled_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  SELECT f.storage_namespace INTO v_ns FROM public.families f WHERE f.id = p_family_id;
  v_free := public.vault_storage_bytes(p_family_id, 'free');
  IF v_free IS NULL OR public.family_files_bytes(v_ns) <= v_free THEN
    RETURN NULL;
  END IF;
  SELECT pl.grace_days INTO v_days FROM public.plan_limits pl WHERE pl.plan = 'plus';
  RETURN greatest(fp.paid_until, coalesce(fp.ended_notice_at, now()))
         + make_interval(days => coalesce(v_days, 30));
END;
$fn$;

-- 048's: a business is never a candidate.
CREATE OR REPLACE FUNCTION public.plan_cleanup_candidates()
RETURNS TABLE (family_id uuid, storage_namespace text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_days integer;
BEGIN
  SELECT pl.grace_days INTO v_days FROM public.plan_limits pl WHERE pl.plan = 'plus';
  RETURN QUERY
  SELECT fp.family_id, f.storage_namespace::text
    FROM public.family_plans fp
    JOIN public.families f ON f.id = fp.family_id
   WHERE fp.paid_until <= now()
     AND f.kind = 'family'
     AND fp.settled_at IS NULL
     AND fp.ended_notice_at IS NOT NULL
     AND fp.warned_day_at IS NOT NULL
     AND fp.warned_day_at <= now() - interval '20 hours'
     AND now() >= greatest(fp.paid_until, fp.ended_notice_at) + make_interval(days => coalesce(v_days, 30))
     AND public.family_files_bytes(f.storage_namespace) > public.vault_storage_bytes(fp.family_id, 'free')
   ORDER BY fp.paid_until;
END;
$fn$;

-- 048's, refusing a business even when asked directly.
CREATE OR REPLACE FUNCTION public.plan_take_excess(p_family_id uuid, p_max integer DEFAULT 500)
RETURNS TABLE (name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  fp      record;
  v_ns    text;
  v_free  bigint;
  v_used  bigint;
  v_names text[];
  v_docs  uuid[];
  v_gone  integer := 0;
BEGIN
  SELECT * INTO fp FROM public.family_plans WHERE family_plans.family_id = p_family_id FOR UPDATE;
  IF public.is_business_vault(p_family_id) THEN
    RAISE EXCEPTION 'Nothing is ever removed from a business.' USING ERRCODE = '55000';
  END IF;
  IF NOT FOUND OR fp.cleanup_until IS NULL OR fp.cleanup_until < now() THEN
    RAISE EXCEPTION 'This family is not being cleaned up.' USING ERRCODE = '55000';
  END IF;
  IF fp.paid_until > now() OR fp.settled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Family Plus was renewed, or this family is settled.' USING ERRCODE = '55000';
  END IF;

  SELECT f.storage_namespace INTO v_ns FROM public.families f WHERE f.id = p_family_id;
  IF v_ns IS NULL OR v_ns !~ '^family_[0-9a-f]{8}$' THEN
    RETURN;
  END IF;
  v_free := public.vault_storage_bytes(p_family_id, 'free');
  v_used := public.family_files_bytes(v_ns);
  IF v_free IS NULL OR v_used <= v_free THEN
    RETURN;
  END IF;

  EXECUTE format($q$
    WITH files AS (
      SELECT o.name::text AS name,
             CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,15}$' THEN (o.metadata->>'size')::bigint ELSE 0 END AS size_bytes,
             d.id AS document_id,
             o.created_at
        FROM storage.objects o
        LEFT JOIN %I.documents d ON d.storage_path = o.name
       WHERE o.bucket_id = 'documents'
         AND o.name LIKE $1
         AND (d.id IS NOT NULL OR o.created_at < now() - interval '1 day')
    ), ordered AS (
      SELECT f.*, coalesce(sum(f.size_bytes) OVER (
               ORDER BY (f.document_id IS NULL) DESC, f.created_at DESC, f.name
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before
        FROM files f
    ), picked AS (
      SELECT o.name, o.document_id FROM ordered o
       WHERE $2 - o.before > $3
       ORDER BY (o.document_id IS NULL) DESC, o.created_at DESC, o.name
       LIMIT $4
    )
    SELECT array_agg(p.name), array_agg(p.document_id) FILTER (WHERE p.document_id IS NOT NULL) FROM picked p
  $q$, v_ns)
  INTO v_names, v_docs
  USING replace(v_ns, '_', '\_') || '/%', v_used, v_free, greatest(1, least(coalesce(p_max, 500), 1000));

  IF coalesce(array_length(v_docs, 1), 0) > 0 THEN
    EXECUTE format('DELETE FROM %I.documents WHERE id = ANY($1)', v_ns) USING v_docs;
    GET DIAGNOSTICS v_gone = ROW_COUNT;
  END IF;

  IF coalesce(array_length(v_names, 1), 0) > 0 THEN
    UPDATE public.family_plans SET removed_count = removed_count + v_gone WHERE family_plans.family_id = p_family_id;
    INSERT INTO public.audit_logs (family_id, action, resource_type, resource_id, metadata)
    VALUES (p_family_id, 'plan_remove_documents', 'family', p_family_id,
            jsonb_build_object('documents', v_gone, 'files', array_length(v_names, 1),
                               'document_ids', to_jsonb(coalesce(v_docs, '{}'::uuid[]))));
  END IF;

  RETURN QUERY SELECT unnest(coalesce(v_names, '{}'::text[]));
END;
$fn$;


-- ─── 8. Reminders ──────────────────────────────────────────────────────────
-- 048's expiry reminders, for any vault on a paid plan (it was Plus only):
-- a business on Plus or Business hears about its licences too.
CREATE OR REPLACE FUNCTION public.queue_family_expiry_reminders(p_family_id uuid, p_today date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_ns    text;
  a       record;
  v_days  integer;
  v_stage integer;
  v_when  text;
  v_title text;
  v_body  text;
  v_count integer := 0;
BEGIN
  SELECT storage_namespace INTO v_ns FROM public.families WHERE id = p_family_id;
  IF v_ns IS NULL OR v_ns !~ '^family_[0-9a-f]{8}$'
     OR to_regclass(format('%I.expiry_alerts', v_ns)) IS NULL THEN
    RETURN 0;
  END IF;
  IF public.family_plan_now(p_family_id) = 'free' THEN
    RETURN 0;
  END IF;

  FOR a IN EXECUTE format($q$
    SELECT al.document_id, al.expiry_date, al.alert_days_before, d.file_name, p.display_name AS whose
      FROM %1$I.expiry_alerts al
      JOIN %1$I.documents d ON d.id = al.document_id AND NOT d.is_deleted
      LEFT JOIN public.family_people p ON p.id = d.belongs_to_member AND p.family_id = $2
     WHERE al.expiry_date BETWEEN $1 - 3 AND $1 + 366
  $q$, v_ns) USING v_today, p_family_id
  LOOP
    v_days := a.expiry_date - v_today;
    IF v_days <= 0 THEN
      v_stage := 0;
    ELSE
      SELECT min(t) INTO v_stage
        FROM unnest(coalesce(a.alert_days_before, '{90,30,7}'::integer[])) AS t
       WHERE t >= v_days;
      CONTINUE WHEN v_stage IS NULL;          -- further off than the first reminder
    END IF;

    INSERT INTO public.reminders_sent (family_id, kind, ref_id, due_on, stage)
    VALUES (p_family_id, 'expiry', a.document_id, a.expiry_date, v_stage)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;                  -- already sent

    v_when  := to_char(a.expiry_date, 'FMDD Mon YYYY');
    v_title := left(regexp_replace(a.file_name, '\.(pdf|jpe?g|png)$', '', 'i'), 150) || CASE
                 WHEN v_days < 0 THEN ' has expired'
                 WHEN v_days = 0 THEN ' expires today'
                 WHEN v_days = 1 THEN ' expires tomorrow'
                 ELSE format(' expires in %s days', v_days) END;
    v_body  := format('%s on %s', CASE WHEN v_days < 0 THEN 'Expired' ELSE 'Expires' END, v_when)
               || coalesce(' · ' || a.whose, '') || '. '
               || CASE WHEN v_days <= 0 THEN 'Renew it, then add the new one to AskLocker.'
                       WHEN v_days <= 7 THEN 'Renew it soon.'
                       WHEN v_days <= 30 THEN 'A good time to renew it.'
                       ELSE 'Plenty of time to renew it.' END;

    INSERT INTO public.notifications (user_id, family_id, type, title, message, document_ref)
    SELECT fm.user_id, p_family_id, 'expiry', v_title, v_body, a.document_id
      FROM public.family_members fm
     WHERE fm.family_id = p_family_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

-- 035's birthday reminders, for family vaults only. A business still has a
-- family_people row per member (031's trigger), and nobody's birthday is
-- announced to their colleagues.
CREATE OR REPLACE FUNCTION public.queue_birthday_reminders(p_today date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_year  integer := extract(year FROM coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date));
  v_leap  boolean;
  p       record;
  v_age   integer;
  v_nth   text;
  v_count integer := 0;
BEGIN
  v_leap := v_year % 4 = 0 AND (v_year % 100 <> 0 OR v_year % 400 = 0);

  FOR p IN
    SELECT fp.id, fp.family_id, fp.display_name, fp.gender, fp.birth_date, fp.user_id
      FROM public.family_people fp
      JOIN public.families f ON f.id = fp.family_id AND f.kind = 'family'
     WHERE fp.birth_date IS NOT NULL
       AND fp.birth_date < v_today
       AND (
         to_char(fp.birth_date, 'MM-DD') = to_char(v_today, 'MM-DD')
         OR (NOT v_leap AND to_char(fp.birth_date, 'MM-DD') = '02-29' AND to_char(v_today, 'MM-DD') = '02-28')
       )
  LOOP
    v_age := v_year - extract(year FROM p.birth_date)::integer;
    CONTINUE WHEN v_age < 1 OR v_age > 110;

    INSERT INTO public.reminders_sent (family_id, kind, ref_id, due_on, stage)
    VALUES (p.family_id, 'birthday', p.id, v_today, 0)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;                  -- already sent today

    v_nth := v_age || CASE
               WHEN v_age % 100 BETWEEN 11 AND 13 THEN 'th'
               WHEN v_age % 10 = 1 THEN 'st'
               WHEN v_age % 10 = 2 THEN 'nd'
               WHEN v_age % 10 = 3 THEN 'rd'
               ELSE 'th' END;

    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    SELECT fm.user_id, p.family_id, 'birthday',
           left(format('Today is %s''s %s birthday', p.display_name, v_nth), 200),
           format('Wish %s a happy birthday.',
                  CASE p.gender WHEN 'female' THEN 'her' WHEN 'male' THEN 'him' ELSE 'them' END)
      FROM public.family_members fm
      JOIN public.users u ON u.id = fm.user_id
     WHERE fm.family_id = p.family_id
       AND u.birthday_reminders
       AND fm.user_id IS DISTINCT FROM p.user_id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;


-- ─── 9. Share links, members, invitations ──────────────────────────────────
-- 049's create_document_share: 30 days on any paid plan, and a business's
-- own words.
CREATE OR REPLACE FUNCTION public.create_document_share(
  p_family_id uuid, p_document_id uuid, p_days integer, p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me       uuid := auth.uid();
  v_role     text;
  v_ns       text;
  v_business boolean;
  v_doc      record;
  v_mine     uuid;
  v_owner    uuid;
  v_token    text;
  v_id       uuid;
  v_expires  timestamptz;
  v_note     text := nullif(left(btrim(coalesce(p_note, '')), 80), '');
  v_by       text;
BEGIN
  SELECT role INTO v_role FROM public.family_members WHERE family_id = p_family_id AND user_id = v_me;
  IF v_me IS NULL OR v_role IS NULL THEN
    RAISE EXCEPTION 'Not allowed: you are not a member of this family' USING ERRCODE = '42501';
  END IF;
  IF p_days IS NULL OR p_days NOT IN (1, 7, 30) THEN
    RAISE EXCEPTION 'A link lasts 1, 7 or 30 days.' USING ERRCODE = '22023';
  END IF;
  v_business := public.is_business_vault(p_family_id);
  IF p_days = 30 AND public.family_plan_now(p_family_id) = 'free' THEN
    RAISE EXCEPTION '%', CASE WHEN v_business
                           THEN 'A link that lasts 30 days needs a paid plan. On Free a link lasts 1 or 7 days.'
                           ELSE 'A link that lasts 30 days is part of Family Plus. On Free a link lasts 1 or 7 days.' END
      USING ERRCODE = 'P0001', HINT = 'plus_only';
  END IF;

  SELECT storage_namespace INTO v_ns FROM public.families WHERE id = p_family_id;
  IF v_ns IS NULL OR v_ns !~ '^family_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'That document is not in this family.' USING ERRCODE = '22023';
  END IF;
  EXECUTE format('SELECT id, file_name, uploaded_by, belongs_to_member FROM %I.documents WHERE id = $1 AND NOT is_deleted', v_ns)
     INTO v_doc USING p_document_id;
  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'That document is not in this family.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_mine FROM public.family_people WHERE family_id = p_family_id AND user_id = v_me;
  IF NOT (v_role = 'admin' OR v_doc.uploaded_by = v_me
          OR (v_doc.belongs_to_member IS NOT NULL AND v_mine IS NOT NULL AND v_doc.belongs_to_member = v_mine)) THEN
    RAISE EXCEPTION '%', CASE WHEN v_business
                           THEN 'Only an admin, or whoever added this document, can share it.'
                           ELSE 'Only a family admin, whoever added this document, or the person it belongs to can share it.' END
      USING ERRCODE = '42501';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(days => p_days);
  INSERT INTO public.document_shares (family_id, document_id, token_hash, created_by, note, expires_at)
  VALUES (p_family_id, p_document_id, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_me, v_note, v_expires)
  RETURNING id INTO v_id;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, 'share_document', 'document', p_document_id);

  -- The person it belongs to hears of it, unless they made the link themselves.
  SELECT user_id INTO v_owner FROM public.family_people
   WHERE id = v_doc.belongs_to_member AND family_id = p_family_id;
  IF v_owner IS NOT NULL AND v_owner <> v_me THEN
    SELECT display_name INTO v_by FROM public.users WHERE id = v_me;
    INSERT INTO public.notifications (user_id, family_id, type, title, message, document_ref)
    VALUES (
      v_owner, p_family_id, 'share',
      left(format('%s shared %s by link', coalesce(v_by, 'Someone in your family'),
                  regexp_replace(v_doc.file_name, '\.(pdf|jpe?g|png)$', '', 'i')), 200),
      format('Anyone with the link can open it until %s%s. It can be turned off on the document''s page.',
             to_char(v_expires AT TIME ZONE 'Asia/Kolkata', 'FMDD Mon YYYY'),
             coalesce(' — for ' || v_note, '')),
      p_document_id
    );
  END IF;

  RETURN jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires);
END;
$fn$;

-- 041's member limit, in a business's own words.
CREATE OR REPLACE FUNCTION public.family_members_within_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_family  text;
  v_kind    text;
  v_max     integer;
  v_members integer;
BEGIN
  -- One membership at a time per family, so two people accepting at once
  -- cannot both take the last place.
  SELECT f.name, f.kind INTO v_family, v_kind FROM public.families f WHERE f.id = NEW.family_id FOR UPDATE;
  SELECT pl.max_members INTO v_max FROM public.plan_limits pl WHERE pl.plan = public.family_plan_now(NEW.family_id);
  SELECT count(*) INTO v_members FROM public.family_members m WHERE m.family_id = NEW.family_id;
  IF v_members >= v_max THEN
    RAISE EXCEPTION '% is full: a % can have % members. Ask its admin to make room, then accept again.',
                    v_family, CASE WHEN v_kind = 'business' THEN 'business' ELSE 'family' END, v_max
      USING ERRCODE = 'P0001', HINT = 'family_full';
  END IF;
  RETURN NEW;
END;
$fn$;

-- 041's invitation limit, likewise; a business has no family tree to point to.
CREATE OR REPLACE FUNCTION public.family_invites_within_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_family  text;
  v_kind    text;
  v_max     integer;
  v_members integer;
  v_waiting integer;
BEGIN
  -- Asked already: the invitation is kept as it is (or pointed at a tree
  -- entry, 037), not added, so it takes no new place.
  IF EXISTS (SELECT 1 FROM public.family_invites i
              WHERE i.family_id = NEW.family_id AND i.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT f.name, f.kind INTO v_family, v_kind FROM public.families f WHERE f.id = NEW.family_id FOR UPDATE;
  SELECT pl.max_members INTO v_max FROM public.plan_limits pl WHERE pl.plan = public.family_plan_now(NEW.family_id);
  SELECT count(*) INTO v_members FROM public.family_members m WHERE m.family_id = NEW.family_id;
  SELECT count(*) INTO v_waiting FROM public.family_invites i WHERE i.family_id = NEW.family_id;
  IF v_members + v_waiting >= v_max THEN
    RAISE EXCEPTION '% is full: a % can have % members, and it has %. To invite someone else, %.%',
                    v_family, CASE WHEN v_kind = 'business' THEN 'business' ELSE 'family' END, v_max,
                    CASE WHEN v_waiting = 0 THEN v_members::text
                         ELSE format('%s %s and %s %s waiting',
                                     v_members, CASE v_members WHEN 1 THEN 'member' ELSE 'members' END,
                                     v_waiting, CASE v_waiting WHEN 1 THEN 'invitation' ELSE 'invitations' END) END,
                    CASE WHEN v_waiting = 0 THEN 'remove a member'
                         ELSE 'withdraw an invitation or remove a member' END,
                    CASE WHEN v_kind = 'business' THEN ''
                         ELSE ' Anyone can still be added to the family tree, without an account.' END
      USING ERRCODE = 'P0001', HINT = 'family_full';
  END IF;
  RETURN NEW;
END;
$fn$;

-- 050's invitations a day, the number from the vault's plan (Business 50).
CREATE OR REPLACE FUNCTION public.family_invites_within_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_max  integer;
  v_word text := CASE WHEN public.is_business_vault(NEW.family_id) THEN 'business' ELSE 'family' END;
BEGIN
  SELECT pl.invites_per_day INTO v_max FROM public.plan_limits pl WHERE pl.plan = public.family_plan_now(NEW.family_id);
  v_max := coalesce(v_max, 20);
  IF (SELECT count(*) FROM public.audit_logs a
       WHERE a.family_id = NEW.family_id AND a.action = 'invite_sent'
         AND a.created_at > now() - interval '1 day') >= v_max THEN
    RAISE EXCEPTION 'This % has sent % invitations today. You can invite more tomorrow.', v_word, v_max
      USING ERRCODE = 'P0001', HINT = 'invite_limit';
  END IF;
  IF (SELECT count(*) FROM public.audit_logs a
       WHERE a.family_id = NEW.family_id AND a.action = 'invite_sent' AND a.resource_id = NEW.user_id
         AND a.created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'This person was invited 3 times today. You can ask them again tomorrow.'
      USING ERRCODE = 'P0001', HINT = 'invite_limit';
  END IF;
  RETURN NEW;
END;
$fn$;

-- 037's invite_family_member, with a business's words in the notification.
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

-- 037's decline, in a business's words.
CREATE OR REPLACE FUNCTION public.decline_family_invite(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_inv    public.family_invites%ROWTYPE;
  v_family text;
  v_kind   text;
BEGIN
  SELECT * INTO v_inv FROM public.family_invites WHERE id = p_invite_id FOR UPDATE;
  IF NOT FOUND OR v_me IS NULL OR v_inv.user_id <> v_me THEN
    RAISE EXCEPTION 'Not allowed: that invitation is not yours, or it was withdrawn' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.family_invites WHERE id = v_inv.id;
  UPDATE public.notifications SET is_read = true
   WHERE user_id = v_me AND family_id = v_inv.family_id AND type = 'invite' AND NOT coalesce(is_read, false);

  -- In the words the admin used: the address they typed.
  SELECT name, kind INTO v_family, v_kind FROM public.families WHERE id = v_inv.family_id;
  INSERT INTO public.notifications (user_id, family_id, type, title, message)
  SELECT fm.user_id, v_inv.family_id, 'member',
         left(format('%s said no to joining %s', v_inv.email, v_family), 200),
         CASE WHEN v_kind = 'business'
           THEN 'They will not see the business''s records. You can invite them again if they change their mind.'
           ELSE 'They will not see the family''s documents. You can invite them again if they change their mind.' END
    FROM public.family_members fm
   WHERE fm.family_id = v_inv.family_id AND fm.role = 'admin';

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, v_inv.family_id, 'decline_invite', 'family_invite', v_inv.id);
END;
$fn$;

-- 037's, with the vault's kind, so the card can say "business". Its result
-- changes shape, so it is dropped and made again.
DROP FUNCTION IF EXISTS public.get_my_invitations();
CREATE FUNCTION public.get_my_invitations()
RETURNS TABLE (id uuid, family_id uuid, family_name text, invited_by_name text, person_name text,
               role text, created_at timestamptz, family_kind text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT i.id, i.family_id, f.name::text, u.display_name::text, p.display_name::text, i.role, i.created_at, f.kind
    FROM public.family_invites i
    JOIN public.families f ON f.id = i.family_id
    LEFT JOIN public.users u ON u.id = i.invited_by
    LEFT JOIN public.family_people p ON p.id = i.person_id
   WHERE i.user_id = auth.uid()
   ORDER BY i.created_at;
$fn$;


-- ─── 10. Deleting documents in a business ──────────────────────────────────
-- 047's delete_family_document: in a business an admin deletes any document;
-- everyone else, and everyone in a family vault, only what they added.
CREATE OR REPLACE FUNCTION public.delete_family_document(
  p_family_id uuid, p_document_id uuid, p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_schema TEXT;
  v_kind TEXT;
  v_role TEXT;
  v_found BOOLEAN;
  v_uploaded_by UUID;
BEGIN
  PERFORM public.assert_caller_is(p_user_id);

  SELECT storage_namespace, kind INTO v_schema, v_kind
  FROM public.families
  WHERE id = p_family_id;

  IF v_schema IS NULL THEN
    RAISE EXCEPTION 'Family not found: %', p_family_id;
  END IF;

  SELECT role INTO v_role
  FROM public.family_members
  WHERE family_id = p_family_id
    AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is not a member of this family';
  END IF;

  EXECUTE format(
    'SELECT true, uploaded_by FROM %I.documents WHERE id = $1',
    v_schema
  ) INTO v_found, v_uploaded_by USING p_document_id;

  IF v_found IS NULL THEN
    RAISE EXCEPTION 'Document not found: %', p_document_id;
  END IF;

  -- Whoever added it (047); in a business, any admin too (051).
  IF v_uploaded_by IS DISTINCT FROM p_user_id AND NOT (v_kind = 'business' AND v_role = 'admin') THEN
    RAISE EXCEPTION '%', CASE WHEN v_kind = 'business'
      THEN 'User does not have permission to delete this document: only the person who added it, or an admin, can delete it'
      ELSE 'User does not have permission to delete this document: only the person who added it can delete it' END
      USING ERRCODE = '42501';
  END IF;

  EXECUTE format(
    'DELETE FROM %I.documents WHERE id = $1',
    v_schema
  ) USING p_document_id;

  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (p_user_id, p_family_id, 'delete_document', 'document', p_document_id);
END;
$fn$;

-- 047's document_file_deletable: in a business an admin deletes any file in
-- its folder; otherwise as 047.
CREATE OR REPLACE FUNCTION public.document_file_deletable(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me    uuid := auth.uid();
  v_ns    text := (storage.foldername(p_name))[1];
  v_kind  text;
  v_role  text;
  v_total int;
  v_mine  int;
BEGIN
  IF v_me IS NULL OR v_ns IS NULL OR v_ns !~ '^family_[0-9a-f]{8}$' THEN
    RETURN false;
  END IF;

  SELECT f.kind, m.role INTO v_kind, v_role
    FROM public.families f
    JOIN public.family_members m ON m.family_id = f.id AND m.user_id = v_me
   WHERE f.storage_namespace = v_ns;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_kind = 'business' AND v_role = 'admin' THEN
    RETURN true;
  END IF;

  IF to_regclass(format('%I.documents', v_ns)) IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE format(
    'SELECT count(*)::int, (count(*) FILTER (WHERE uploaded_by = $2))::int
       FROM %I.documents WHERE storage_path = $1',
    v_ns
  ) INTO v_total, v_mine USING p_name, v_me;

  RETURN v_total = v_mine;
END;
$fn$;


-- ─── 11. A business always keeps an admin ──────────────────────────────────
-- Leaving, being removed, or becoming a viewer: refused for a business's last
-- admin, on every path (the app hides Leave too). Family vaults: untouched.
-- When the business itself is deleted, its row is gone first and the
-- memberships follow by cascade; that passes.
CREATE OR REPLACE FUNCTION public.business_keeps_an_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  IF OLD.role IS DISTINCT FROM 'admin' OR (TG_OP = 'UPDATE' AND NEW.role = 'admin') THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  -- Locked, so two admins leaving at once cannot both go.
  SELECT f.name INTO v_name FROM public.families f
   WHERE f.id = OLD.family_id AND f.kind = 'business'
     FOR UPDATE;
  IF FOUND AND NOT EXISTS (
    SELECT 1 FROM public.family_members m
     WHERE m.family_id = OLD.family_id AND m.role = 'admin' AND m.id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'You are the last admin of %. Make someone else an admin first, or delete the business.', v_name
      USING ERRCODE = 'P0001', HINT = 'last_admin';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$fn$;

DROP TRIGGER IF EXISTS business_keeps_an_admin ON public.family_members;
CREATE TRIGGER business_keeps_an_admin
  BEFORE DELETE OR UPDATE OF role ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.business_keeps_an_admin();


-- ─── 12. Deleting your account never deletes a business ────────────────────
-- 029's plan, with two more columns: kind, and blocked — a business whose
-- last admin you are. A business never goes with an account. Its result
-- changes shape, so it is dropped and made again.
DROP FUNCTION IF EXISTS public.account_deletion_plan(uuid);
CREATE FUNCTION public.account_deletion_plan(p_user_id uuid)
RETURNS TABLE (
  family_id         uuid,
  family_name       text,
  storage_namespace text,
  role              text,
  other_members     integer,
  other_admins      integer,
  document_count    integer,
  your_documents    integer,
  delete_family     boolean,
  kind              text,
  blocked           boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT f.id, f.name, f.storage_namespace, f.kind, m.role, m.joined_at,
           (SELECT count(*) FROM public.family_members o
             WHERE o.family_id = f.id AND o.user_id <> p_user_id)::int AS others,
           (SELECT count(*) FROM public.family_members o
             WHERE o.family_id = f.id AND o.user_id <> p_user_id AND o.role = 'admin')::int AS admins
      FROM public.family_members m
      JOIN public.families f ON f.id = m.family_id
     WHERE m.user_id = p_user_id
     ORDER BY m.joined_at
  LOOP
    family_id         := r.id;
    family_name       := r.name;
    storage_namespace := r.storage_namespace;
    role              := r.role;
    other_members     := r.others;
    other_admins      := r.admins;
    kind              := r.kind;
    delete_family     := r.kind <> 'business' AND (r.others = 0 OR (r.role = 'admin' AND r.admins = 0));
    blocked           := r.kind = 'business' AND r.role = 'admin' AND r.admins = 0;
    document_count    := 0;
    your_documents    := 0;
    IF to_regclass(format('%I.documents', r.storage_namespace)) IS NOT NULL THEN
      EXECUTE format(
        'SELECT count(*)::int, (count(*) FILTER (WHERE uploaded_by = $1))::int FROM %I.documents',
        r.storage_namespace)
        INTO document_count, your_documents
        USING p_user_id;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

-- 029's, refusing first while you are a business's last admin, and never
-- deleting a business you created and left.
CREATE OR REPLACE FUNCTION public.delete_account_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r         record;
  v_ns      text;
  v_heir    uuid;
  v_gone    text[] := '{}';
  v_left    integer := 0;
  v_blocked text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT string_agg(p.family_name, ', ' ORDER BY p.family_name) INTO v_blocked
    FROM public.account_deletion_plan(p_user_id) p WHERE p.blocked;
  IF v_blocked IS NOT NULL THEN
    RAISE EXCEPTION 'You are the last admin of %. Make someone else an admin, or delete the business, before you delete your account.', v_blocked
      USING ERRCODE = 'P0001', HINT = 'business_admin';
  END IF;

  FOR r IN SELECT * FROM public.account_deletion_plan(p_user_id) LOOP
    IF r.delete_family THEN
      v_ns := public.purge_family(r.family_id);
      IF v_ns IS NOT NULL THEN
        v_gone := v_gone || v_ns;
      END IF;
    ELSE
      DELETE FROM public.family_members WHERE family_id = r.family_id AND user_id = p_user_id;
      v_left := v_left + 1;
    END IF;
  END LOOP;

  -- Vaults this person created and no longer belongs to, now or from before.
  -- With members left, the longest-standing admin (or member) takes them on;
  -- with nobody left, nobody can reach a family, so it goes too. A business
  -- never goes this way.
  FOR r IN SELECT f.id, f.name, f.kind FROM public.families f WHERE f.created_by = p_user_id LOOP
    SELECT o.user_id INTO v_heir
      FROM public.family_members o
     WHERE o.family_id = r.id AND o.user_id <> p_user_id
     ORDER BY (o.role = 'admin') DESC, o.joined_at
     LIMIT 1;
    IF v_heir IS NOT NULL THEN
      UPDATE public.families SET created_by = v_heir WHERE id = r.id;
    ELSIF r.kind = 'business' THEN
      RAISE EXCEPTION 'Nobody is left in %, which you created. Delete the business first.', r.name
        USING ERRCODE = 'P0001', HINT = 'business_admin';
    ELSE
      v_ns := public.purge_family(r.id);
      IF v_ns IS NOT NULL THEN
        v_gone := v_gone || v_ns;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.document_categories SET created_by = NULL WHERE created_by = p_user_id;
  DELETE FROM public.invitations WHERE invited_by = p_user_id;
  DELETE FROM public.audit_logs WHERE user_id = p_user_id;
  -- Remaining memberships (none by now) and notifications cascade.
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'deleted_namespaces', to_jsonb(v_gone),
    'families_deleted', cardinality(v_gone),
    'families_left', v_left
  );
END;
$fn$;

-- Delete this business: what goes. For an admin of a business only (42501
-- otherwise). The delete-account function shows it before asking for the name.
CREATE OR REPLACE FUNCTION public.business_deletion_plan(p_user_id uuid, p_family_id uuid)
RETURNS TABLE (family_id uuid, family_name text, storage_namespace text,
               other_members text[], document_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
  v_ns   text;
BEGIN
  SELECT f.name, f.storage_namespace INTO v_name, v_ns
    FROM public.families f
    JOIN public.family_members m ON m.family_id = f.id AND m.user_id = p_user_id AND m.role = 'admin'
   WHERE f.id = p_family_id AND f.kind = 'business';
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Not allowed: only an admin of this business can delete it' USING ERRCODE = '42501';
  END IF;

  family_id         := p_family_id;
  family_name       := v_name;
  storage_namespace := v_ns;
  SELECT coalesce(array_agg(coalesce(u.display_name, u.email) ORDER BY m.joined_at), '{}')
    INTO other_members
    FROM public.family_members m
    JOIN public.users u ON u.id = m.user_id
   WHERE m.family_id = p_family_id AND m.user_id <> p_user_id;
  document_count := 0;
  IF to_regclass(format('%I.documents', v_ns)) IS NOT NULL THEN
    EXECUTE format('SELECT count(*)::int FROM %I.documents', v_ns) INTO document_count;
  END IF;
  RETURN NEXT;
END;
$fn$;

-- Delete this business: its rows, schema and index state (029's
-- purge_family), once its name is typed. The delete-account function removes
-- its files first. Returns the folder, for the files added meanwhile.
CREATE OR REPLACE FUNCTION public.purge_business(p_user_id uuid, p_family_id uuid, p_confirm_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
BEGIN
  SELECT f.name INTO v_name
    FROM public.families f
    JOIN public.family_members m ON m.family_id = f.id AND m.user_id = p_user_id AND m.role = 'admin'
   WHERE f.id = p_family_id AND f.kind = 'business'
     FOR UPDATE OF f;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Not allowed: only an admin of this business can delete it' USING ERRCODE = '42501';
  END IF;
  IF lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_name)) THEN
    RAISE EXCEPTION 'Type the business''s name, %, to delete it.', v_name
      USING ERRCODE = '22023', HINT = 'wrong_name';
  END IF;
  RETURN public.purge_family(p_family_id);
END;
$fn$;


-- ─── 13. Words, categories, and what a person said they use AskLocker for ──
-- 048's saved-chat check, in a business's words.
CREATE OR REPLACE FUNCTION public.saved_chats_within_storage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_grows    bigint := octet_length(NEW.messages::text)
                     - CASE WHEN TG_OP = 'UPDATE' THEN octet_length(OLD.messages::text) ELSE 0 END;
  v_ns       text;
  v_personal boolean;
  v_business boolean;
  v_plan     text;
  v_limit    bigint;
  v_used     bigint;
BEGIN
  -- The same size or smaller: a new title, a shorter chat. Always allowed.
  IF v_grows <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT f.storage_namespace, f.is_personal, f.kind = 'business' INTO v_ns, v_personal, v_business
    FROM public.families f WHERE f.id = NEW.family_id;
  v_plan  := public.family_plan_now(NEW.family_id);
  v_limit := public.vault_storage_bytes(NEW.family_id, v_plan);
  -- Before an update this still counts the chat as it was, so used + grows
  -- is what the vault would hold with the chat saved.
  v_used := public.family_files_bytes(v_ns) + public.family_chats_bytes(NEW.family_id);
  IF v_limit IS NOT NULL AND v_used + v_grows > v_limit THEN
    RAISE EXCEPTION 'There is no room to save this chat: % has used % of its %. Delete documents or saved chats you no longer need to make room%.',
                    CASE WHEN v_personal THEN 'your personal vault' WHEN v_business THEN 'your business' ELSE 'your family' END,
                    public.size_text(v_used), public.size_text(v_limit),
                    CASE WHEN v_plan <> 'free' THEN ''
                         WHEN v_business THEN ', or move to a paid plan for more'
                         ELSE ', or move to Family Plus for more' END
      USING ERRCODE = 'P0001', HINT = 'storage_full';
  END IF;
  RETURN NEW;
END;
$fn$;

-- Which list a category belongs to: a family's, a business's, or both.
ALTER TABLE public.document_categories ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'family';
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'document_categories_audience' AND conrelid = 'public.document_categories'::regclass) THEN
    ALTER TABLE public.document_categories ADD CONSTRAINT document_categories_audience
      CHECK (audience IN ('family', 'business', 'both'));
  END IF;
END
$do$;
UPDATE public.document_categories SET audience = 'both'
 WHERE is_system AND name = 'Other' AND audience <> 'both';

-- The business list, added where missing (names have no unique key).
INSERT INTO public.document_categories (name, icon, has_expiry, is_system, created_by, audience)
SELECT v.name, v.icon, v.has_expiry, true, NULL, 'business'
  FROM (VALUES
    ('Sales Invoices',           '🧾', false),
    ('Purchase Bills',           '🛒', false),
    ('GST Returns',              '📈', false),
    ('Contracts & Agreements',   '🤝', true),
    ('Licences & Registrations', '📜', true),
    ('Bank & Loans',             '🏦', false),
    ('Business Insurance',       '🛡️', true),
    ('Employee Records',         '👥', false),
    ('Payroll',                  '💰', false),
    ('Lease & Property',         '🏢', true),
    ('Tax (ITR/TDS)',            '📊', false)
  ) AS v(name, icon, has_expiry)
 WHERE NOT EXISTS (SELECT 1 FROM public.document_categories c WHERE c.is_system AND c.name = v.name);

-- What a person said they will use AskLocker for, when they first signed in.
-- It only steers which Create comes first; it locks nothing. Their own row
-- only (users_update_own); a new writable column gets its own grant (025).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS use_for text;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'users_use_for' AND conrelid = 'public.users'::regclass) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_use_for
      CHECK (use_for IS NULL OR use_for IN ('family', 'business', 'both'));
  END IF;
END
$do$;
GRANT UPDATE (use_for) ON public.users TO authenticated;


-- ─── 14. Who may call what ─────────────────────────────────────────────────
-- Take a user id, are helpers or triggers, or hand out what only the server
-- may: the server's alone.
REVOKE ALL ON FUNCTION public.is_business_vault(uuid)                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_plans(uuid)                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_on_plus(uuid)                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.question_allowance(uuid)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_daily_limit(uuid, text)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_family_plan(uuid, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_plan_notices()                               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_removal_at(uuid)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_cleanup_candidates()                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_take_excess(uuid, integer)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_family_expiry_reminders(uuid, date)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_birthday_reminders(date)                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.invite_family_member(uuid, uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.account_deletion_plan(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_account_data(uuid)                          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_deletion_plan(uuid, uuid)                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_business(uuid, uuid, text)                   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_vault(uuid), public.person_plans(uuid), public.person_on_plus(uuid),
  public.question_allowance(uuid), public.person_daily_limit(uuid, text),
  public.set_family_plan(uuid, timestamptz, text, text, text), public.queue_plan_notices(),
  public.plan_removal_at(uuid), public.plan_cleanup_candidates(), public.plan_take_excess(uuid, integer),
  public.queue_family_expiry_reminders(uuid, date), public.queue_birthday_reminders(date),
  public.invite_family_member(uuid, uuid, text, text, text, text),
  public.account_deletion_plan(uuid), public.delete_account_data(uuid),
  public.business_deletion_plan(uuid, uuid), public.purge_business(uuid, uuid, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.family_members_within_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_invites_within_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_invites_within_day()   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_keeps_an_admin()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.saved_chats_within_storage()  FROM PUBLIC, anon, authenticated;

-- Called by the app: signed-in people, and each checks who is calling first.
REVOKE ALL ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_family(uuid, character varying, text, character varying, boolean, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.family_storage_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.family_storage_has_room(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.family_storage_status(uuid), public.family_storage_has_room(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.create_document_share(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_document_share(uuid, uuid, integer, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.decline_family_invite(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decline_family_invite(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_my_invitations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_invitations() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.delete_family_document(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_family_document(uuid, uuid, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.document_file_deletable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_file_deletable(text) TO authenticated, service_role;

COMMIT;
