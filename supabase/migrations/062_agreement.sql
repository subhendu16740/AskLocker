-- ============================================================================
-- 062: What everyone agrees to before using AskLocker, and when they agreed
--
-- Before anything else, every signed-in person sees one screen that says in
-- plain words what AskLocker does with their documents (who can see them,
-- that they are not end-to-end encrypted, which outside services read parts
-- of them, that AI answers can be wrong, that AskLocker is not a backup, what
-- happens when Family Plus ends, deleting, usage counts), ticks "I've read
-- this and I agree" and taps Continue. There is no way past it but agreeing
-- or signing out (src/components/agreement-screen.tsx). This keeps the proof:
--
--   agreement_versions   the exact words of each version, as the screen showed
--                        them (supabase/functions/_shared/agreement.ts,
--                        agreementText()). The QA self-test checks this
--                        file's words against the app's, word for word.
--   user_agreements      who agreed to which version, and when, by the
--                        database's clock (never the device's), with the
--                        platform and the app build that showed it.
--
-- Rules, kept here rather than in the app:
--   * A person records only their own agreement: record_agreement() takes the
--     caller from auth.uid(), never an argument (CLAUDE.md, point 2), and
--     only for a version this table knows.
--   * Nothing is changed or deleted by a client: no UPDATE or DELETE grant on
--     either table, and a second agreement to the same version keeps the
--     first time. A person reads only their own rows.
--   * A row goes with the account (ON DELETE CASCADE on auth.users), like
--     everything else an account has (029, 030).
--
-- A new version (the words changed): a new migration that inserts it, and a
-- new AGREEMENT_VERSION in agreement.ts in the same release. Everyone who has
-- not agreed to it is asked again.
--
-- Apply: paste into the SQL editor — DEV, then PROD — before the release
-- that carries the screen. Safe to run more than once. Without it the app
-- still shows the screen and keeps the agreement on the device, sending it
-- here once this is applied.
-- ============================================================================

create table if not exists public.agreement_versions (
  version    text primary key check (char_length(version) between 1 and 40),
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.agreement_versions enable row level security;
drop policy if exists agreement_versions_read on public.agreement_versions;
create policy agreement_versions_read on public.agreement_versions
  for select to anon, authenticated using (true);
revoke all on public.agreement_versions from public, anon, authenticated;
grant select on public.agreement_versions to anon, authenticated;

create table if not exists public.user_agreements (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  version    text not null references public.agreement_versions (version),
  agreed_at  timestamptz not null default now(),
  platform   text check (platform in ('web', 'android', 'ios')),
  app_build  text check (char_length(app_build) <= 40),
  unique (user_id, version)
);

alter table public.user_agreements enable row level security;
drop policy if exists user_agreements_read_own on public.user_agreements;
create policy user_agreements_read_own on public.user_agreements
  for select to authenticated using (user_id = auth.uid());
revoke all on public.user_agreements from public, anon, authenticated;
grant select on public.user_agreements to authenticated;

-- The caller agrees to a version. Returns when they first agreed to it.
create or replace function public.record_agreement(
  p_version   text,
  p_platform  text default null,
  p_app_build text default null
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_at timestamptz;
begin
  if v_me is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not exists (select 1 from agreement_versions where version = p_version) then
    raise exception 'This version of the agreement is not known.'
      using errcode = '22023', hint = 'unknown_version';
  end if;

  insert into user_agreements (user_id, version, platform, app_build)
  values (
    v_me,
    p_version,
    case when p_platform in ('web', 'android', 'ios') then p_platform end,
    left(p_app_build, 40)
  )
  on conflict (user_id, version) do nothing;

  select agreed_at into v_at
    from user_agreements
   where user_id = v_me and version = p_version;
  return v_at;
end;
$$;

revoke all on function public.record_agreement(text, text, text) from public, anon, authenticated;
grant execute on function public.record_agreement(text, text, text) to authenticated;

-- Version 2026-10-23: the words as agreementText() writes them, exactly.
insert into public.agreement_versions (version, body)
values ('2026-10-23', $agreement$Before you start

Here is what AskLocker does with your documents.

Who can see them
Everyone in a vault can see its documents. Anyone you send a share link to can see that document. Your personal vault is only for you.

Not end-to-end encrypted
Your documents are encrypted when sent and when stored, but not end-to-end. The people who run AskLocker can open them.

Other services read parts of them
To search and answer questions, our servers read the text of your documents. Parts of it go to HuggingFace and Groq. Scanned PDFs and photos from Gmail go to OCR.space.

AI can be wrong
Answers are written by AI. Check the document before you rely on an answer.

Not a backup
Keep the originals of important papers. AskLocker is not a backup.

When Family Plus ends
If a vault holds more than its free space, its newest documents above that are removed after 30 days. We warn you first.

Deleting your account
It happens at once and can't be undone. Documents you added to a family may stay there after you go.

Usage counts
We count which screens are used and the kinds of documents added, like "Passport", never what they say. You can turn this off in Settings › Privacy.

If any of this changes, we'll ask you again.

I've read this and I agree.$agreement$)
on conflict (version) do nothing;
