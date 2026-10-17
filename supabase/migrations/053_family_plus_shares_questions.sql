-- ============================================================================
-- 053: Family Plus shares 200 questions a month
--
-- 049 gave everyone in a vault on Family Plus no monthly limit, up to a
-- fair-use ceiling of 500 questions a month each. A family of 8 at 500 each
-- is 4,000 questions, about ₹800 of AI a month on Groq's paid tier, against
-- the ₹100 it pays. The owner set one number for the whole family instead,
-- on 17 October 2026: 200 questions a month, shared. A normal family asks
-- about 45.
--
--   1. plan_limits.family_questions_per_month: the questions everyone in a
--      vault on that plan shares in a month (NULL: no family number). 200 on
--      Family Plus, set once, when the column is made, so a number changed
--      in the Table editor since is kept. Family Plus's fair use for one
--      person goes from 500 to the same 200, only where it is still 500, so
--      one person may use the family's whole month and nobody more.
--   2. family_questions_used(): what a family's members have asked this
--      month, added up from 049's counts for each person — nothing new is
--      counted, and a question given back (release_question, when no answer
--      came of it) is given back to the family too. family_question_room():
--      of the vaults a person is in on a plan with a family number, the one
--      with the most left. Both take ids, so both are the server's alone.
--   3. claim_question(): 050's, with the family's month checked after the
--      day's try. The family's row is locked while it counts, so two members
--      asking at once cannot both take the last one. A family whose month is
--      used up refuses with reason 'family' and gives the try back — unless
--      the person is also on a business plan, whose own allowance still
--      counts (051: a person's numbers are the best of their plans).
--   4. question_status(): says family_limit, family_used and family_left as
--      well (the family's count shown no higher than its number: a member
--      also on a business plan may ask past it there), and 'left' is the
--      smaller of the person's and the family's.
--
-- What is counted: 049 counts per person, not per vault, so the family adds
-- up its members' questions wherever they asked them, their personal vault
-- included. Someone who leaves takes their count with them. Business plans
-- have no family number: each person keeps their own 100.
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both.
-- Safe to run more than once. Needs 049, 050 and 051.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'person_plans') THEN
    RAISE EXCEPTION 'Apply 051_business_vaults.sql first.';
  END IF;
END
$do$;


-- ─── 1. A family's number, and one person's ────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'family_questions_per_month') THEN
    ALTER TABLE public.plan_limits ADD COLUMN family_questions_per_month integer
      CONSTRAINT plan_limits_family_questions CHECK (family_questions_per_month IS NULL OR family_questions_per_month >= 0);
    UPDATE public.plan_limits SET family_questions_per_month = 200 WHERE plan = 'plus';
  END IF;
END
$do$;

UPDATE public.plan_limits SET questions_fair_use = 200
 WHERE plan = 'plus' AND questions_fair_use = 500;


-- ─── 2. What a family has asked, and which family has room ─────────────────
-- Added up from each member's own count this month (049), so a question
-- given back to the person is given back to the family.
CREATE OR REPLACE FUNCTION public.family_questions_used(p_family_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(sum(u.questions), 0)::integer
    FROM public.family_members m
    JOIN public.question_usage u ON u.user_id = m.user_id AND u.month = public.question_month()
   WHERE m.family_id = p_family_id;
$fn$;

-- Of the vaults a person is in on a plan with a family number, the one with
-- the most left (a person in two families on Plus asks from either).
CREATE OR REPLACE FUNCTION public.family_question_room(p_user_id uuid)
RETURNS TABLE (family_id uuid, used integer, cap integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT x.family_id, x.used, x.cap
    FROM (SELECT m.family_id,
                 public.family_questions_used(m.family_id) AS used,
                 pl.family_questions_per_month AS cap
            FROM public.family_members m
            JOIN public.plan_limits pl ON pl.plan = public.family_plan_now(m.family_id)
           WHERE m.user_id = p_user_id
             AND pl.family_questions_per_month IS NOT NULL) x
   ORDER BY x.cap - x.used DESC, x.family_id;
$fn$;


-- ─── 3. Counting a question: the family's month too ────────────────────────
-- 050's claim_question, with the family checked after the day's try. Refused
-- for the family, it gives the try back and says reason 'family'.
CREATE OR REPLACE FUNCTION public.claim_question(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_month       date := public.question_month();
  v_plus        boolean;
  v_monthly     integer;
  v_ceiling     integer;
  v_used        integer;
  v_next        date := (public.question_month() + interval '1 month')::date;
  v_try         jsonb;
  v_family      uuid;
  v_family_cap  integer;
  v_family_used integer;
  v_business    integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Questions are counted for a person who is signed in' USING ERRCODE = '42501';
  END IF;
  SELECT a.plus, a.monthly, a.ceiling INTO v_plus, v_monthly, v_ceiling FROM public.question_allowance(p_user_id) a;

  v_try := public.claim_daily(p_user_id, 'question_tries');
  IF NOT (v_try->>'allowed')::boolean THEN
    v_used := coalesce((SELECT u.questions FROM public.question_usage u
                         WHERE u.user_id = p_user_id AND u.month = v_month), 0);
    RETURN jsonb_build_object('allowed', false, 'reason', 'tries',
                              'tries', v_try->'used', 'tries_limit', v_try->'limit',
                              'used', v_used, 'limit', v_monthly, 'ceiling', v_ceiling,
                              'plus', coalesce(v_plus, false), 'resets_on', v_next);
  END IF;

  -- The family's month (053). Its row is locked until this question is
  -- counted, so two members asking at once cannot both take the last one.
  SELECT r.family_id, r.cap INTO v_family, v_family_cap FROM public.family_question_room(p_user_id) r LIMIT 1;
  IF v_family IS NOT NULL THEN
    PERFORM 1 FROM public.families f WHERE f.id = v_family FOR UPDATE;
    v_family_used := public.family_questions_used(v_family);
    IF v_family_used >= v_family_cap THEN
      -- A business plan's own allowance still counts (051).
      SELECT max(coalesce(pl.questions_per_month, pl.questions_fair_use)) INTO v_business
        FROM public.plan_limits pl
       WHERE pl.plan IN (SELECT public.person_plans(p_user_id))
         AND pl.plan <> 'free' AND pl.family_questions_per_month IS NULL;
      IF v_business IS NULL THEN
        UPDATE public.daily_usage SET question_tries = greatest(question_tries - 1, 0), updated_at = now()
         WHERE user_id = p_user_id AND day = public.usage_day();
        v_used := coalesce((SELECT u.questions FROM public.question_usage u
                             WHERE u.user_id = p_user_id AND u.month = v_month), 0);
        RETURN jsonb_build_object('allowed', false, 'reason', 'family', 'used', v_used,
                                  'limit', v_monthly, 'ceiling', v_ceiling,
                                  'plus', coalesce(v_plus, false), 'resets_on', v_next,
                                  'family_limit', v_family_cap, 'family_used', least(v_family_used, v_family_cap),
                                  'family_left', 0);
      END IF;
      v_ceiling := v_business;
      v_family := NULL;
    END IF;
  END IF;

  INSERT INTO public.question_usage (user_id, month) VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, month) DO NOTHING;
  -- Counted only while some are left, in one statement, so two questions at
  -- once cannot both take the last one. No ceiling at all (a plan row
  -- without one) counts and allows.
  UPDATE public.question_usage SET questions = questions + 1, updated_at = now()
   WHERE user_id = p_user_id AND month = v_month AND (v_ceiling IS NULL OR questions < v_ceiling)
  RETURNING questions INTO v_used;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_monthly, 'ceiling', v_ceiling,
                              'plus', coalesce(v_plus, false), 'resets_on', v_next,
                              'tries', v_try->'used', 'tries_limit', v_try->'limit')
        || CASE WHEN v_family IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('family_limit', v_family_cap, 'family_used', v_family_used + 1,
                                        'family_left', greatest(v_family_cap - v_family_used - 1, 0)) END;
  END IF;

  -- The month's are used up: nothing was asked, so the try goes back.
  UPDATE public.daily_usage SET question_tries = greatest(question_tries - 1, 0), updated_at = now()
   WHERE user_id = p_user_id AND day = public.usage_day();
  SELECT u.questions INTO v_used FROM public.question_usage u WHERE u.user_id = p_user_id AND u.month = v_month;
  RETURN jsonb_build_object('allowed', false, 'reason', 'month', 'used', v_used, 'limit', v_monthly, 'ceiling', v_ceiling,
                            'plus', coalesce(v_plus, false), 'resets_on', v_next);
END;
$fn$;


-- ─── 4. How many the person asking has left: the family's too ──────────────
-- 049's question_status, with the family's month beside the person's.
CREATE OR REPLACE FUNCTION public.question_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me          uuid := auth.uid();
  v_plus        boolean;
  v_monthly     integer;
  v_ceiling     integer;
  v_used        integer;
  v_left        integer;
  v_family      uuid;
  v_family_used integer;
  v_family_cap  integer;
  v_business    integer;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Questions are counted for a person who is signed in' USING ERRCODE = '42501';
  END IF;
  SELECT a.plus, a.monthly, a.ceiling INTO v_plus, v_monthly, v_ceiling FROM public.question_allowance(v_me) a;
  v_used := coalesce((SELECT u.questions FROM public.question_usage u
                       WHERE u.user_id = v_me AND u.month = public.question_month()), 0);
  v_left := CASE WHEN v_ceiling IS NULL THEN NULL ELSE greatest(v_ceiling - v_used, 0) END;

  SELECT r.family_id, r.used, r.cap INTO v_family, v_family_used, v_family_cap
    FROM public.family_question_room(v_me) r LIMIT 1;
  IF v_family IS NOT NULL AND v_family_used >= v_family_cap THEN
    -- As claim_question: a business plan's own allowance still counts.
    SELECT max(coalesce(pl.questions_per_month, pl.questions_fair_use)) INTO v_business
      FROM public.plan_limits pl
     WHERE pl.plan IN (SELECT public.person_plans(v_me))
       AND pl.plan <> 'free' AND pl.family_questions_per_month IS NULL;
    IF v_business IS NOT NULL THEN
      v_ceiling := v_business;
      v_left := greatest(v_business - v_used, 0);
      v_family := NULL;
    END IF;
  END IF;
  IF v_family IS NOT NULL THEN
    v_left := least(coalesce(v_left, greatest(v_family_cap - v_family_used, 0)), greatest(v_family_cap - v_family_used, 0));
  END IF;

  RETURN jsonb_build_object(
    'limit', v_monthly,
    'ceiling', v_ceiling,
    'used', v_used,
    'left', v_left,
    'plus', coalesce(v_plus, false),
    'resets_on', (public.question_month() + interval '1 month')::date
  ) || CASE WHEN v_family IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object('family_limit', v_family_cap, 'family_used', least(v_family_used, v_family_cap),
                                    'family_left', greatest(v_family_cap - v_family_used, 0)) END;
END;
$fn$;


-- ─── 5. Who may call them ──────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.family_questions_used(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_question_room(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_question(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_questions_used(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.family_question_room(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_question(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.question_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.question_status() TO authenticated, service_role;
