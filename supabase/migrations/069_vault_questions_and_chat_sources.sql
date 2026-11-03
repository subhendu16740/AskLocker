-- ============================================================================
-- 069: a paid vault counts its own questions; a saved chat goes with every
--      vault its answers came from
--
-- Two gaps, both about what stays counted or kept after someone leaves:
--
--   • A paid vault's shared month (053, 066, 067: Family Plus 250, Family
--     Pro 500, the business plans 1,000 to 8,000) was worked out at each
--     question by adding up the CURRENT members' own counts. Leaving, or
--     being removed, took that person's questions out of the vault's total,
--     so cycling accounts through a vault reopened questions already spent;
--     and someone joining mid-month brought in questions they had asked
--     elsewhere. Now the vault keeps its own count, vault_question_usage,
--     one row a month, written only by claim_question() and
--     release_question() (service role only). family_questions_used() reads
--     it, so question_status() and family_question_room() follow unchanged.
--     This month's count starts from what the old sum says now, for every
--     vault on a plan with a shared month.
--   • A chat saved from Ask across vaults (046) is kept under the vault that
--     was open, often the personal vault, and 028 tied it only to that
--     membership. Answers, document names and the vault's name from another
--     vault stayed readable after leaving or being removed from it. Now a
--     trigger refuses saving a chat whose sources name a vault the owner is
--     not in (HINT source_vault), and leaving or being removed from a vault
--     deletes that person's chats whose sources name it, wherever they are
--     kept. Chats already saved that name a vault their owner has left are
--     deleted here, as they would have been: the query under step 2 counts
--     them first, if you want to know how many.
--
-- Run it in the SQL editor of DEV, then PROD. Then run qa/sql/sweep.sql
-- (zero rows) and compare qa/sql/fingerprint.sql on both projects.
--
-- To see first how many saved chats step 2 deletes (read only):
--   select count(*) from public.saved_chats c
--    where exists (select 1 from jsonb_path_query(c.messages, '$[*].sources[*].family_id') j
--                   where jsonb_typeof(j) = 'string'
--                     and not exists (select 1 from public.family_members m
--                                      where m.user_id = c.user_id and m.family_id::text = j #>> '{}'));
-- ============================================================================


-- ─── 1. Each paid vault's own count of questions this month ────────────────
CREATE TABLE IF NOT EXISTS public.vault_question_usage (
  family_id  uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  month      date NOT NULL,
  questions  integer NOT NULL DEFAULT 0 CHECK (questions >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, month)
);
-- The server's own count, like question_usage (049): no client reads or writes it.
ALTER TABLE public.vault_question_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vault_question_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.vault_question_usage TO service_role;

-- Which vault the person's latest question this month was charged to, so a
-- question given back is given back to that vault too.
ALTER TABLE public.question_usage ADD COLUMN IF NOT EXISTS charged_family uuid;

-- This month so far: what the old sum says now, for each vault on a plan
-- with a shared month. Runs before family_questions_used() is replaced
-- below; run again, it finds every row there and changes nothing.
INSERT INTO public.vault_question_usage (family_id, month, questions)
SELECT f.id, public.question_month(), public.family_questions_used(f.id)
  FROM public.families f
  JOIN public.plan_limits pl ON pl.plan = public.family_plan_now(f.id)
 WHERE pl.family_questions_per_month IS NOT NULL
ON CONFLICT (family_id, month) DO NOTHING;

CREATE OR REPLACE FUNCTION public.family_questions_used(p_family_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce((SELECT v.questions FROM public.vault_question_usage v
                    WHERE v.family_id = p_family_id AND v.month = public.question_month()), 0);
$fn$;

-- 066's claim_question, with the chosen vault's own count raised in the same
-- transaction, under the same row lock, as the person's.
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
  UPDATE public.question_usage SET questions = questions + 1, charged_family = v_family, updated_at = now()
   WHERE user_id = p_user_id AND month = v_month AND (v_ceiling IS NULL OR questions < v_ceiling)
  RETURNING questions INTO v_used;
  IF FOUND THEN
    -- The vault's own count, still under its row lock (069).
    IF v_family IS NOT NULL THEN
      INSERT INTO public.vault_question_usage (family_id, month, questions) VALUES (v_family, v_month, 1)
      ON CONFLICT (family_id, month)
      DO UPDATE SET questions = public.vault_question_usage.questions + 1, updated_at = now();
    END IF;
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

-- The AI service failed (067): the question goes back to the person, and to
-- the vault it was charged to.
CREATE OR REPLACE FUNCTION public.release_question(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_family uuid;
BEGIN
  UPDATE public.question_usage SET questions = questions - 1, updated_at = now()
   WHERE user_id = p_user_id AND month = public.question_month() AND questions > 0
  RETURNING charged_family INTO v_family;
  IF v_family IS NOT NULL THEN
    UPDATE public.vault_question_usage SET questions = questions - 1, updated_at = now()
     WHERE family_id = v_family AND month = public.question_month() AND questions > 0;
  END IF;
END;
$fn$;


-- ─── 2. A saved chat goes with every vault its answers came from ───────────
-- The vaults a saved chat draws on: the one it is kept in, and each
-- source's vault (046: sources carry family_id). Anything in the JSON that
-- is not a vault id is ignored.
CREATE OR REPLACE FUNCTION public.saved_chat_vaults(p_family_id uuid, p_messages jsonb)
RETURNS uuid[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT coalesce(array_agg(DISTINCT s.v::uuid), '{}')
    FROM (SELECT p_family_id::text AS v
          UNION ALL
          SELECT j #>> '{}'
            FROM jsonb_path_query(coalesce(p_messages, '[]'::jsonb), 'lax $[*].sources[*].family_id') j
           WHERE jsonb_typeof(j) = 'string') s
   WHERE s.v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$fn$;

-- Saving refuses answers from a vault the owner is not in, on every path.
CREATE OR REPLACE FUNCTION public.saved_chat_sources_are_yours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(public.saved_chat_vaults(NEW.family_id, NEW.messages)) v
              WHERE NOT EXISTS (SELECT 1 FROM public.family_members m
                                 WHERE m.family_id = v AND m.user_id = NEW.user_id)) THEN
    RAISE EXCEPTION 'This chat has answers from a vault you are no longer in, so it cannot be saved. Start a new question.'
      USING ERRCODE = 'P0001', HINT = 'source_vault';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS saved_chats_sources_are_yours ON public.saved_chats;
CREATE TRIGGER saved_chats_sources_are_yours
  BEFORE INSERT OR UPDATE OF messages ON public.saved_chats
  FOR EACH ROW EXECUTE FUNCTION public.saved_chat_sources_are_yours();

-- Leaving, being removed, or the vault being deleted: that person's chats
-- whose answers came from it go, wherever they are kept (028's foreign key
-- already takes the chats kept in it).
CREATE OR REPLACE FUNCTION public.saved_chats_follow_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  DELETE FROM public.saved_chats c
   WHERE c.user_id = OLD.user_id
     AND OLD.family_id = ANY (public.saved_chat_vaults(c.family_id, c.messages));
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS saved_chats_follow_members ON public.family_members;
CREATE TRIGGER saved_chats_follow_members
  AFTER DELETE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.saved_chats_follow_members();

-- Chats already saved with answers from a vault their owner has left.
DELETE FROM public.saved_chats c
 WHERE EXISTS (SELECT 1 FROM unnest(public.saved_chat_vaults(c.family_id, c.messages)) v
                WHERE NOT EXISTS (SELECT 1 FROM public.family_members m
                                   WHERE m.family_id = v AND m.user_id = c.user_id));


-- ─── Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.family_questions_used(uuid)            FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_questions_used(uuid)         TO service_role;
REVOKE ALL ON FUNCTION public.claim_question(uuid)                   FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_question(uuid)                TO service_role;
REVOKE ALL ON FUNCTION public.release_question(uuid)                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_question(uuid)              TO service_role;
REVOKE ALL ON FUNCTION public.saved_chat_vaults(uuid, jsonb)         FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.saved_chat_vaults(uuid, jsonb)      TO service_role;
REVOKE ALL ON FUNCTION public.saved_chat_sources_are_yours()         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.saved_chats_follow_members()           FROM PUBLIC, anon, authenticated;
