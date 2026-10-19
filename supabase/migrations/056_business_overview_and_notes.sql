-- ============================================================================
-- 056: Business overview, and personal notes with reminders
--
-- What a business keeps in AskLocker, put to work: an overview of its own
-- papers, and a scratchpad for each person in it. The owner chose on 17
-- October 2026 that these are paid features, the simpler ones on Business
-- Plus and the heaviest on Pro:
--
--                                   Free     Plus     Pro, Enterprise
--   Overview: how many, as counts    yes      yes      yes
--   Renewals and bills due, listed   -        yes      yes
--   Money in and out, by month       -        -        yes
--   Notes, each person               20       500      500
--   A reminder on a note             -        yes      yes
--
-- Business vaults only: a family has the family tree, emergency cards and
-- Family Plus's reminders instead.
--
--   1. business_overview(): for a member of a business (the caller from
--      auth.uid()), what its documents say, as far as its plan goes:
--      counts always; renewals (each document's latest expiry date, from 30
--      days ago to 90 ahead) and bills with a due date on Plus and up; the
--      invoices and bills for money in and out on Pro and Enterprise. Dates
--      and amounts come back as ingest read them; the app reads them
--      (dates.ts) and says they were read from the documents. A bill marked
--      paid is left out of bills due.
--   2. set_bill_paid(): any member of a business on a paid plan marks a
--      bill paid, or not paid again (document_metadata 'paid_on', the day in
--      India time), and audit_logs records who.
--   3. scratch_notes: a person's own notes in a business — nobody else reads
--      them, not even an admin. RLS on the owner (user_id = auth.uid(),
--      defaulted, never sent) and membership, like saved chats (028), with
--      a foreign key to the membership, so leaving deletes them. Clients
--      insert family_id, body, remind_on and update body, remind_on, done;
--      a trigger keeps the rules on every path: a business vault only, at
--      most plan_limits.notes_per_person each (20 on Free, 500 paid), a
--      reminder only on a paid plan, on a day from today to five years on.
--   4. queue_note_reminders(): from 9 in the morning, India time, a note's
--      reminder becomes a 'note' notification for its owner, once
--      (reminded_at; changing the date asks again), while the business is
--      on a paid plan. pg_cron runs it at three past every hour, so 034's
--      run at five past sends it to their devices. Service role only.
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both.
-- Safe to run more than once. Needs 051.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'families' AND column_name = 'kind') THEN
    RAISE EXCEPTION 'Apply 051_business_vaults.sql first.';
  END IF;
END
$do$;


-- ─── 1. How many notes each person keeps ───────────────────────────────────
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'notes_per_person') THEN
    ALTER TABLE public.plan_limits ADD COLUMN notes_per_person integer
      CONSTRAINT plan_limits_notes_per_person CHECK (notes_per_person IS NULL OR notes_per_person >= 0);
    UPDATE public.plan_limits SET notes_per_person = CASE WHEN plan = 'free' THEN 20 ELSE 500 END;
  END IF;
END
$do$;

COMMENT ON COLUMN public.plan_limits.notes_per_person IS
  'Notes one person may keep in a business vault on this plan (056). NULL: no limit.';


-- ─── 2. Notes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scratch_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id    uuid NOT NULL,
  body         text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  remind_on    date,
  done         boolean NOT NULL DEFAULT false,
  reminded_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scratch_notes_membership_fkey FOREIGN KEY (family_id, user_id)
    REFERENCES public.family_members (family_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS scratch_notes_owner_idx
  ON public.scratch_notes (user_id, family_id, done, remind_on);
CREATE INDEX IF NOT EXISTS scratch_notes_due_idx
  ON public.scratch_notes (remind_on) WHERE NOT done AND reminded_at IS NULL;

ALTER TABLE public.scratch_notes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.scratch_notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.scratch_notes TO authenticated;
GRANT INSERT (family_id, body, remind_on) ON public.scratch_notes TO authenticated;
GRANT UPDATE (body, remind_on, done) ON public.scratch_notes TO authenticated;
GRANT ALL ON public.scratch_notes TO service_role;

DROP POLICY IF EXISTS scratch_notes_select_own ON public.scratch_notes;
CREATE POLICY scratch_notes_select_own ON public.scratch_notes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS scratch_notes_insert_own ON public.scratch_notes;
CREATE POLICY scratch_notes_insert_own ON public.scratch_notes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND family_id IN (SELECT public.get_my_family_ids()));

DROP POLICY IF EXISTS scratch_notes_update_own ON public.scratch_notes;
CREATE POLICY scratch_notes_update_own ON public.scratch_notes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND family_id IN (SELECT public.get_my_family_ids()))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS scratch_notes_delete_own ON public.scratch_notes;
CREATE POLICY scratch_notes_delete_own ON public.scratch_notes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- The rules, on every path. Owner's rights: it reads the vault and its plan.
CREATE OR REPLACE FUNCTION public.scratch_note_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_kind  text;
  v_plan  text;
  v_cap   integer;
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT f.kind INTO v_kind FROM public.families f WHERE f.id = NEW.family_id;
  v_plan := public.family_plan_now(NEW.family_id);

  IF TG_OP = 'INSERT' THEN
    IF v_kind IS DISTINCT FROM 'business' THEN
      RAISE EXCEPTION 'Notes are for business vaults.' USING ERRCODE = 'P0001', HINT = 'not_business';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('scratch_notes:' || NEW.user_id::text || ':' || NEW.family_id::text));
    SELECT pl.notes_per_person INTO v_cap FROM public.plan_limits pl WHERE pl.plan = v_plan;
    IF v_cap IS NOT NULL AND (SELECT count(*) FROM public.scratch_notes n
                               WHERE n.user_id = NEW.user_id AND n.family_id = NEW.family_id) >= v_cap THEN
      RAISE EXCEPTION '%', CASE WHEN v_plan = 'free'
          THEN format('You have %s notes, the most on Free. Delete one, or move to a plan for more.', v_cap)
          ELSE format('You have %s notes, the most on your plan. Delete one to add another.', v_cap) END
        USING ERRCODE = 'P0001', HINT = 'notes_limit';
    END IF;
  ELSE
    NEW.updated_at := now();
    IF NEW.remind_on IS DISTINCT FROM OLD.remind_on THEN
      NEW.reminded_at := NULL;
    END IF;
  END IF;

  IF NEW.remind_on IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.remind_on IS DISTINCT FROM OLD.remind_on) THEN
    IF v_plan = 'free' THEN
      RAISE EXCEPTION 'Reminders on notes come with a business plan.' USING ERRCODE = 'P0001', HINT = 'plus_only';
    END IF;
    IF NEW.remind_on < v_today OR NEW.remind_on > v_today + interval '5 years' THEN
      RAISE EXCEPTION 'Pick a day from today on.' USING ERRCODE = 'P0001', HINT = 'bad_date';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS scratch_notes_rules ON public.scratch_notes;
CREATE TRIGGER scratch_notes_rules
  BEFORE INSERT OR UPDATE ON public.scratch_notes
  FOR EACH ROW EXECUTE FUNCTION public.scratch_note_rules();


-- ─── 3. Reminders on notes ─────────────────────────────────────────────────
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
           left(split_part(btrim(d.body), E'\n', 1), 80),
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

DO $do$
BEGIN
  PERFORM cron.schedule('asklocker-note-reminders', '3 * * * *', 'SELECT public.queue_note_reminders()');
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
  RAISE NOTICE 'pg_cron is not here: note reminders are made only when queue_note_reminders() is called.';
END
$do$;


-- ─── 4. The overview ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.business_overview(p_family_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me      uuid := auth.uid();
  v_f       public.families%ROWTYPE;
  v_plan    text;
  v_tier    text;
  v_today   date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_counts  jsonb;
  v_renew   jsonb;
  v_bills   jsonb;
  v_money   jsonb;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id;
  IF v_f.kind IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'The overview is for business vaults.' USING ERRCODE = 'P0001', HINT = 'not_business';
  END IF;
  v_plan := public.family_plan_now(p_family_id);
  v_tier := CASE WHEN v_plan IN ('business_pro', 'business_enterprise') THEN 'pro'
                 WHEN v_plan = 'business_plus' THEN 'plus' ELSE 'free' END;

  -- Counts, on every plan: what the lists below would hold.
  EXECUTE format($q$
    WITH latest AS (
      SELECT a.document_id, max(a.expiry_date) AS expiry_date
        FROM %1$I.expiry_alerts a JOIN %1$I.documents d ON d.id = a.document_id AND NOT coalesce(d.is_deleted, false)
       GROUP BY a.document_id
    )
    SELECT jsonb_build_object(
      'renewals', (SELECT count(*) FROM latest WHERE expiry_date BETWEEN $1 AND $1 + 90),
      'expired',  (SELECT count(*) FROM latest WHERE expiry_date BETWEEN $1 - 30 AND $1 - 1),
      'bills',    (SELECT count(*) FROM %1$I.documents d
                    WHERE NOT coalesce(d.is_deleted, false)
                      AND EXISTS (SELECT 1 FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'due_date')
                      AND NOT EXISTS (SELECT 1 FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'paid_on')),
      'invoices', (SELECT count(*) FROM %1$I.documents d JOIN public.document_categories c ON c.id = d.category_id
                    WHERE NOT coalesce(d.is_deleted, false) AND c.name IN ('Sales Invoices', 'Purchase Bills')),
      'documents', (SELECT count(*) FROM %1$I.documents d WHERE NOT coalesce(d.is_deleted, false)))
  $q$, v_f.storage_namespace) INTO v_counts USING v_today;

  IF v_tier IN ('plus', 'pro') THEN
    EXECUTE format($q$
      WITH latest AS (
        SELECT a.document_id, max(a.expiry_date) AS expiry_date
          FROM %1$I.expiry_alerts a JOIN %1$I.documents d ON d.id = a.document_id AND NOT coalesce(d.is_deleted, false)
         GROUP BY a.document_id
      )
      SELECT coalesce(jsonb_agg(jsonb_build_object(
               'document_id', d.id, 'file_name', d.file_name, 'category', c.name, 'expiry_date', l.expiry_date)
               ORDER BY l.expiry_date), '[]'::jsonb)
        FROM (SELECT * FROM latest WHERE expiry_date BETWEEN $1 - 30 AND $1 + 90 ORDER BY expiry_date LIMIT 100) l
        JOIN %1$I.documents d ON d.id = l.document_id
        LEFT JOIN public.document_categories c ON c.id = d.category_id
    $q$, v_f.storage_namespace) INTO v_renew USING v_today;

    EXECUTE format($q$
      SELECT coalesce(jsonb_agg(x.j ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
        SELECT d.created_at, jsonb_build_object(
                 'document_id', d.id, 'file_name', d.file_name, 'category', c.name,
                 'due_date', (SELECT m.value FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'due_date' LIMIT 1),
                 'total_amount', (SELECT m.value FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'total_amount' LIMIT 1),
                 'invoice_number', (SELECT m.value FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'invoice_number' LIMIT 1)) AS j
          FROM %1$I.documents d
          LEFT JOIN public.document_categories c ON c.id = d.category_id
         WHERE NOT coalesce(d.is_deleted, false)
           AND EXISTS (SELECT 1 FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'due_date')
           AND NOT EXISTS (SELECT 1 FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'paid_on')
         ORDER BY d.created_at DESC
         LIMIT 200) x
    $q$, v_f.storage_namespace) INTO v_bills;
  END IF;

  IF v_tier = 'pro' THEN
    EXECUTE format($q$
      SELECT coalesce(jsonb_agg(x.j ORDER BY x.created_at DESC), '[]'::jsonb) FROM (
        SELECT d.created_at, jsonb_build_object(
                 'document_id', d.id,
                 'kind', CASE WHEN c.name = 'Sales Invoices' THEN 'in' ELSE 'out' END,
                 'invoice_date', (SELECT m.value FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'invoice_date' LIMIT 1),
                 'total_amount', (SELECT m.value FROM %1$I.document_metadata m WHERE m.document_id = d.id AND m.key = 'total_amount' LIMIT 1),
                 'created_at', d.created_at) AS j
          FROM %1$I.documents d
          JOIN public.document_categories c ON c.id = d.category_id
         WHERE NOT coalesce(d.is_deleted, false) AND c.name IN ('Sales Invoices', 'Purchase Bills')
         ORDER BY d.created_at DESC
         LIMIT 1000) x
    $q$, v_f.storage_namespace) INTO v_money;
  END IF;

  RETURN jsonb_build_object('tier', v_tier, 'plan', v_plan, 'today', v_today, 'counts', v_counts,
                            'renewals', v_renew, 'bills', v_bills, 'money', v_money);
END;
$fn$;


-- ─── 5. A bill paid ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_bill_paid(p_family_id uuid, p_document_id uuid, p_paid boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me     uuid := auth.uid();
  v_f      public.families%ROWTYPE;
  v_found  boolean;
BEGIN
  IF v_me IS NULL OR NOT EXISTS (SELECT 1 FROM public.family_members m
                                  WHERE m.family_id = p_family_id AND m.user_id = v_me) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_f FROM public.families f WHERE f.id = p_family_id;
  IF v_f.kind IS DISTINCT FROM 'business' THEN
    RAISE EXCEPTION 'This is for business vaults.' USING ERRCODE = 'P0001', HINT = 'not_business';
  END IF;
  IF public.family_plan_now(p_family_id) = 'free' THEN
    RAISE EXCEPTION 'Bills due come with a business plan.' USING ERRCODE = 'P0001', HINT = 'plus_only';
  END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.documents WHERE id = $1 AND NOT coalesce(is_deleted, false))', v_f.storage_namespace)
    INTO v_found USING p_document_id;
  IF NOT v_found THEN
    RAISE EXCEPTION 'That document is not in this business.' USING ERRCODE = 'P0001', HINT = 'no_document';
  END IF;

  EXECUTE format('DELETE FROM %I.document_metadata WHERE document_id = $1 AND key = ''paid_on''', v_f.storage_namespace)
    USING p_document_id;
  IF coalesce(p_paid, true) THEN
    EXECUTE format('INSERT INTO %I.document_metadata (document_id, key, value, auto_extracted, confidence) VALUES ($1, ''paid_on'', $2, false, 1)',
                   v_f.storage_namespace)
      USING p_document_id, to_char((now() AT TIME ZONE 'Asia/Kolkata')::date, 'DD/MM/YYYY');
  END IF;
  INSERT INTO public.audit_logs (user_id, family_id, action, resource_type, resource_id)
  VALUES (v_me, p_family_id, CASE WHEN coalesce(p_paid, true) THEN 'bill_paid' ELSE 'bill_unpaid' END, 'document', p_document_id);
END;
$fn$;


-- ─── Grants ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.scratch_note_rules() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.queue_note_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_note_reminders(timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.business_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.business_overview(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_bill_paid(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_bill_paid(uuid, uuid, boolean) TO authenticated, service_role;
