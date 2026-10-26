-- ============================================================================
-- 066: the plans of 25 October 2026 — shared questions each month, smaller
--      space, lower prices, and Ask by voice free in any language
--
-- The owner's plans, 25 October 2026:
--
--   Families       Free             Family Plus          Family Pro
--   Members        2                4                    8
--   Space          50 MB a vault    500 MB (was 1 GB)    2 GB (was 10 GB)
--                  (family was 100 MB; personal 50 MB)
--   Each person    50 MB in all across free vaults (060, unchanged)
--   Questions      20 each a month  500 a month, shared  2,000 a month,
--                                   by the family        shared
--   Voice          no limit, any language, on every plan (Free had 10, English)
--   Indian languages for reading documents: Family Pro only (was Plus and Pro)
--   Price          —                ₹99 a month,         ₹199 a month,
--                                   ₹999 a year          ₹1,999 a year
--                                   ($10 / $99)          ($20 / $199)
--
--   Businesses     Free             Plus          Pro           Enterprise
--   People         2 (was 4)        5 (was 10)    10 (was 15)   50
--   Space          100 MB (was 200) 5 GB (was 10) 25 GB         100 GB
--   Each person    50 MB in all on Free (060, unchanged)
--   Questions      20 each a month  1,000 a month 5,000 a month no limit
--                                   shared by the business (was 100 each)
--   Indian languages for reading documents: Pro and Enterprise only
--   Price + GST    —                ₹499 / ₹4,999 ₹999 / ₹9,999 ₹3,999 / ₹39,999
--
-- The prices are PLUS_PRICE, PRO_PRICE and BUSINESS_PRICE in
-- supabase/functions/_shared/plan-text.ts, what the payments function
-- charges (families) and what the Plans page shows; they are not rows.
-- Indian languages and voice are the app's rules (preferences.tsx), since the
-- device reads photos and listens and speaks.
--
--   • plan_limits: each number changes only where it still has its old
--     value, so a number changed by hand in the Table editor stays.
--   • A vault's month of questions is 053's family_questions_per_month,
--     on every paid plan but Enterprise now, businesses included: the sum of
--     its members' own counts this month (family_questions_used()), so a
--     question given back to its asker is given back to the vault too. One
--     person may use the vault's whole month (questions_fair_use is the same
--     number). Someone in two vaults with a shared month asks from the one
--     with the most left (family_question_room(), 053).
--   • claim_question() and question_status(): when every shared month a
--     person is in is used up, a paid plan without one still counts — by its
--     own ceiling, or with none (Enterprise). Before, a plan with no ceiling
--     at all was read as no plan, and refused. Both say which kind of vault
--     the shared month is (family_kind), so the words say "your business"
--     for a business, and question_status() lists the person's plans
--     (`plans`), which the app reads for Indian languages.
--   • Voice: plan_limits.voice_answers on Free is NULL, no limit (043).
--     claim_voice_answer() and family_voice_status() are unchanged: with a
--     NULL limit the first says yes and counts nothing, the second says there
--     is no limit, and the app shows no count. Voice costs AskLocker nothing:
--     the browser's (or phone's) own speech service listens and the device's
--     own voices read the answer.
--   • Lowering a number deletes nothing and removes nobody (041, 048): a
--     vault over its new space keeps everything and adds nothing until under
--     it; a family or business above its new number of people keeps everyone
--     and invites again once below. Only a vault whose Family Plus or Pro
--     ends is ever cleaned up (040), now down to 50 MB.
--   • apply_plan_payment() keeps converting time left between Plus and Pro
--     at twice the price (064): ₹199 is 2.01 times ₹99, and $20 twice $10.
--
-- Data and two function bodies: the 024 fingerprint sees the functions, not
-- the numbers. Check the rows by hand on both projects:
--   select plan, storage_bytes, business_storage_bytes, max_members,
--          business_max_members, voice_answers, questions_fair_use,
--          family_questions_per_month from plan_limits order by plan;
-- ============================================================================

-- ─── 1. The numbers ──────────────────────────────────────────────────────────

-- Free: 50 MB a family vault (a personal vault already 50 MB), 100 MB a
-- business, 2 people in a business, and voice with no limit.
UPDATE public.plan_limits SET storage_bytes = 52428800
 WHERE plan = 'free' AND storage_bytes = 104857600;
UPDATE public.plan_limits SET business_storage_bytes = 104857600
 WHERE plan = 'free' AND business_storage_bytes = 209715200;
UPDATE public.plan_limits SET business_max_members = 2
 WHERE plan = 'free' AND business_max_members = 4;
UPDATE public.plan_limits SET voice_answers = NULL
 WHERE plan = 'free' AND voice_answers = 10;

-- Family Plus: 500 MB, and 500 questions a month for the family.
UPDATE public.plan_limits SET storage_bytes = 524288000
 WHERE plan = 'plus' AND storage_bytes = 1073741824;
UPDATE public.plan_limits SET questions_fair_use = 500
 WHERE plan = 'plus' AND questions_fair_use IS NULL;
UPDATE public.plan_limits SET family_questions_per_month = 500
 WHERE plan = 'plus' AND family_questions_per_month IS NULL;

-- Family Pro: 2 GB, and 2,000 questions a month for the family.
UPDATE public.plan_limits SET storage_bytes = 2147483648
 WHERE plan = 'family_pro' AND storage_bytes = 10737418240;
UPDATE public.plan_limits SET questions_fair_use = 2000
 WHERE plan = 'family_pro' AND questions_fair_use IS NULL;
UPDATE public.plan_limits SET family_questions_per_month = 2000
 WHERE plan = 'family_pro' AND family_questions_per_month IS NULL;

-- Business Plus: 5 people, 5 GB, 1,000 questions a month for the business.
UPDATE public.plan_limits SET max_members = 5
 WHERE plan = 'business_plus' AND max_members = 10;
UPDATE public.plan_limits SET storage_bytes = 5368709120
 WHERE plan = 'business_plus' AND storage_bytes = 10737418240;
UPDATE public.plan_limits SET questions_fair_use = 1000
 WHERE plan = 'business_plus' AND questions_fair_use = 100;
UPDATE public.plan_limits SET family_questions_per_month = 1000
 WHERE plan = 'business_plus' AND family_questions_per_month IS NULL;

-- Business Pro: 10 people, 25 GB, 5,000 questions a month for the business.
UPDATE public.plan_limits SET max_members = 10
 WHERE plan = 'business_pro' AND max_members = 15;
UPDATE public.plan_limits SET questions_fair_use = 5000
 WHERE plan = 'business_pro' AND questions_fair_use = 100;
UPDATE public.plan_limits SET family_questions_per_month = 5000
 WHERE plan = 'business_pro' AND family_questions_per_month IS NULL;

-- Enterprise: no monthly limit on questions (050's 30 tries a day each stay).
UPDATE public.plan_limits SET questions_fair_use = NULL
 WHERE plan = 'business_enterprise' AND questions_fair_use = 100;


-- ─── 2. One question, for the person asking ──────────────────────────────────
-- As 053's, with two changes: a paid plan without a shared month (Enterprise)
-- still counts once every shared month the person is in is used up, by its
-- own ceiling or with none; and the answer says which kind of vault the
-- shared month is.
CREATE OR REPLACE FUNCTION public.claim_question(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month        date := public.question_month();
  v_plus         boolean;
  v_monthly      integer;
  v_ceiling      integer;
  v_used         integer;
  v_next         date := (public.question_month() + interval '1 month')::date;
  v_try          jsonb;
  v_family       uuid;
  v_family_cap   integer;
  v_family_used  integer;
  v_family_kind  text;
  v_unpooled     boolean;
  v_unpooled_cap integer;
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

  -- The vault's shared month (053, 066). Its row is locked until this
  -- question is counted, so two members asking at once cannot both take the
  -- last one.
  SELECT r.family_id, r.cap INTO v_family, v_family_cap FROM public.family_question_room(p_user_id) r LIMIT 1;
  IF v_family IS NOT NULL THEN
    PERFORM 1 FROM public.families f WHERE f.id = v_family FOR UPDATE;
    SELECT f.kind INTO v_family_kind FROM public.families f WHERE f.id = v_family;
    v_family_used := public.family_questions_used(v_family);
    IF v_family_used >= v_family_cap THEN
      -- A paid plan without a shared month still counts: by its own
      -- ceiling, or with none at all (Enterprise, 066).
      SELECT true,
             CASE WHEN bool_or(coalesce(pl.questions_per_month, pl.questions_fair_use) IS NULL) THEN NULL
                  ELSE max(coalesce(pl.questions_per_month, pl.questions_fair_use)) END
        INTO v_unpooled, v_unpooled_cap
        FROM public.plan_limits pl
       WHERE pl.plan IN (SELECT public.person_plans(p_user_id))
         AND pl.plan <> 'free' AND pl.family_questions_per_month IS NULL
      HAVING count(*) > 0;
      IF NOT coalesce(v_unpooled, false) THEN
        UPDATE public.daily_usage SET question_tries = greatest(question_tries - 1, 0), updated_at = now()
         WHERE user_id = p_user_id AND day = public.usage_day();
        v_used := coalesce((SELECT u.questions FROM public.question_usage u
                             WHERE u.user_id = p_user_id AND u.month = v_month), 0);
        RETURN jsonb_build_object('allowed', false, 'reason', 'family', 'used', v_used,
                                  'limit', v_monthly, 'ceiling', v_ceiling,
                                  'plus', coalesce(v_plus, false), 'resets_on', v_next,
                                  'family_limit', v_family_cap, 'family_used', least(v_family_used, v_family_cap),
                                  'family_left', 0, 'family_kind', coalesce(v_family_kind, 'family'));
      END IF;
      v_ceiling := v_unpooled_cap;
      v_family := NULL;
    END IF;
  END IF;

  INSERT INTO public.question_usage (user_id, month) VALUES (p_user_id, v_month)
  ON CONFLICT (user_id, month) DO NOTHING;
  -- Counted only while some are left, in one statement, so two questions at
  -- once cannot both take the last one. No ceiling at all counts and allows.
  UPDATE public.question_usage SET questions = questions + 1, updated_at = now()
   WHERE user_id = p_user_id AND month = v_month AND (v_ceiling IS NULL OR questions < v_ceiling)
  RETURNING questions INTO v_used;
  IF FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'used', v_used, 'limit', v_monthly, 'ceiling', v_ceiling,
                              'plus', coalesce(v_plus, false), 'resets_on', v_next,
                              'tries', v_try->'used', 'tries_limit', v_try->'limit')
        || CASE WHEN v_family IS NULL THEN '{}'::jsonb
                ELSE jsonb_build_object('family_limit', v_family_cap, 'family_used', v_family_used + 1,
                                        'family_left', greatest(v_family_cap - v_family_used - 1, 0),
                                        'family_kind', coalesce(v_family_kind, 'family')) END;
  END IF;

  -- The month's are used up: nothing was asked, so the try goes back.
  UPDATE public.daily_usage SET question_tries = greatest(question_tries - 1, 0), updated_at = now()
   WHERE user_id = p_user_id AND day = public.usage_day();
  SELECT u.questions INTO v_used FROM public.question_usage u WHERE u.user_id = p_user_id AND u.month = v_month;
  RETURN jsonb_build_object('allowed', false, 'reason', 'month', 'used', v_used, 'limit', v_monthly, 'ceiling', v_ceiling,
                            'plus', coalesce(v_plus, false), 'resets_on', v_next);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_question(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_question(uuid) TO service_role;


-- ─── 3. The count without asking, for the person signed in ───────────────────
-- As claim_question() reads it, counting nothing; and the person's plans.
CREATE OR REPLACE FUNCTION public.question_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me           uuid := auth.uid();
  v_plus         boolean;
  v_monthly      integer;
  v_ceiling      integer;
  v_used         integer;
  v_left         integer;
  v_family       uuid;
  v_family_used  integer;
  v_family_cap   integer;
  v_family_kind  text;
  v_unpooled     boolean;
  v_unpooled_cap integer;
  v_plans        jsonb;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Questions are counted for a person who is signed in' USING ERRCODE = '42501';
  END IF;
  SELECT a.plus, a.monthly, a.ceiling INTO v_plus, v_monthly, v_ceiling FROM public.question_allowance(v_me) a;
  v_used := coalesce((SELECT u.questions FROM public.question_usage u
                       WHERE u.user_id = v_me AND u.month = public.question_month()), 0);
  v_left := CASE WHEN v_ceiling IS NULL THEN NULL ELSE greatest(v_ceiling - v_used, 0) END;
  SELECT coalesce(jsonb_agg(p ORDER BY p), '[]'::jsonb) INTO v_plans FROM public.person_plans(v_me) AS p;

  SELECT r.family_id, r.used, r.cap INTO v_family, v_family_used, v_family_cap
    FROM public.family_question_room(v_me) r LIMIT 1;
  IF v_family IS NOT NULL THEN
    SELECT f.kind INTO v_family_kind FROM public.families f WHERE f.id = v_family;
  END IF;
  IF v_family IS NOT NULL AND v_family_used >= v_family_cap THEN
    -- As claim_question: a paid plan without a shared month still counts.
    SELECT true,
           CASE WHEN bool_or(coalesce(pl.questions_per_month, pl.questions_fair_use) IS NULL) THEN NULL
                ELSE max(coalesce(pl.questions_per_month, pl.questions_fair_use)) END
      INTO v_unpooled, v_unpooled_cap
      FROM public.plan_limits pl
     WHERE pl.plan IN (SELECT public.person_plans(v_me))
       AND pl.plan <> 'free' AND pl.family_questions_per_month IS NULL
    HAVING count(*) > 0;
    IF coalesce(v_unpooled, false) THEN
      v_ceiling := v_unpooled_cap;
      v_left := CASE WHEN v_unpooled_cap IS NULL THEN NULL ELSE greatest(v_unpooled_cap - v_used, 0) END;
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
    'resets_on', (public.question_month() + interval '1 month')::date,
    'plans', v_plans
  ) || CASE WHEN v_family IS NULL THEN '{}'::jsonb
            ELSE jsonb_build_object('family_limit', v_family_cap, 'family_used', least(v_family_used, v_family_cap),
                                    'family_left', greatest(v_family_cap - v_family_used, 0),
                                    'family_kind', coalesce(v_family_kind, 'family')) END;
END;
$function$;

REVOKE ALL ON FUNCTION public.question_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.question_status() TO authenticated, service_role;
