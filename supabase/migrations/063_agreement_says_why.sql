-- ============================================================================
-- 063: The agreement's second version — its opening line says why
--
-- 062's version 2026-10-23 opened with "Please read the following.", which
-- the owner found said nothing. Version 2026-10-23.2 opens with "We respect
-- your confidentiality. Here's exactly what we do with your documents." The
-- points, the footer and the tick are unchanged. An applied migration is
-- never edited, so the new words are a new version here, and agreement.ts's
-- AGREEMENT_VERSION moves to it in the same release: everyone who agreed to
-- 2026-10-23 is asked again (on DEV nobody had, when this was written).
--
-- Line breaks: 062 pasted into DEV's SQL editor stored its words with CR LF,
-- where the app writes LF. The words were the same, the bytes were not, and
-- the record should hold exactly what the screen said. So every version's
-- words lose their CRs here, this one's included, however it is pasted.
-- Only line breaks change; nothing else in a version is touched.
--
-- Apply: paste into the SQL editor — DEV, then PROD, after 062 — before the
-- release that carries it. Safe to run more than once. Without it the app
-- keeps the agreement on the device and sends it once this is applied
-- (record_agreement() refuses a version it does not know).
-- ============================================================================

-- Version 2026-10-23.2: the words as agreementText() writes them, exactly.
insert into public.agreement_versions (version, body)
values ('2026-10-23.2', $agreement$Before you start

We respect your confidentiality. Here's exactly what we do with your documents.

Encrypted
Sent and stored encrypted. In AskLocker, only people in your vault can open them.

Read to answer you
Our servers and AI services read parts of them to answer your questions.

More in Settings › Privacy. If this changes, we'll ask you again.

I've read this and I agree.$agreement$)
on conflict (version) do nothing;

update public.agreement_versions
   set body = replace(body, E'\r', '')
 where strpos(body, E'\r') > 0;
