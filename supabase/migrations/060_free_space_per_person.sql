-- ============================================================================
-- 060: Free space — 50 MB a person, a family 100 MB, a business 200 MB
--
-- The owner's rule, 19 October 2026: on Free, one person can add 50 MB in
-- all, whichever vaults it goes to; a family vault holds 100 MB from
-- everyone together, and a business 200 MB. 059 let a person on Free have a
-- free family and a free business beside their personal vault, so one
-- account could keep 500 MB (048's 100 + 200 + 200). Now:
--
--   Free          each person          50 MB, across every free vault
--                 a personal vault     50 MB  (was 100 MB)
--                 a family vault      100 MB, everyone together (was 200 MB)
--                 a business vault    200 MB, everyone together (unchanged)
--   Paid plans    unchanged: a vault's plan, no number per person
--
--   • plan_limits gains business_storage_bytes, what a business may keep on
--     that plan where it differs from a family (NULL: storage_bytes, as
--     048's personal_storage_bytes), and person_storage_bytes, what one
--     person may add across their free vaults (NULL: no number per person).
--     Both are numbers to change in the Table editor; Free's are 200 MB and
--     50 MB, and the other plans' NULL.
--   • vault_storage_bytes() (048), the one place a vault's limit is read,
--     reads the business number for a business.
--   • A person's 50 MB is what they uploaded themselves (storage.objects'
--     owner_id, which Storage sets from the uploader's session) to vaults
--     they are in that are on Free: person_free_files_bytes(), service role
--     only. Files in a vault on a paid plan do not count, and a file counts
--     while it is there, so deleting a document gives its space back. Files
--     the server stores (Gmail import, a Family Plus feature) have no owner
--     and count for nobody; a vault's own limit still holds them.
--   • family_storage_has_room(), which the documents bucket's upload policy
--     asks (038), also refuses a file into a free vault once the person's
--     own files there reach their 50 MB. As for a vault, a policy cannot see
--     the size of the file arriving, so the last file may go past it by that
--     one file (10 MB at most, 050). The app asks first, with the file's
--     size (person_storage_status(), the caller from auth.uid()).
--   • business_vault_blocker() (054) compares a family vault becoming a
--     business with what a free business keeps, now its own number.
--
-- Lowering a limit deletes nothing (048). A vault or a person over the new
-- number keeps everything and adds nothing until under it. Only a vault whose
-- Family Plus ends is ever cleaned up (040), now down to 100 MB for a family
-- and 50 MB for a personal vault; a business never is (051).
--
-- Apply: paste into the SQL editor — DEV, then PROD — then run
-- qa/sql/sweep.sql (zero rows) and qa/sql/fingerprint.sql on both. Needs 048
-- and 051. Safe to run more than once: each number moves only where it still
-- has the number before it, and a NULL business or person number is set.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'personal_storage_bytes') THEN
    RAISE EXCEPTION 'Apply 048_free_space_by_vault_and_plus_reminders.sql first.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'families'
                    AND column_name = 'kind') THEN
    RAISE EXCEPTION 'Apply 051_business_vaults.sql first.';
  END IF;
END
$do$;


-- ─── 1. Two numbers on each plan ───────────────────────────────────────────
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS business_storage_bytes bigint
  CONSTRAINT plan_limits_business_storage_bytes CHECK (business_storage_bytes IS NULL OR business_storage_bytes > 0);
ALTER TABLE public.plan_limits ADD COLUMN IF NOT EXISTS person_storage_bytes bigint
  CONSTRAINT plan_limits_person_storage_bytes CHECK (person_storage_bytes IS NULL OR person_storage_bytes >= 0);

COMMENT ON COLUMN public.plan_limits.business_storage_bytes IS
  'What a business vault may keep on this plan, where it differs from a family (060). NULL: storage_bytes.';
COMMENT ON COLUMN public.plan_limits.person_storage_bytes IS
  'What one person may add, across the vaults they are in that are on this plan (060); only the free row is read. NULL: no number per person.';


-- ─── 2. Free's numbers, only where still the ones before ───────────────────
-- The business number first: it keeps the 200 MB a business has always had
-- on Free, before the family number below drops to 100 MB.
UPDATE public.plan_limits SET business_storage_bytes = 200::bigint * 1024 * 1024
 WHERE plan = 'free' AND business_storage_bytes IS NULL;
UPDATE public.plan_limits SET storage_bytes = 100::bigint * 1024 * 1024
 WHERE plan = 'free' AND storage_bytes = 200::bigint * 1024 * 1024;
UPDATE public.plan_limits SET personal_storage_bytes = 50::bigint * 1024 * 1024
 WHERE plan = 'free' AND personal_storage_bytes = 100::bigint * 1024 * 1024;
UPDATE public.plan_limits SET person_storage_bytes = 50::bigint * 1024 * 1024
 WHERE plan = 'free' AND person_storage_bytes IS NULL;


-- ─── 3. A vault's limit: a personal vault's, a business's, or a family's ───
CREATE OR REPLACE FUNCTION public.vault_storage_bytes(p_family_id uuid, p_plan text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT CASE WHEN f.is_personal THEN coalesce(pl.personal_storage_bytes, pl.storage_bytes)
              WHEN f.kind = 'business' THEN coalesce(pl.business_storage_bytes, pl.storage_bytes)
              ELSE pl.storage_bytes END
    FROM public.families f
    JOIN public.plan_limits pl ON pl.plan = p_plan
   WHERE f.id = p_family_id;
$fn$;


-- ─── 4. What one person has added to their free vaults ─────────────────────
-- Takes a user id, so the server's alone (CLAUDE.md, "Read this first", 2).
CREATE OR REPLACE FUNCTION public.person_free_files_bytes(p_user uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT coalesce(sum(CASE WHEN o.metadata->>'size' ~ '^[0-9]{1,15}$'
                           THEN (o.metadata->>'size')::bigint END), 0)::bigint
    FROM public.family_members m
    JOIN public.families f ON f.id = m.family_id
    JOIN storage.objects o ON o.bucket_id = 'documents'
                          AND o.owner_id = p_user::text
                          AND o.name LIKE replace(f.storage_namespace, '_', '\_') || '/%'
   WHERE m.user_id = p_user
     AND f.storage_namespace ~ '^family_[0-9a-f]{8}$'
     AND public.family_plan_now(f.id) = 'free';
$fn$;


-- ─── 5. The same, for the person asking, and their number ──────────────────
-- No row for someone signed out. limit_bytes NULL: no number per person.
CREATE OR REPLACE FUNCTION public.person_storage_status()
RETURNS TABLE (used_bytes bigint, limit_bytes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT public.person_free_files_bytes(v_me),
         (SELECT pl.person_storage_bytes FROM public.plan_limits pl WHERE pl.plan = 'free');
END;
$fn$;


-- ─── 6. Room for a new file: the vault's, and on Free the person's ─────────
-- 051's, and a free vault refuses a file once the uploader's own files in
-- their free vaults reach their number.
CREATE OR REPLACE FUNCTION public.family_storage_has_room(p_folder text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_family uuid;
  v_cap    bigint;
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
  IF NOT coalesce(NOT r.closed AND r.used_bytes < r.limit_bytes, false) THEN
    RETURN false;
  END IF;
  IF r.plan = 'free' THEN
    SELECT pl.person_storage_bytes INTO v_cap FROM public.plan_limits pl WHERE pl.plan = 'free';
    IF v_cap IS NOT NULL AND public.person_free_files_bytes(auth.uid()) >= v_cap THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$fn$;


-- ─── 7. A family vault becoming a business: against a free business's room ─
-- 054's, with v_free the business number: vault_storage_bytes() gives a
-- family vault the family's.
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


-- ─── 8. Who may call what ──────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.vault_storage_bytes(uuid, text)    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_free_files_bytes(uuid)      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.business_vault_blocker(uuid)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_storage_status()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.family_storage_has_room(text)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vault_storage_bytes(uuid, text), public.person_free_files_bytes(uuid),
                          public.business_vault_blocker(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.person_storage_status(), public.family_storage_has_room(text)
  TO authenticated, service_role;

-- To check afterwards (read-only):
--   select plan, pg_size_pretty(storage_bytes) as family, pg_size_pretty(personal_storage_bytes) as personal,
--          pg_size_pretty(business_storage_bytes) as business, pg_size_pretty(person_storage_bytes) as person
--     from plan_limits where plan = 'free';
-- free | 100 MB | 50 MB | 200 MB | 50 MB
