-- ============================================================================
-- 052: Business Enterprise, and the business plans' numbers as sold
--
-- 051 went to DEV on 14 October 2026 with two business plans, Plus at 10
-- people and Pro at 50. The plans as priced since are three, told apart by
-- people and space:
--
--   Plus        ('business_plus')         5 people,  25 GB
--   Pro         ('business_pro')         15 people, 100 GB
--   Enterprise  ('business_enterprise')  50 people, 200 GB
--
-- On each, 100 questions a person a month (fair use, no monthly limit
-- shown), no voice limit, 300 uploads and 30 question tries a day each, and
-- 20 invitations a day (50 on Enterprise). The prices are BUSINESS_PRICE in
-- supabase/functions/_shared/plan-text.ts; CLAUDE.md has the working.
--
--   1. The CHECKs on plan names take 'business_enterprise'.
--   2. Plus and Pro move to these numbers, each only where it is still
--      051's (a number changed in the Table editor since is kept), and
--      Enterprise's row is added. Lowering Pro's people from 50 to 15
--      removes nobody (041): a business above it keeps everyone and invites
--      again once it is below.
--   3. set_family_plan() gives Enterprise, by name, to a business only, and
--      names it in its notice; queue_plan_notices() names it when it ends.
--      Both otherwise as in 051.
--
-- Safe to run more than once. Where 051 is not applied it stops before
-- changing anything.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'invites_per_day') THEN
    RAISE EXCEPTION 'Apply 051_business_vaults.sql first.';
  END IF;
END
$do$;


-- ─── 1. Enterprise is a plan name ──────────────────────────────────────────
ALTER TABLE public.plan_limits  DROP CONSTRAINT IF EXISTS plan_limits_plan_known;
ALTER TABLE public.plan_limits  ADD  CONSTRAINT plan_limits_plan_known
  CHECK (plan IN ('free', 'plus', 'business_plus', 'business_pro', 'business_enterprise'));
ALTER TABLE public.family_plans DROP CONSTRAINT IF EXISTS family_plans_plan_paid;
ALTER TABLE public.family_plans ADD  CONSTRAINT family_plans_plan_paid
  CHECK (plan IN ('plus', 'business_plus', 'business_pro', 'business_enterprise'));


-- ─── 2. The three plans' numbers ───────────────────────────────────────────
UPDATE public.plan_limits SET
  max_members            = CASE WHEN max_members = 10            THEN 5   ELSE max_members END,
  questions_fair_use     = CASE WHEN questions_fair_use = 80      THEN 100 ELSE questions_fair_use END,
  uploads_per_day        = CASE WHEN uploads_per_day = 200        THEN 300 ELSE uploads_per_day END,
  question_tries_per_day = CASE WHEN question_tries_per_day = 20  THEN 30  ELSE question_tries_per_day END
WHERE plan = 'business_plus';

UPDATE public.plan_limits SET
  max_members            = CASE WHEN max_members = 50            THEN 15  ELSE max_members END,
  questions_fair_use     = CASE WHEN questions_fair_use = 300     THEN 100 ELSE questions_fair_use END,
  uploads_per_day        = CASE WHEN uploads_per_day = 500        THEN 300 ELSE uploads_per_day END,
  question_tries_per_day = CASE WHEN question_tries_per_day = 100 THEN 30  ELSE question_tries_per_day END,
  invites_per_day        = CASE WHEN invites_per_day = 50         THEN 20  ELSE invites_per_day END
WHERE plan = 'business_pro';

INSERT INTO public.plan_limits (plan, storage_bytes, max_members, voice_answers, questions_per_month,
                                questions_fair_use, uploads_per_day, question_tries_per_day, invites_per_day)
VALUES ('business_enterprise', 200::bigint * 1024 * 1024 * 1024, 50, NULL, NULL, 100, 300, 30, 50)
ON CONFLICT (plan) DO NOTHING;


-- ─── 3. Giving Enterprise, and saying when it ends ─────────────────────────
-- 051's set_family_plan, which takes 'business_enterprise' too:
--   'plus'                           family vaults only (their default)
--   'business_plus', 'business_pro', 'business_enterprise'
--                                    business vaults only, always by name:
--                                    a business has no default, so a
--                                    payment for Family Plus can never
--                                    turn into a business plan
--   p_source 'trial'  a plan switched on for a demo
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


-- 051's queue_plan_notices, naming Enterprise when it ends.
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


-- ─── 4. Who may call what ──────────────────────────────────────────────────
-- As in 051: the server's alone.
REVOKE ALL ON FUNCTION public.set_family_plan(uuid, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_plan_notices()                               FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_family_plan(uuid, timestamptz, text, text, text), public.queue_plan_notices()
  TO service_role;
