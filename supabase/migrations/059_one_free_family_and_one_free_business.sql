-- ============================================================================
-- 059: On Free, one family and one business
--
-- The owner's rule, 19 October 2026: someone on Free uses Free for both, a
-- family vault and a business vault, without paying for either. 054 gave a
-- person on Free one vault in all besides their personal vault, a family or
-- a business (plan_limits.vaults_per_person, 1), and 055 lifted it only for
-- someone in a vault on a paid plan. So a person with a free family was
-- refused a business ("On Free, you can create one family or one business"),
-- and choosing Both on the welcome screen led to a refusal.
--
-- Now everyone on Free creates one free family and one free business,
-- besides their personal vault: 050's families_per_person and 051's
-- businesses_per_person, both 1, which create_family() has checked all
-- along. The combined number is turned off (NULL), only where it is still
-- 054's 1, so a number changed in the Table editor since is kept.
--
-- No function changes: create_family() (055) skips the combined number when
-- it is NULL. A second free family, or a second free business, is still
-- refused (HINT family_limit), and vaults on a paid plan still do not count.
--
-- What it costs: one person on Free may now keep 500 MB (100 MB personal,
-- 200 MB family, 200 MB business) where 054 kept them to 300 MB, against the
-- Supabase organisation's 1 GB of files on its Free plan.
--
-- Apply: paste into the SQL editor — DEV, then PROD. Data only, so
-- qa/sql/fingerprint.sql does not see it; check with the query at the end.
-- Safe to run more than once. Where 054 is not applied it changes nothing.
-- ============================================================================

DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'plan_limits'
                    AND column_name = 'vaults_per_person') THEN
    RAISE NOTICE '059: plan_limits.vaults_per_person is missing (054 is not applied); nothing changed.';
    RETURN;
  END IF;

  UPDATE public.plan_limits SET vaults_per_person = NULL
   WHERE plan = 'free' AND vaults_per_person = 1;
END
$do$;

-- To check afterwards (read-only):
--   select plan, vaults_per_person, families_per_person, businesses_per_person
--     from plan_limits where plan = 'free';
-- free | (null) | 1 | 1
