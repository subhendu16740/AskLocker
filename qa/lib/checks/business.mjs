// ─── Business vaults (051): a business's rules, and a family's kept ─
//
// QA account A has a business beside its family: QA Business A, on Free,
// made on the first run after 051 is on DEV and reused after that (a person
// on Free creates one family and one business). Everything here is skipped,
// saying so, until 051 is applied to DEV.
//
//   Strangers (B outside it, a logged-out visitor) read nothing of it; no
//   client changes a vault's kind, gives a plan, or calls the functions only
//   the server may; B cannot delete it through delete-account; A cannot make
//   a second free business.
//   B is invited and accepts, as a viewer. In the business an admin deletes
//   anyone's document and file, and a viewer nobody's but their own; the
//   last admin can neither leave nor step down; delete-account's preview
//   says the business holds A's account. B leaves at the end.
//   In the database (DEV, with SUPABASE_ACCESS_TOKEN), inside one DO block
//   that always ends by raising, so every write rolls back even when a guard
//   fails: deleting A's account is refused; a trial ends back on Free; a
//   paid plan ends closed, with one notice, nothing removed, never a clean-up
//   candidate; on Pro, A asks with Pro's numbers; Family Plus on QA Vault A
//   ends exactly as before; Business Plus is refused for a family, Family
//   Plus (and a payment naming no plan) for a business, and kind 'business'
//   for a personal vault. The payments function refuses to start Family Plus
//   for a business.
//
// No questions: no Groq budget.
// ────────────────────────────────────────────────────────────────

import { invokeFunction } from '../supabase.mjs';
import { DEV_REF } from '../config.mjs';
import { refusedByAuth, short } from './access.mjs';

export const BUSINESS_A = 'QA Business A';
const DESCRIPTION = 'Automated QA: a business vault with synthetic SPECIMEN records only. Managed by qa/run.mjs.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const missingFunction = (error) =>
  !!error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message ?? ''));
const missingColumn = (error) =>
  !!error && (error.code === '42703' || /column .*kind.* does not exist|kind/i.test(error.message ?? ''));

/** A's business, made the first time. Null (with why) where 051 is not on DEV. */
async function ensureBusiness(a) {
  const { data: rows, error } = await a.client.from('family_members').select('family_id').eq('user_id', a.user.id);
  if (error) throw new Error(`A could not read its memberships: ${error.message}`);
  const ids = (rows ?? []).map((r) => r.family_id);
  if (ids.length) {
    const { data: fams, error: famErr } = await a.client.from('families').select('id, name, storage_namespace, kind').in('id', ids);
    if (famErr) {
      if (missingColumn(famErr)) return { why: 'migration 051 is not applied to DEV yet (no families.kind)' };
      throw new Error(`A could not read its vaults: ${famErr.message}`);
    }
    const found = (fams ?? []).find((f) => f.name === BUSINESS_A);
    if (found) {
      if (found.kind !== 'business') throw new Error(`${BUSINESS_A} exists but is a ${found.kind} vault`);
      return { vault: { id: found.id, name: found.name, namespace: found.storage_namespace }, created: false };
    }
  }
  const { data: id, error: mkErr } = await a.client.rpc('create_family', {
    p_user_id: a.user.id, p_family_name: BUSINESS_A, p_description: DESCRIPTION, p_family_icon: '🧪', p_kind: 'business',
  });
  if (mkErr) {
    if (missingFunction(mkErr)) return { why: 'migration 051 is not applied to DEV yet (create_family has no p_kind)' };
    throw new Error(`A could not create ${BUSINESS_A}: ${mkErr.message}`);
  }
  const { data: fam, error: readErr } = await a.client.from('families').select('id, name, storage_namespace').eq('id', id).single();
  if (readErr) throw new Error(`created ${BUSINESS_A} but cannot read it back: ${readErr.message}`);
  return { vault: { id: fam.id, name: fam.name, namespace: fam.storage_namespace }, created: true };
}

async function managementQuery(cfg, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${DEV_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.managementToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

/**
 * The database checks, as one DO block that always ends by raising
 * QA-RESULT, so everything it does rolls back. Exported so it can be tried on
 * a local Postgres before it ever reaches DEV.
 */
export function businessDbSql({ bizId, userA, familyA, userB }) {
  return `do $qa$
declare
  v_out text := '';
  v_ns  text;
  v_biz text := (select name from public.families where id = '${bizId}');
  v_fam text := (select name from public.families where id = '${familyA}');
  s     record;
  v_service text := '{"role":"service_role"}';
  v_as_a    text := '{"role":"authenticated","sub":"${userA}"}';
  v_as_b    text := '{"role":"authenticated","sub":"${userB}"}';
  v_hint    text;
begin
  perform set_config('request.jwt.claims', v_service, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  begin
    perform public.delete_account_data('${userA}');
    v_out := v_out || 'account=DELETED;';
  exception when others then
    v_out := v_out || 'account=' || CASE WHEN SQLERRM ILIKE '%last admin%' THEN 'refused' ELSE 'other:' || left(SQLERRM, 60) END || ';';
  end;

  perform public.set_family_plan('${bizId}', now() + interval '1 day', 'trial', null, 'business_pro');
  v_out := v_out || 'pro_questions=' || ((select ceiling from public.question_allowance('${userA}'))
             >= (select questions_fair_use from public.plan_limits where plan = 'business_pro')) || ';';
  -- 056: on Pro the overview has money in and out, and a reminder on a note
  -- reaches its owner from 9 in the morning, India time.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'business_overview') then
    perform set_config('request.jwt.claims', v_as_a, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '${userA}', true);
    v_out := v_out || 'overview_pro=' || coalesce(public.business_overview('${bizId}')->>'tier', 'none')
          || ';overview_money=' || (jsonb_typeof(public.business_overview('${bizId}')->'money') = 'array') || ';';
    insert into public.scratch_notes (family_id, body, remind_on)
      values ('${bizId}', 'QA note reminder', (now() at time zone 'Asia/Kolkata')::date);
    perform set_config('request.jwt.claims', v_service, true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    -- Two statements: the second must see what the first made.
    v_out := v_out || 'note_reminders=' || public.queue_note_reminders(((now() at time zone 'Asia/Kolkata')::date + time '10:00') at time zone 'Asia/Kolkata') || ';';
    v_out := v_out || 'note_notified=' || exists (select 1 from public.notifications n where n.user_id = '${userA}' and n.type = 'note'
                                                    and n.title = 'QA note reminder' and n.family_id = '${bizId}') || ';';
  else
    v_out := v_out || 'overview_pro=none;';
  end if;
  perform public.end_family_plan('${bizId}');
  perform public.queue_plan_notices();
  select * into s from public.family_storage_status('${bizId}');
  v_out := v_out || 'trial_notice=' || exists (select 1 from public.notifications n where n.family_id = '${bizId}' and n.type = 'plan'
             and n.user_id = '${userA}' and n.title = 'Your trial has ended for ' || v_biz)
        || ';trial_plan=' || s.plan || ';trial_closed=' || s.closed || ';';

  perform public.set_family_plan('${bizId}', now() + interval '1 day', 'manual', null, 'business_plus');
  perform public.end_family_plan('${bizId}');
  perform public.queue_plan_notices();
  select * into s from public.family_storage_status('${bizId}');
  v_out := v_out || 'paid_notice=' || exists (select 1 from public.notifications n where n.family_id = '${bizId}' and n.type = 'plan'
             and n.user_id = '${userA}' and n.title = 'Plus has ended for ' || v_biz)
        || ';paid_closed=' || s.closed
        || ';candidate=' || exists (select 1 from public.plan_cleanup_candidates() c where c.family_id = '${bizId}')
        || ';removal=' || coalesce(public.plan_removal_at('${bizId}')::text, 'none') || ';';
  update public.family_plans set cleanup_until = now() + interval '10 minutes' where family_id = '${bizId}';
  begin
    perform * from public.plan_take_excess('${bizId}');
    v_out := v_out || 'take=ALLOWED;';
  exception when others then
    v_out := v_out || 'take=refused;';
  end;
  select storage_namespace into v_ns from public.families where id = '${bizId}';
  perform set_config('request.jwt.claims', v_as_a, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', '${userA}', true);
  v_out := v_out || 'room=' || public.family_storage_has_room(v_ns) || ';';
  perform set_config('request.jwt.claims', v_service, true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  perform public.set_family_plan('${familyA}', now() + interval '1 day');
  v_out := v_out || 'family_given=' || exists (select 1 from public.notifications n where n.family_id = '${familyA}' and n.type = 'plan'
             and n.user_id = '${userA}' and n.title = v_fam || ' has Family Plus' and n.message like 'Room for % GB of documents, until %') || ';';
  -- 053: on Family Plus the family shares its month; at its number, a
  -- question is refused for the family (the block rolls back, as always).
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'plan_limits' and column_name = 'family_questions_per_month') then
    insert into public.question_usage (user_id, month) values ('${userA}', public.question_month())
      on conflict (user_id, month) do nothing;
    update public.question_usage
       set questions = (select family_questions_per_month from public.plan_limits where plan = 'plus')
     where user_id = '${userA}' and month = public.question_month();
    v_out := v_out || 'family_pool=' || coalesce(public.claim_question('${userA}')->>'reason', 'allowed') || ';';
  else
    v_out := v_out || 'family_pool=none;';
  end if;
  perform public.end_family_plan('${familyA}');
  perform public.queue_plan_notices();
  v_out := v_out || 'family_ended=' || exists (select 1 from public.notifications n where n.family_id = '${familyA}' and n.type = 'plan'
             and n.user_id = '${userA}' and n.title = 'Family Plus has ended for ' || v_fam) || ';';

  begin
    perform public.set_family_plan('${familyA}', now() + interval '1 day', 'manual', null, 'business_plus');
    v_out := v_out || 'family_business=ALLOWED;';
  exception when others then
    v_out := v_out || 'family_business=refused;';
  end;
  begin
    perform public.set_family_plan('${bizId}', now() + interval '1 day', 'razorpay', 'pay_QAQAQAQAQAQAQA');
    v_out := v_out || 'business_family_plus=ALLOWED;';
  exception when others then
    v_out := v_out || 'business_family_plus=refused;';
  end;
  begin
    update public.families set kind = 'business' where created_by = '${userA}' and is_personal;
    v_out := v_out || 'personal_business=' || CASE WHEN FOUND THEN 'ALLOWED' ELSE 'none' END || ';';
  exception when others then
    v_out := v_out || 'personal_business=refused;';
  end;

  -- 054: on Free a person creates one vault in all, so B (on Free, with QA
  -- Vault B) is refused a business; 055: once B is in a family on Family
  -- Plus (QA Vault A, here), it is not on Free and may. Then QA Vault A
  -- becomes a business only once its Family Plus has ended, as its admin, A
  -- (all rolled back, as always).
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'make_business_vault') then
    perform set_config('request.jwt.claims', v_as_b, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '${userB}', true);
    begin
      perform public.create_family('${userB}', 'QA one free vault, business', null, null, false, 'business');
      v_out := v_out || 'b_business=ALLOWED;';
    exception when others then
      get stacked diagnostics v_hint = pg_exception_hint;
      v_out := v_out || 'b_business=' || coalesce(nullif(v_hint, ''), 'other') || ';';
    end;
    perform set_config('request.jwt.claims', v_service, true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform public.set_family_plan('${familyA}', now() + interval '1 day');
    if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'create_family' and p.prosrc like '%v_paid%') then
      insert into public.family_members (family_id, user_id, role) values ('${familyA}', '${userB}', 'viewer')
        on conflict do nothing;
      perform set_config('request.jwt.claims', v_as_b, true);
      perform set_config('request.jwt.claim.role', 'authenticated', true);
      perform set_config('request.jwt.claim.sub', '${userB}', true);
      begin
        perform public.create_family('${userB}', 'QA free business beside Plus', null, null, false, 'business');
        v_out := v_out || 'b_business_on_plus=ok;';
      exception when others then
        get stacked diagnostics v_hint = pg_exception_hint;
        v_out := v_out || 'b_business_on_plus=' || coalesce(nullif(v_hint, ''), 'other:' || replace(left(SQLERRM, 60), ';', ',')) || ';';
      end;
    else
      v_out := v_out || 'b_business_on_plus=none;';
    end if;

    perform set_config('request.jwt.claims', v_as_a, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', '${userA}', true);
    begin
      perform public.make_business_vault('${familyA}');
      v_out := v_out || 'convert_on_plus=ALLOWED;';
    exception when others then
      get stacked diagnostics v_hint = pg_exception_hint;
      v_out := v_out || 'convert_on_plus=' || coalesce(nullif(v_hint, ''), 'other') || ';';
    end;
    perform set_config('request.jwt.claims', v_service, true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
    perform public.end_family_plan('${familyA}');
    perform set_config('request.jwt.claims', v_as_a, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    begin
      perform public.make_business_vault('${familyA}');
      v_out := v_out || 'converted=' || (select kind from public.families where id = '${familyA}')
            || ';converted_plan=' || public.family_plan_now('${familyA}')
            || ';converted_members=' || (select count(*) from public.family_members m where m.family_id = '${familyA}') || ';';
    exception when others then
      v_out := v_out || 'converted=refused:' || replace(left(SQLERRM, 60), ';', ',') || ';';
    end;
    perform set_config('request.jwt.claims', v_service, true);
    perform set_config('request.jwt.claim.role', 'service_role', true);
  else
    v_out := v_out || 'converted=none;';
  end if;

  raise exception 'QA-RESULT %', v_out;
end
$qa$;`;
}

export async function runBusinessChecks(cfg, { a, b, anon, vaultA, vaultB }, results) {
  const check = (id, title, ok, why) => results.add('business', id, title, ok ? 'pass' : 'fail', { why });
  const refused = (id, title, error, extra = '') =>
    check(id, title, refusedByAuth(error), error ? short(error) : `was ALLOWED${extra}`);

  const made = await ensureBusiness(a);
  if (!made.vault) {
    results.add('business', 'business', 'Business vaults (051)', 'skipped', { why: made.why });
    return;
  }
  const biz = made.vault;
  if (made.created) results.note('business', `created ${BUSINESS_A} (${biz.namespace})`);
  const docThere = async (id) => !!(await a.client.rpc('get_document_detail', { p_family_id: biz.id, p_document_id: id })).data?.length;
  const fileThere = async (path) => !(await a.client.storage.from('documents').download(path)).error;
  const memberRole = async (userId) => {
    const { data } = await a.client.from('family_members').select('role').eq('family_id', biz.id).eq('user_id', userId).maybeSingle();
    return data?.role ?? null;
  };

  // A run that died: B is taken out, and anything waiting for B withdrawn.
  if (await memberRole(b.user.id)) {
    await a.client.from('family_members').delete().eq('family_id', biz.id).eq('user_id', b.user.id);
  }
  {
    const { data } = await a.client.from('family_invites').select('id, email').eq('family_id', biz.id);
    for (const i of data ?? []) await a.client.rpc('cancel_family_invite', { p_invite_id: i.id });
  }

  // ── Strangers ──────────────────────────────────────────────────
  {
    const { data, error } = await b.client.rpc('get_family_documents', { p_family_id: biz.id, p_limit: 5, p_offset: 0 });
    check('stranger-documents', "A stranger cannot list a business's records",
      (error && refusedByAuth(error)) || (!error && (data ?? []).length === 0), error ? short(error) : `${(data ?? []).length} rows`);
    const { error: stErr } = await b.client.rpc('family_storage_status', { p_family_id: biz.id });
    refused('stranger-storage', "A stranger cannot read a business's storage or plan", stErr);
    const { data: files } = await b.client.storage.from('documents').list(biz.namespace);
    check('stranger-files', "A stranger sees no file in a business's folder", (files ?? []).length === 0, `${(files ?? []).length} files listed`);
    const { error: anonErr } = await anon.client.rpc('create_family', {
      p_user_id: a.user.id, p_family_name: 'QA anon business', p_kind: 'business',
    });
    refused('anon-create-business', 'A logged-out visitor cannot create a business', anonErr);
  }
  {
    const { error } = await b.client.from('families').update({ kind: 'business' }).eq('id', vaultB.id);
    const { data: back } = await b.client.from('families').select('kind').eq('id', vaultB.id).single();
    check('kind-locked', "No client changes a vault's kind, not even its admin",
      !!error && refusedByAuth(error) && back?.kind === 'family',
      error ? short(error) : `ALLOWED — QA Vault B is now ${back?.kind}`);
    if (!error && back?.kind !== 'family') results.note('business', 'QA Vault B was made a business by a client: put it back by hand (kind = family)');
  }
  {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    const { error } = await b.client.rpc('set_family_plan', {
      p_family_id: vaultB.id, p_paid_until: until, p_source: 'manual', p_source_ref: null, p_plan: 'business_pro',
    });
    refused('client-gives-plan', 'No client gives itself Business Pro', error);
    const { error: insErr } = await b.client.from('family_plans').insert({ family_id: vaultB.id, plan: 'business_pro', paid_until: until });
    refused('client-writes-plan', 'No client writes family_plans', insErr);
    for (const [fn, args] of [
      ['person_plans', { p_user_id: b.user.id }],
      ['is_business_vault', { p_family_id: biz.id }],
      ['business_deletion_plan', { p_user_id: a.user.id, p_family_id: biz.id }],
      ['purge_business', { p_user_id: a.user.id, p_family_id: biz.id, p_confirm_name: BUSINESS_A }],
    ]) {
      const { error: fnErr } = await b.client.rpc(fn, args);
      refused(`client-${fn}`, `Only the server calls ${fn}`, fnErr);
    }
  }
  {
    const r = await invokeFunction(cfg, b, 'delete-account', { action: 'delete_business', family_id: biz.id, confirm_name: BUSINESS_A }, { timeoutMs: 30_000 });
    check('stranger-delete-business', 'A stranger cannot delete a business through delete-account', r.status === 403,
      `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
  }
  {
    const { data: id, error } = await a.client.rpc('create_family', {
      p_user_id: a.user.id, p_family_name: 'QA Business Two', p_kind: 'business',
    });
    check('one-free-business', 'On Free, a person creates one business (a second is refused)',
      !!error && (error.hint === 'family_limit' || /one business/i.test(error.message)), error ? short(error) : 'a SECOND business was made');
    if (id) results.note('business', `a second business, ${id}, was made by A: delete it by hand`);
  }
  {
    // A business is never sold Family Plus: payments refuses before any order is made.
    const r = await invokeFunction(cfg, a, 'payments', { action: 'order', family_id: biz.id, period: 'monthly', time_zone: 'Asia/Kolkata' }, { timeoutMs: 30_000 });
    check('no-family-plus-order', 'The payments function refuses to start Family Plus for a business',
      r.status === 409 && r.data?.status === 'business_plan',
      r.status === 200 ? 'a Family Plus order WAS made for the business (is DEV running an older payments function?)'
        : `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
  }

  // ── B joins as a viewer ────────────────────────────────────────
  const invite = await invokeFunction(cfg, a, 'add-member', { family_id: biz.id, email: cfg.b.email }, { timeoutMs: 30_000 });
  if (invite.data?.status !== 'invited') {
    results.add('business', 'join', 'B is invited to the business', 'fail', { why: `HTTP ${invite.status}: ${JSON.stringify(invite.data).slice(0, 140)}` });
    return;
  }
  const { data: waiting } = await b.client.rpc('get_my_invitations');
  const mine = (waiting ?? []).find((i) => i.family_id === biz.id);
  check('invite-kind', "B's invitation says it is a business", mine?.family_kind === 'business', `family_kind: ${mine?.family_kind}`);
  const { data: joined, error: joinErr } = mine
    ? await b.client.rpc('accept_family_invite', { p_invite_id: mine.id })
    : { data: null, error: { message: 'no invitation found' } };
  if (joinErr || joined?.status !== 'joined') {
    results.add('business', 'join', 'B accepts and joins the business', 'fail', { why: joinErr ? short(joinErr) : JSON.stringify(joined) });
    return;
  }

  const added = [];   // [id, path], deleted again however the checks end
  try {
    // One document each, the way the app adds them.
    const addDoc = async (actor, tag) => {
      const name = `qa_sacrificial_biz_${tag}_${cfg.runId}.pdf`;
      const path = `${biz.namespace}/${name}`;
      const bytes = Buffer.from(`%PDF-1.4\n% AskLocker QA: a SPECIMEN record added by ${tag}\n`);
      const { error: upErr } = await actor.client.storage.from('documents').upload(path, bytes, { contentType: 'application/pdf' });
      if (upErr) throw new Error(`${actor.label} could not upload to ${BUSINESS_A}: ${upErr.message}`);
      const { data: id, error } = await actor.client.rpc('insert_family_document', {
        p_family_id: biz.id, p_uploaded_by: actor.user.id, p_file_name: name, p_file_type: 'pdf',
        p_file_size_bytes: bytes.length, p_storage_path: path,
      });
      if (error) throw new Error(`${actor.label} could not add a record to ${BUSINESS_A}: ${error.message}`);
      added.push([id, path]);
      return [id, path];
    };
    const [aDoc, aPath] = await addDoc(a, 'admin');
    const [bDoc, bPath] = await addDoc(b, 'viewer');

    const { error: viewerErr } = await b.client.rpc('delete_family_document', { p_family_id: biz.id, p_document_id: aDoc, p_user_id: b.user.id });
    check('viewer-cannot-delete-admins', "In a business, a viewer cannot delete an admin's record",
      refusedByAuth(viewerErr) && (await docThere(aDoc)), viewerErr ? short(viewerErr) : 'the record is GONE');
    await b.client.storage.from('documents').remove([aPath]);
    check('viewer-cannot-delete-admins-file', "Nor its file, through Storage", await fileThere(aPath), 'the file is still there');

    const { error: adminErr } = await a.client.rpc('delete_family_document', { p_family_id: biz.id, p_document_id: bDoc, p_user_id: a.user.id });
    await a.client.storage.from('documents').remove([bPath]);
    const rowGone = !(await docThere(bDoc));
    const fileGone = !(await fileThere(bPath));
    check('admin-deletes-any', "In a business, an admin deletes anyone's record, file and all",
      !adminErr && rowGone && fileGone,
      adminErr ? short(adminErr) : !rowGone ? 'the record is still there' : !fileGone ? 'the record went, its FILE stayed' : 'gone, file and all');

    // The last admin stays.
    const { error: leaveErr } = await a.client.from('family_members').delete().eq('family_id', biz.id).eq('user_id', a.user.id);
    const stillIn = (await memberRole(a.user.id)) === 'admin';
    check('last-admin-cannot-leave', "A business's last admin cannot leave",
      stillIn && (!!leaveErr && (leaveErr.hint === 'last_admin' || /last admin/i.test(leaveErr.message))),
      leaveErr ? short(leaveErr) : stillIn ? 'no error, but still in' : 'A LEFT the business');
    if (!stillIn) results.note('business', `A left ${BUSINESS_A}: make A its admin again by hand`);
    const { error: stepErr } = await a.client.from('family_members').update({ role: 'viewer' }).eq('family_id', biz.id).eq('user_id', a.user.id);
    const stillAdmin = (await memberRole(a.user.id)) === 'admin';
    check('last-admin-cannot-step-down', "Nor make themselves a viewer",
      stillAdmin && !!stepErr && (stepErr.hint === 'last_admin' || /last admin/i.test(stepErr.message)),
      stepErr ? short(stepErr) : stillAdmin ? 'no error, but still an admin' : 'A is a VIEWER now');

    // 056: each person's notes, and the overview a plan opens.
    {
      const { data: ov, error: ovErr } = await a.client.rpc('business_overview', { p_family_id: biz.id });
      if (ovErr && String(ovErr.code) === 'PGRST202') {
        for (const [id, title] of [
          ['overview-free', 'On Free, a business overview gives counts, not lists (056)'],
          ['note-free', 'A note in a business on Free; no reminder on it (056)'],
          ['note-private', "A teammate cannot read, change or delete someone's note (056)"],
        ]) results.add('business', id, title, 'skipped', { why: 'migration 056 is not applied to DEV yet' });
      } else {
        check('overview-free', 'On Free, a business overview gives counts, not lists (056)',
          !ovErr && ov?.tier === 'free' && ov?.renewals == null && ov?.money == null && typeof ov?.counts?.documents === 'number',
          ovErr ? short(ovErr) : `tier ${ov?.tier}, ${ov?.counts?.documents} documents`);
        const { data: note, error: noteErr } = await a.client.from('scratch_notes')
          .insert({ family_id: biz.id, body: `QA note ${process.env.GITHUB_RUN_ID ?? 'local'}` }).select('id').single();
        const { error: remindErr } = await a.client.from('scratch_notes')
          .insert({ family_id: biz.id, body: 'QA reminder on Free', remind_on: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10) });
        check('note-free', 'A note in a business on Free; no reminder on it (056)',
          !noteErr && !!note && remindErr?.hint === 'plus_only', noteErr ? short(noteErr) : remindErr ? short(remindErr) : 'a reminder WAS set on Free');
        if (note) {
          const { data: seen } = await b.client.from('scratch_notes').select('id').eq('id', note.id);
          await b.client.from('scratch_notes').update({ body: 'QA intrusion' }).eq('id', note.id);
          await b.client.from('scratch_notes').delete().eq('id', note.id);
          const { data: after } = await a.client.from('scratch_notes').select('body').eq('id', note.id).maybeSingle();
          check('note-private', "A teammate cannot read, change or delete someone's note (056)",
            (seen ?? []).length === 0 && !!after && after.body !== 'QA intrusion',
            `B saw ${(seen ?? []).length}; ${after ? `body "${after.body}"` : 'the note is GONE'}`);
          await a.client.from('scratch_notes').delete().eq('id', note.id);
        }
      }
    }

    const preview = await invokeFunction(cfg, a, 'delete-account', { action: 'preview' }, { timeoutMs: 30_000 });
    const row = (preview.data?.families ?? []).find((f) => f.family_id === biz.id);
    if (preview.status === 200 && row && 'blocked' in row) {
      check('account-blocked', "Deleting the last admin's account is held by the business (preview)",
        row.blocked === true && row.deleted === false, JSON.stringify({ blocked: row.blocked, deleted: row.deleted }));
    } else {
      results.add('business', 'account-blocked', "Deleting the last admin's account is held by the business (preview)", 'skipped',
        { why: preview.status === 200 ? 'the delete-account deployed on DEV is older than 051' : `HTTP ${preview.status}` });
    }
  } finally {
    for (const [id, path] of added) {
      if (await docThere(id)) await a.client.rpc('delete_family_document', { p_family_id: biz.id, p_document_id: id, p_user_id: a.user.id });
      await a.client.storage.from('documents').remove([path]);
    }
    const { error: outErr } = await b.client.from('family_members').delete().eq('family_id', biz.id).eq('user_id', b.user.id);
    const out = !(await memberRole(b.user.id));
    check('viewer-leaves', 'A viewer leaves a business', !outErr && out, outErr ? short(outErr) : out ? 'left' : 'B is STILL in it');
  }

  // ── In the database, rolled back ───────────────────────────────
  if (!cfg.managementToken) {
    results.add('business', 'db', "A business's plan ending, and account deletion, in the database", 'skipped', { why: 'SUPABASE_ACCESS_TOKEN is not set' });
    return;
  }
  const ids = [biz.id, a.user.id, vaultA.id, b.user.id];
  if (!ids.every((id) => UUID.test(String(id)))) {
    results.add('business', 'db', 'Database checks', 'skipped', { why: 'an id is missing' });
    return;
  }
  const [bizId, userA, familyA, userB] = ids;
  const sql = businessDbSql({ bizId, userA, familyA, userB });

  let result;
  try {
    const r = await managementQuery(cfg, sql);
    const m = /QA-RESULT ([^"\\]*)/.exec(r.text);
    if (!m) {
      results.add('business', 'db', "A business's plan ending, in the database", 'inconclusive',
        { why: r.ok ? 'the block did not raise its result' : `HTTP ${r.status}: ${r.text.slice(0, 160)}` });
      return;
    }
    result = Object.fromEntries(m[1].split(';').filter(Boolean).map((kv) => {
      const at = kv.indexOf('=');
      return [kv.slice(0, at), kv.slice(at + 1)];
    }));
  } catch (err) {
    results.add('business', 'db', "A business's plan ending, in the database", 'inconclusive', { why: String(err?.message ?? err) });
    return;
  }
  const said = (k) => `${k}: ${result[k] ?? '—'}`;
  check('db-account', "Deleting the account of a business's last admin is refused", result.account === 'refused', said('account'));
  check('db-trial', 'A trial that ends puts a business back on Free: a notice, not closed',
    result.trial_notice === 'true' && result.trial_plan === 'free' && result.trial_closed === 'false',
    `${said('trial_notice')}, ${said('trial_plan')}, ${said('trial_closed')}`);
  check('db-paid-ends', 'A paid plan that ends: a notice, adding closed, no room',
    result.paid_notice === 'true' && result.paid_closed === 'true' && result.room === 'false',
    `${said('paid_notice')}, ${said('paid_closed')}, ${said('room')}`);
  check('db-nothing-removed', 'Nothing is ever removed from a business: never a clean-up candidate, no removal date, plan_take_excess refuses',
    result.candidate === 'false' && result.removal === 'none' && result.take === 'refused',
    `${said('candidate')}, ${said('removal')}, ${said('take')}`);
  check('db-family-unchanged', "A family's Family Plus starts and ends exactly as before",
    result.family_given === 'true' && result.family_ended === 'true',
    `${said('family_given')}, ${said('family_ended')}`);
  check('db-pro-questions', 'On Pro, a member asks with Pro\'s fair use', result.pro_questions === 'true', said('pro_questions'));
  if (result.family_pool === 'none' || result.family_pool == null) {
    results.add('business', 'db-family-questions', 'Family Plus: a family that has used its month\'s questions is refused (053)', 'skipped',
      { why: 'migration 053 is not applied to DEV yet' });
  } else {
    check('db-family-questions', 'Family Plus: a family that has used its month\'s questions is refused (053)',
      result.family_pool === 'family', said('family_pool'));
  }
  check('db-business-plan-family', 'Business Plus is refused for a family', result.family_business === 'refused', said('family_business'));
  check('db-family-plus-business', 'Family Plus, and a payment naming no plan, is refused for a business',
    result.business_family_plus === 'refused', said('business_family_plus'));
  check('db-personal-business', 'A personal vault cannot be a business', result.personal_business !== 'ALLOWED', said('personal_business'));
  if (result.converted === 'none' || result.converted == null) {
    for (const [id, title] of [
      ['db-convert-on-plus', 'A family vault on Family Plus cannot become a business until Plus ends (054)'],
      ['db-convert', 'Its admin makes a family vault a business: everyone stays, on Free (054)'],
      ['db-one-free-vault', 'On Free, a person creates one vault in all: B, with a free family, is refused a business (054)'],
    ]) results.add('business', id, title, 'skipped', { why: 'migration 054 is not applied to DEV yet' });
  } else {
    check('db-convert-on-plus', 'A family vault on Family Plus cannot become a business until Plus ends (054)',
      result.convert_on_plus === 'plan_active', said('convert_on_plus'));
    check('db-convert', 'Its admin makes a family vault a business: everyone stays, on Free (054)',
      result.converted === 'business' && result.converted_plan === 'free' && Number(result.converted_members) >= 1,
      `${said('converted')}, ${said('converted_plan')}, members ${result.converted_members ?? '—'}`);
    check('db-one-free-vault', 'On Free, a person creates one vault in all: B, with a free family, is refused a business (054)',
      result.b_business === 'family_limit', said('b_business'));
  }
  if (result.overview_pro === 'none' || result.overview_pro == null) {
    for (const [id, title] of [
      ['db-overview-pro', 'On Pro, the overview has money in and out (056)'],
      ['db-note-reminder', 'On a paid plan, a reminder on a note reaches its owner, once (056)'],
    ]) results.add('business', id, title, 'skipped', { why: 'migration 056 is not applied to DEV yet' });
  } else {
    check('db-overview-pro', 'On Pro, the overview has money in and out (056)',
      result.overview_pro === 'pro' && result.overview_money === 'true', `${said('overview_pro')}, ${said('overview_money')}`);
    check('db-note-reminder', 'On a paid plan, a reminder on a note reaches its owner, once (056)',
      Number(result.note_reminders) >= 1 && result.note_notified === 'true', `${said('note_reminders')}, ${said('note_notified')}`);
  }
  if (result.b_business_on_plus === 'none' || result.b_business_on_plus == null) {
    results.add('business', 'db-business-beside-plus', 'Someone in a family on Family Plus creates a free business (055)', 'skipped',
      { why: 'migration 055 is not applied to DEV yet' });
  } else {
    check('db-business-beside-plus', 'Someone in a family on Family Plus creates a free business (055)',
      result.b_business_on_plus === 'ok', said('b_business_on_plus'));
  }
}
