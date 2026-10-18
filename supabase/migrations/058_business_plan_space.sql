-- ============================================================================
-- 058: The business plans' space
--
-- The owner set it on 18 October 2026, after weighing what the space costs
-- on Supabase Pro: about ₹3 a GB a month (₹2 for the file, ₹1 for its text
-- and search data), and only the first 100 GB included for the whole
-- organisation. 052's 100 GB on Pro was all of that; Enterprise's 200 GB
-- twice it.
--
--   Plus        ('business_plus')        25 GB  ->  10 GB
--   Pro         ('business_pro')        100 GB  ->  25 GB
--   Enterprise  ('business_enterprise') 200 GB  -> 100 GB
--
-- People, questions, prices and everything else stay as 052 and 054 set
-- them. Each row moves only where it still has 052's number, so a number
-- changed in the Table editor since is kept.
--
-- Lowering it deletes nothing. A business is never cleaned up (051): one
-- holding more than its plan's new space keeps every record and adds
-- nothing until it is under it, as a vault does when its free limit is
-- lowered (048). set_family_plan()'s notice ("Room for 10 GB…") and every
-- screen read the row, so nothing else changes.
--
-- Safe to run more than once. Where 038 is not applied it changes nothing.
-- ============================================================================

DO $do$
BEGIN
  IF to_regclass('public.plan_limits') IS NULL THEN
    RAISE NOTICE '058: public.plan_limits is missing (038 is not applied); nothing changed.';
    RETURN;
  END IF;

  UPDATE public.plan_limits SET storage_bytes = 10::bigint * 1024 * 1024 * 1024
   WHERE plan = 'business_plus' AND storage_bytes = 25::bigint * 1024 * 1024 * 1024;

  UPDATE public.plan_limits SET storage_bytes = 25::bigint * 1024 * 1024 * 1024
   WHERE plan = 'business_pro' AND storage_bytes = 100::bigint * 1024 * 1024 * 1024;

  UPDATE public.plan_limits SET storage_bytes = 100::bigint * 1024 * 1024 * 1024
   WHERE plan = 'business_enterprise' AND storage_bytes = 200::bigint * 1024 * 1024 * 1024;
END
$do$;

-- To check afterwards (read-only):
--   select plan, pg_size_pretty(storage_bytes) from plan_limits
--    where plan like 'business_%' order by storage_bytes;
-- business_plus 10 GB, business_pro 25 GB, business_enterprise 100 GB.
