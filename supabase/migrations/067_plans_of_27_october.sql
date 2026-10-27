-- ============================================================================
-- 067: the plans of 27 October 2026 — more space, fewer shared questions, and
--      one expiry reminder on Free
--
-- The owner's plans, 27 October 2026, with Supabase Pro under PROD (files at
-- about ₹2 a GB a month, the rest of a document in the database about ₹1):
--
--   Families       Free              Family Plus          Family Pro
--   People         2                 4                    8
--   Space          100 MB a person   5 GB (was 500 MB)    10 GB (was 2 GB)
--                  (was 50 MB)
--   Questions      20 a person       250 a month shared   500 a month shared
--                                    (was 500)            (was 2,000)
--   Tries a day    10 each           20 each (was 50)     20 each (was 50)
--   Expiry         one reminder,     every stage, to everyone
--   reminders      30 days before,
--                  to whoever added it
--   Indian languages for reading documents: Plus and up (was Pro only); the
--   app's rule (INDIAN_LANGUAGE_PLANS), since the device reads photos.
--
--   Businesses     Free              Plus          Pro            Enterprise
--   People         2                 5             10             50
--   Space          100 MB a person   20 GB (was 5) 50 GB (was 25) 200 GB (was 100)
--   Questions      20 a person       1,000 shared  2,000 shared   8,000 shared
--                                                  (was 5,000)    (was no limit)
--   Expiry reminders on Free: none, as before.
--
-- Why these numbers (CLAUDE.md, "The plans of 27 October 2026"): a question
-- costs about ₹0.24, so at the heaviest use — every question asked and all
-- the space filled, every month — every paid plan still keeps money: Family
-- Plus and Pro 22% a month (8% on a year), the business plans 35–38% (23–26%).
-- Business Pro's 5,000 and Enterprise's no limit lost money at full use.
--
-- Free's 100 MB a person is 060's person_storage_bytes; a free vault holds
-- what its people may add: a family 200 MB (two people), a personal vault
-- 100 MB, a business 200 MB.
--
--   • plan_limits: each number changes only where it still has its old
--     value, so a number changed by hand in the Table editor stays.
--   • queue_family_expiry_reminders(): a family vault on Free makes one
--     reminder a document, once 30 days or fewer are left (so a document
--     added with 5 days left still gets it), for whoever added it while they
--     are still a member; a vault on a paid plan makes every
--     stage for everyone, as before (048); a business on Free none. The
--     30-day stage is recorded, so a vault that moves to a paid plan carries
--     on from the next stage.
--   • rag-search counts a question when it is asked, and gives it back only
--     when the AI service failed (supabase/functions/rag-search). Nothing
--     here: release_question() is unchanged.
--   • Lowering a number deletes nothing and removes nobody (041, 048).
--
-- Data and one function body: the 024 fingerprint sees the function, not the
-- numbers. Check the rows by hand on both projects:
--   select plan, storage_bytes, personal_storage_bytes, business_storage_bytes,
--          person_storage_bytes, questions_fair_use, family_questions_per_month,
--          question_tries_per_day from plan_limits order by plan;
-- ============================================================================

-- ─── 1. The numbers ──────────────────────────────────────────────────────────

-- Free: 100 MB a person; a family vault 200 MB, a personal vault 100 MB, a
-- business 200 MB.
UPDATE public.plan_limits SET person_storage_bytes = 104857600
 WHERE plan = 'free' AND person_storage_bytes = 52428800;
UPDATE public.plan_limits SET storage_bytes = 209715200
 WHERE plan = 'free' AND storage_bytes = 52428800;
UPDATE public.plan_limits SET personal_storage_bytes = 104857600
 WHERE plan = 'free' AND personal_storage_bytes = 52428800;
UPDATE public.plan_limits SET business_storage_bytes = 209715200
 WHERE plan = 'free' AND business_storage_bytes = 104857600;

-- Family Plus: 5 GB, 250 questions a month for the family, 20 tries a day.
UPDATE public.plan_limits SET storage_bytes = 5368709120
 WHERE plan = 'plus' AND storage_bytes = 524288000;
UPDATE public.plan_limits SET questions_fair_use = 250
 WHERE plan = 'plus' AND questions_fair_use = 500;
UPDATE public.plan_limits SET family_questions_per_month = 250
 WHERE plan = 'plus' AND family_questions_per_month = 500;
UPDATE public.plan_limits SET question_tries_per_day = 20
 WHERE plan = 'plus' AND question_tries_per_day = 50;

-- Family Pro: 10 GB, 500 questions a month for the family, 20 tries a day.
UPDATE public.plan_limits SET storage_bytes = 10737418240
 WHERE plan = 'family_pro' AND storage_bytes = 2147483648;
UPDATE public.plan_limits SET questions_fair_use = 500
 WHERE plan = 'family_pro' AND questions_fair_use = 2000;
UPDATE public.plan_limits SET family_questions_per_month = 500
 WHERE plan = 'family_pro' AND family_questions_per_month = 2000;
UPDATE public.plan_limits SET question_tries_per_day = 20
 WHERE plan = 'family_pro' AND question_tries_per_day = 50;

-- Business Plus: 20 GB.
UPDATE public.plan_limits SET storage_bytes = 21474836480
 WHERE plan = 'business_plus' AND storage_bytes = 5368709120;

-- Business Pro: 50 GB, 2,000 questions a month for the business.
UPDATE public.plan_limits SET storage_bytes = 53687091200
 WHERE plan = 'business_pro' AND storage_bytes = 26843545600;
UPDATE public.plan_limits SET questions_fair_use = 2000
 WHERE plan = 'business_pro' AND questions_fair_use = 5000;
UPDATE public.plan_limits SET family_questions_per_month = 2000
 WHERE plan = 'business_pro' AND family_questions_per_month = 5000;

-- Enterprise: 200 GB, 8,000 questions a month for the business.
UPDATE public.plan_limits SET storage_bytes = 214748364800
 WHERE plan = 'business_enterprise' AND storage_bytes = 107374182400;
UPDATE public.plan_limits SET questions_fair_use = 8000
 WHERE plan = 'business_enterprise' AND questions_fair_use IS NULL;
UPDATE public.plan_limits SET family_questions_per_month = 8000
 WHERE plan = 'business_enterprise' AND family_questions_per_month IS NULL;


-- ─── 2. One expiry reminder on Free ──────────────────────────────────────────
-- As 051's, with a family vault on Free no longer skipped: it makes the
-- 30-day reminder alone, for whoever added the document.
CREATE OR REPLACE FUNCTION public.queue_family_expiry_reminders(p_family_id uuid, p_today date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_today date := coalesce(p_today, (now() AT TIME ZONE 'Asia/Kolkata')::date);
  v_ns    text;
  v_free  boolean;
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
  v_free := public.family_plan_now(p_family_id) = 'free';
  IF v_free AND EXISTS (SELECT 1 FROM public.families WHERE id = p_family_id AND kind = 'business') THEN
    RETURN 0;
  END IF;

  FOR a IN EXECUTE format($q$
    SELECT al.document_id, al.expiry_date, al.alert_days_before, d.file_name, d.uploaded_by,
           p.display_name AS whose
      FROM %1$I.expiry_alerts al
      JOIN %1$I.documents d ON d.id = al.document_id AND NOT d.is_deleted
      LEFT JOIN public.family_people p ON p.id = d.belongs_to_member AND p.family_id = $2
     WHERE al.expiry_date BETWEEN $1 - 3 AND $1 + 366
  $q$, v_ns) USING v_today, p_family_id
  LOOP
    v_days := a.expiry_date - v_today;
    IF v_free THEN
      -- Free: the one reminder, from 30 days before until the day before.
      CONTINUE WHEN v_days < 1 OR v_days > 30;
      v_stage := 30;
    ELSIF v_days <= 0 THEN
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
     WHERE fm.family_id = p_family_id
       AND (NOT v_free OR fm.user_id = a.uploaded_by);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE ALL ON FUNCTION public.queue_family_expiry_reminders(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_family_expiry_reminders(uuid, date) TO service_role;
