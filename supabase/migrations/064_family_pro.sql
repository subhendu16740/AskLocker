-- ============================================================================
-- 064: Family Pro — a second family plan; members, space and what is paid
--
-- The owner's plans for families, 23 October 2026:
--
--                  Free       Family Plus            Family Pro
--   Members        2 (was 4)  4 (was 8)              8
--   Space          100 MB     1 GB (was 10 GB)       10 GB
--   Questions      20 each    no monthly limit       no monthly limit
--                  a month    (was 200 a family)
--   Price, India   —          ₹100 a month,          ₹200 a month,
--                             ₹1,100 a year          ₹2,000 a year
--   Elsewhere      —          $10 / $110             $20 / $200
--
-- Pro is Plus with more members and space; every other number is Plus's. The
-- prices are PLUS_PRICE and PRO_PRICE in supabase/functions/_shared/plan-text.ts,
-- what the payments function charges; they are not rows.
--
--   • plan_limits: a family_pro row, copied from plus with 8 members and
--     10 GB. Plus 1 GB and 4 members, Free 2 members, and Plus without a
--     monthly ceiling (questions_fair_use) or a family number (053's
--     family_questions_per_month): question_allowance() takes the best of a
--     person's plans and a NULL ceiling is no limit, so everyone in a vault
--     on Plus or Pro asks without a monthly limit. 050's tries a day still
--     hold (50 each on Plus and Pro), the bound on what one person can ask.
--     Each number changes only where it still has its old value, so a number
--     changed by hand in the Table editor stays. A business on Free keeps 4
--     people: plan_limits.business_max_members (NULL: max_members), read by
--     the member triggers through vault_max_members(), and by the preview of
--     a family becoming a business.
--   • Lowering a number deletes nothing and removes nobody (041, 048): a
--     family above 2 members on Free, or 4 on Plus, keeps everyone and
--     invites again once below; a vault on Plus over 1 GB adds nothing until
--     under it.
--   • set_family_plan() gives a family plus or family_pro; plan_payments
--     records which plan an order is for (plus for every order before 064,
--     and for any order an older payments function makes), and
--     apply_plan_payment() gives that plan. Moving between Plus and Pro keeps
--     the time left at what it is worth on the new plan: Pro costs twice
--     Plus, so half a month of Plus left is a week of Pro.
--   • Birthday reminders are part of Family Plus and Pro:
--     queue_birthday_reminders() makes them only for a family vault on a paid
--     plan. A free family gets none, and nothing is recorded, so moving to a
--     paid plan brings that day's birthdays at the next run.
--   • The notices when a paid plan ends name it, Family Plus or Family Pro
--     (family_plan_name()), and so do the clean-up and the reason a family
--     cannot become a business yet.
--
-- Reading documents and speaking in Indian languages are part of Plus and
-- Pro too, but both happen on the device (Tesseract or ML Kit, the device's
-- own voices), so that is the app's rule to keep; nothing here.
--
-- Apply: paste into the SQL editor — DEV, then PROD — after 060, before the
-- release that carries Family Pro, and before the payments function that
-- sells it. Safe to run more than once. Without it the app shows Pro from
-- DEFAULT_PLAN_LIMITS and the payments function refuses a Pro order
-- (needs_migration).
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits' AND column_name = 'person_storage_bytes') THEN
    RAISE EXCEPTION 'Apply 060_free_space_per_person.sql first.';
  END IF;
  IF to_regclass('public.plan_payments') IS NULL THEN
    RAISE EXCEPTION 'Apply 044_razorpay_payments.sql first.';
  END IF;
END
$do$;


-- ─── 1. family_pro is a plan name ──────────────────────────────────────────
ALTER TABLE public.plan_limits  DROP CONSTRAINT IF EXISTS plan_limits_plan_known;
ALTER TABLE public.plan_limits  ADD  CONSTRAINT plan_limits_plan_known
  CHECK (plan IN ('free', 'plus', 'family_pro', 'business_plus', 'business_pro', 'business_enterprise'));
ALTER TABLE public.family_plans DROP CONSTRAINT IF EXISTS family_plans_plan_paid;
ALTER TABLE public.family_plans ADD  CONSTRAINT family_plans_plan_paid
  CHECK (plan IN ('plus', 'family_pro', 'business_plus', 'business_pro', 'business_enterprise'));


-- ─── 2. The numbers ────────────────────────────────────────────────────────
-- A plan with no monthly ceiling at all: 049 made the fair use a number on
-- every row; NULL is now no ceiling, which question_allowance(),
-- claim_question() and question_status() already read as no limit.
ALTER TABLE public.plan_limits ALTER COLUMN questions_fair_use DROP NOT NULL;
COMMENT ON COLUMN public.plan_limits.questions_fair_use IS
  'The most one person may ask in a month on a plan with no monthly limit (049). NULL: no ceiling (Family Plus and Pro since 064); the day''s tries (050) still hold.';

-- Pro: Plus's row, with 8 members and 10 GB, and no monthly ceiling.
INSERT INTO public.plan_limits
SELECT (jsonb_populate_record(NULL::public.plan_limits,
          to_jsonb(p) || jsonb_build_object('plan', 'family_pro', 'max_members', 8,
                                            'storage_bytes', 10737418240::bigint,
                                            'questions_fair_use', NULL,
                                            'family_questions_per_month', NULL))).*
  FROM public.plan_limits p
 WHERE p.plan = 'plus'
ON CONFLICT (plan) DO NOTHING;

UPDATE public.plan_limits SET storage_bytes = 1073741824 WHERE plan = 'plus' AND storage_bytes = 10737418240;
UPDATE public.plan_limits SET max_members = 4            WHERE plan = 'plus' AND max_members = 8;
UPDATE public.plan_limits SET questions_fair_use = NULL  WHERE plan = 'plus' AND questions_fair_use IN (150, 200, 500);
UPDATE public.plan_limits SET family_questions_per_month = NULL WHERE plan = 'plus' AND family_questions_per_month = 200;
-- A business on Free keeps 4 people (051): its own number, read before
-- Free's goes down to 2 for a family. NULL is the plan's max_members.
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS business_max_members integer CHECK (business_max_members > 0);
COMMENT ON COLUMN public.plan_limits.business_max_members IS
  'People a business vault may have on this plan, where it differs from a family (064). NULL: max_members.';
UPDATE public.plan_limits SET business_max_members = 4   WHERE plan = 'free' AND business_max_members IS NULL AND max_members = 4;
UPDATE public.plan_limits SET max_members = 2            WHERE plan = 'free' AND max_members = 4;


-- ─── 3. Which plan an order is for ─────────────────────────────────────────
ALTER TABLE public.plan_payments ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'plus';
ALTER TABLE public.plan_payments DROP CONSTRAINT IF EXISTS plan_payments_plan_known;
ALTER TABLE public.plan_payments ADD  CONSTRAINT plan_payments_plan_known CHECK (plan IN ('plus', 'family_pro'));


-- ─── 4. A family plan's name, for the words ────────────────────────────────
CREATE OR REPLACE FUNCTION public.family_plan_name(p_plan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE p_plan WHEN 'family_pro' THEN 'Family Pro' ELSE 'Family Plus' END;
$fn$;


-- A vault's number of members on its plan now: a business's own where the
-- plan has one (Free: 4), else the plan's. The two triggers 041 made, and
-- 051 restated, read it, so every way in obeys it.
CREATE OR REPLACE FUNCTION public.vault_max_members(p_family_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN f.kind = 'business' THEN coalesce(pl.business_max_members, pl.max_members) ELSE pl.max_members END
    FROM public.families f
    JOIN public.plan_limits pl ON pl.plan = public.family_plan_now(f.id)
   WHERE f.id = p_family_id;
$fn$;

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
  v_max := public.vault_max_members(NEW.family_id);   -- 064: a business's own number on Free
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
  v_max := public.vault_max_members(NEW.family_id);   -- 064: a business's own number on Free
  SELECT count(*) INTO v_members FROM public.family_members m WHERE m.family_id = NEW.family_id;
  IF v_members >= v_max THEN
    RAISE EXCEPTION '% is full: a % can have % members. Ask its admin to make room, then accept again.',
                    v_family, CASE WHEN v_kind = 'business' THEN 'business' ELSE 'family' END, v_max
      USING ERRCODE = 'P0001', HINT = 'family_full';
  END IF;
  RETURN NEW;
END;
$fn$;

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
    'free_members', (SELECT coalesce(pl.business_max_members, pl.max_members) FROM public.plan_limits pl WHERE pl.plan = 'free'),
    'cards',        (SELECT count(*) FROM public.family_emergency_cards c WHERE c.family_id = p_family_id),
    'people',       (SELECT count(*) FROM public.family_people p WHERE p.family_id = p_family_id AND p.user_id IS NULL),
    'links',        (SELECT count(*) FROM public.family_links l WHERE l.family_id = p_family_id));
END;
$fn$;


-- ─── 5. Giving a plan, and paying for one ──────────────────────────────────
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
      RAISE EXCEPTION 'A business is on business_plus, business_pro or business_enterprise, named as the last argument. Family Plus and Family Pro are for family vaults.'
        USING ERRCODE = '22023';
    END IF;
  ELSE
    v_plan := coalesce(v_plan, 'plus');
    IF v_plan NOT IN ('plus', 'family_pro') THEN
      RAISE EXCEPTION 'A family is on plus or family_pro. The business plans are for business vaults.' USING ERRCODE = '22023';
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
                                   WHEN 'family_pro'          THEN '%s has Family Pro'
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

CREATE OR REPLACE FUNCTION public.apply_plan_payment(p_order_id text, p_payment_id text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  r       public.plan_payments%ROWTYPE;
  v_plan  text;
  v_paid  timestamptz;
  v_from  timestamptz;
  v_until timestamptz;
BEGIN
  IF p_payment_id IS NULL OR p_payment_id !~ '^pay_[A-Za-z0-9]{6,40}$' THEN
    RAISE EXCEPTION 'Not a Razorpay payment id.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO r FROM public.plan_payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such order.' USING ERRCODE = '22023';
  END IF;
  IF r.status = 'paid' THEN
    -- Reported again (the app and the webhook both say so): counted once.
    RETURN r.paid_until;
  END IF;

  -- One payment at a time per family, so two paid at the same moment add up
  -- rather than both starting from the same date.
  PERFORM 1 FROM public.families f WHERE f.id = r.family_id FOR UPDATE;

  -- Paid time adds on: from the end of the time already paid for, or from now.
  -- Moving between Plus and Pro (064), the time left is kept at what it is
  -- worth on the new plan, by what a month of each costs: Pro twice Plus
  -- (₹200 and ₹100, $20 and $10; PRO_PRICE and PLUS_PRICE in plan-text.ts).
  -- Half a month of Plus left becomes a week of Pro, and the other way round.
  SELECT fp.plan, fp.paid_until INTO v_plan, v_paid
    FROM public.family_plans fp WHERE fp.family_id = r.family_id;
  IF v_paid > now() AND v_plan IS DISTINCT FROM r.plan THEN
    v_from := now() + (v_paid - now())
              * (CASE v_plan WHEN 'family_pro' THEN 2.0 ELSE 1.0 END
                 / CASE r.plan WHEN 'family_pro' THEN 2.0 ELSE 1.0 END)::float8;
  ELSE
    v_from := greatest(now(), coalesce(v_paid, now()));
  END IF;
  v_until := v_from + CASE r.period WHEN 'yearly' THEN interval '1 year' ELSE interval '1 month' END;

  PERFORM public.set_family_plan(r.family_id, v_until, 'razorpay', p_payment_id, r.plan);
  UPDATE public.plan_payments
     SET status = 'paid', payment_id = p_payment_id, paid_at = now(), paid_until = v_until
   WHERE order_id = p_order_id;
  RETURN v_until;
END;
$fn$;

-- ─── 6. Birthday reminders on Family Plus and Pro ────────────────────────
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
       AND public.family_plan_now(fp.family_id) <> 'free'   -- Family Plus and Pro (064)
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

-- ─── 7. The words when a paid plan ends name it ──────────────────────────
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
  v_name  text;
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
    v_name  := public.family_plan_name(r.plan);
    v_used  := public.family_files_bytes(r.ns);
    v_who   := CASE WHEN r.is_personal THEN 'your personal vault' ELSE r.family_name END;
    v_head := CASE WHEN r.is_personal THEN 'Your personal vault' ELSE r.family_name END;
    v_title := NULL;

    IF v_used <= v_free THEN
      -- Within the free limit: nothing will be removed, and this lapse is done.
      IF r.ended_notice_at IS NULL THEN
        v_title := format('%s has ended for %s', v_name, v_who);
        v_msg   := format('Your documents stay. Reminders and Import from Gmail are part of %s. Renew any time to have them again.', v_name);
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
        v_title := format('%s has ended for %s', v_name, v_who);
        v_msg   := format('%s holds %s, more than the free %s. Renew %s, or delete documents, by %s. After that, the newest documents above %s are removed.',
                          v_head, public.size_text(v_used), public.size_text(v_free), v_name,
                          public.ist_day(v_when), public.size_text(v_free));
        UPDATE public.family_plans SET ended_notice_at = now() WHERE family_id = r.family_id;
      ELSIF r.warned_week_at IS NULL AND now() >= v_when - interval '7 days' AND v_when - now() > interval '1 day' THEN
        v_title := format('In 7 days, documents will be removed from %s', v_who);
        v_msg   := format('On %s, the newest documents above the free %s will be removed. Renew %s, or delete documents to get under %s, to keep them.',
                          public.ist_day(v_when), public.size_text(v_free), v_name, public.size_text(v_free));
        UPDATE public.family_plans SET warned_week_at = now() WHERE family_id = r.family_id;
      ELSIF r.warned_day_at IS NULL AND now() >= v_when - interval '1 day' THEN
        v_title := format('Tomorrow, documents will be removed from %s', v_who);
        v_msg   := format('On %s, the newest documents above the free %s will be removed, unless %s is renewed or documents are deleted to get under %s.',
                          public.ist_day(greatest(v_when, now() + interval '20 hours')),
                          public.size_text(v_free), v_name, public.size_text(v_free));
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

CREATE OR REPLACE FUNCTION public.plan_settle(p_family_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  fp         record;
  v_ns       text;
  v_name     text;
  v_personal boolean;
  v_who      text;
  v_free     bigint;
BEGIN
  SELECT * INTO fp FROM public.family_plans WHERE family_id = p_family_id FOR UPDATE;
  IF NOT FOUND OR fp.settled_at IS NOT NULL THEN
    RETURN false;
  END IF;
  SELECT f.storage_namespace, f.name, f.is_personal INTO v_ns, v_name, v_personal
    FROM public.families f WHERE f.id = p_family_id;
  v_free := public.vault_storage_bytes(p_family_id, 'free');

  IF fp.paid_until > now() OR public.family_files_bytes(v_ns) > v_free THEN
    UPDATE public.family_plans SET cleanup_until = NULL WHERE family_id = p_family_id;
    RETURN false;
  END IF;

  UPDATE public.family_plans SET settled_at = now(), cleanup_until = NULL WHERE family_id = p_family_id;
  IF fp.removed_count > 0 THEN
    v_who := CASE WHEN v_personal THEN 'your personal vault' ELSE v_name END;
    INSERT INTO public.notifications (user_id, family_id, type, title, message)
    SELECT fm.user_id, p_family_id, 'plan',
           left(format('%s %s removed from %s', fp.removed_count,
                       CASE WHEN fp.removed_count = 1 THEN 'document was' ELSE 'documents were' END, v_who), 200),
           format('%s ended on %s, and %s held more than the free %s, so the newest documents above it were removed. Renew %s to add more.',
                  public.family_plan_name(fp.plan), public.ist_day(fp.paid_until), v_who, public.size_text(v_free),
                  public.family_plan_name(fp.plan))
      FROM public.family_members fm
     WHERE fm.family_id = p_family_id;
  END IF;
  RETURN true;
END;
$fn$;

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
  SELECT coalesce(pl.business_storage_bytes, pl.storage_bytes) INTO v_free
    FROM public.plan_limits pl WHERE pl.plan = 'free';
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
    v_msg    := format('%s runs until %s. Make this a business vault after it ends, or ask us in Settings › Feedback.',
                       public.family_plan_name(v_plan), to_char((v_paid AT TIME ZONE 'Asia/Kolkata')::date, 'FMDD FMMonth YYYY'));
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

REVOKE ALL ON FUNCTION public.family_plan_name(text)                            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vault_max_members(uuid)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_invites_within_limit()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.family_members_within_limit()                     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_family_plan(uuid, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_plan_payment(text, text)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_birthday_reminders(date)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_plan_notices()                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.plan_settle(uuid)                                 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_vault_blocker(uuid)                      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_plan_name(text), public.vault_max_members(uuid), public.set_family_plan(uuid, timestamptz, text, text, text),
                          public.apply_plan_payment(text, text), public.queue_birthday_reminders(date),
                          public.queue_plan_notices(), public.plan_settle(uuid), public.business_vault_blocker(uuid)
  TO service_role;
