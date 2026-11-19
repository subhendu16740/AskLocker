// ─── push: reminders on phones and computers (migrations 034, 075) ───
//
// Web Push, free: the browser's own push service carries each message to the
// device, encrypted so that service cannot read it (_shared/webpush.ts).
// The Android app (075) gives an FCM token instead, and this function sends
// to Google's FCM HTTP v1 API itself with the project's Firebase service
// account (FCM_SERVICE_ACCOUNT, _shared/fcm.ts); without that secret those
// devices are skipped and Web Push carries on.
//
//   key   signed in   This project's VAPID public key, for the browser to
//                     subscribe with. The keys are made the first time anyone
//                     asks, and this function leaves its own address in
//                     push_config: that is how run_reminders() finds it.
//   test  signed in   "Reminders are on" to each of the caller's own devices,
//                     browsers and Android phones alike.
//   send  anyone      What is waiting (push_pending) to each owner's devices,
//                     between 8 in the morning and 10 at night, India time.
//                     run_reminders() calls it every hour with the project's
//                     public key, which is in every web bundle, so anyone can
//                     call it. That is safe by construction: it reads nothing
//                     from the request, sends only what is already waiting,
//                     each thing once, to its owner's own devices, never at
//                     night, and a lease keeps runs a minute apart however
//                     often it is called.
//
// Answers 503 { status: 'needs_migration' } where 034 is not applied.
// ────────────────────────────────────────────────────────────────

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { generateVapidKeys, sendWebPush, type PushMessage, type PushOutcome, type VapidKeys } from "../_shared/webpush.ts";
import {
  classifyFcmResponse, fcmMessageBody, fcmSendUrl, isFcmToken, parseServiceAccount, signServiceAccountJwt,
  tokenRequestBody, type FcmOutcome, type ServiceAccount,
} from "../_shared/fcm.ts";

// Who push services may contact about this server (RFC 8292's "sub").
const CONTACT = Deno.env.get("PUSH_CONTACT") || "https://asklocker.com";
const BATCH = 100;          // notifications per send; the next run takes the rest
const QUIET_FROM = 22;      // India time: nothing is sent from 10 at night…
const QUIET_UNTIL = 8;      // …until 8 in the morning (run_reminders() keeps the same hours)
const AT_ONCE = 8;          // pushes in flight together

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "PGRST202" || error.code === "PGRST205" || /could not find the (function|table)/i.test(error.message ?? ""));

const needsMigration = () =>
  json(503, {
    status: "needs_migration",
    error: "Reminders on devices need a database update that has not been applied here yet (migration 034).",
  });

interface KeyRow { public_key: string; private_key: string; contact: string; has_address?: boolean }
const toKeys = (row: KeyRow): VapidKeys => ({ publicKey: row.public_key, privateKey: row.private_key, subject: row.contact });

/** The stored keys, or null when nobody has turned reminders on yet. */
async function storedKeys(supabase: SupabaseClient): Promise<KeyRow | null | "missing"> {
  const { data, error } = await supabase.rpc("push_keys");
  if (isMissing(error)) return "missing";
  if (error) throw new Error(error.message);
  return ((data ?? []) as KeyRow[])[0] ?? null;
}

/**
 * The keys, made on first use, and this function's address left for
 * run_reminders(). push_setup keeps the first keys stored, so two first calls
 * at once agree on one pair.
 */
async function ensureKeys(supabase: SupabaseClient, req: Request): Promise<VapidKeys | "missing"> {
  const row = await storedKeys(supabase);
  if (row === "missing") return "missing";
  // The project's own public key, never one the request sends: the clock
  // calls send with what is kept here.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!anonKey) throw new Error("SUPABASE_ANON_KEY is not set for this function.");
  const candidate = row ? { publicKey: row.public_key, privateKey: row.private_key } : await generateVapidKeys();
  const { data, error } = await supabase.rpc("push_setup", {
    p_vapid_public: candidate.publicKey,
    p_vapid_private: candidate.privateKey,
    p_subject: row?.contact ?? CONTACT,
    p_functions_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1`,
    p_anon_key: anonKey,
  });
  if (error) throw new Error(error.message);
  return toKeys(((data ?? []) as KeyRow[])[0]);
}

/** Run `work` over `items`, a few at a time. */
async function inBatches<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(AT_ONCE, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  });
  await Promise.all(lanes);
  return out;
}

/** One device's result: Web Push's or FCM's, or skipped (FCM not set up here). */
type Outcome = PushOutcome | FcmOutcome | { ok: false; status: 0; gone: false; skipped: true; reason: string };

const isGone = (o: Outcome) => !o.ok && o.gone;
const isSkipped = (o: Outcome) => !o.ok && "skipped" in o;
// A push service that is down or busy, as opposed to a device that is gone.
const transient = (o: Outcome) =>
  !o.ok && !o.gone && ("transient" in o ? o.transient : (o.status === 0 || o.status === 429 || o.status >= 500));

// ─── FCM (075) ──────────────────────────────────────────────────

const FCM_ACCOUNT: ServiceAccount | null = parseServiceAccount(Deno.env.get("FCM_SERVICE_ACCOUNT"));
if (Deno.env.get("FCM_SERVICE_ACCOUNT") && !FCM_ACCOUNT) {
  console.error("[push] FCM_SERVICE_ACCOUNT is set but is not a Firebase service account's key file.");
}
let fcmToken: { value: string; until: number } | null = null;

/** An OAuth access token for FCM, kept in this instance until 5 minutes before it ends. */
async function fcmAccessToken(sa: ServiceAccount): Promise<string> {
  if (fcmToken && fcmToken.until > Date.now() + 5 * 60_000) return fcmToken.value;
  const jwt = await signServiceAccountJwt(sa, Date.now() / 1000);
  const res = await fetch(sa.tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenRequestBody(jwt),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.access_token !== "string") {
    throw new Error(`Google refused the FCM service account (HTTP ${res.status} ${String(body.error ?? "")})`.trim());
  }
  fcmToken = { value: body.access_token, until: Date.now() + Number(body.expires_in ?? 3600) * 1000 };
  return fcmToken.value;
}

const SKIPPED: Outcome = { ok: false, status: 0, gone: false, skipped: true, reason: "FCM is not set up on this project" };

async function sendFcm(token: string, message: PushMessage, ttlSeconds?: number): Promise<Outcome> {
  if (!FCM_ACCOUNT) return SKIPPED;
  if (!isFcmToken(token)) return { ok: false, status: 0, gone: true, transient: false, reason: "not an FCM token" };
  try {
    const access = await fcmAccessToken(FCM_ACCOUNT);
    const res = await fetch(fcmSendUrl(FCM_ACCOUNT.projectId), {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      body: JSON.stringify(fcmMessageBody(token, {
        title: message.title, body: message.body, url: message.url ?? "/notifications", tag: message.tag,
      }, ttlSeconds)),
      signal: AbortSignal.timeout(15_000),
    });
    const outcome = classifyFcmResponse(res.status, await res.json().catch(() => null));
    if (res.status === 401) fcmToken = null;   // fetched afresh next time
    return outcome;
  } catch (err) {
    return { ok: false, status: 0, gone: false, transient: true, reason: (err as Error).message.slice(0, 160) };
  }
}

/** One device, by its kind. */
function sendTo(
  device: { kind: string; endpoint: string; p256dh: string | null; auth: string | null },
  message: PushMessage,
  keys: VapidKeys | null,
  ttlSeconds?: number,
): Promise<Outcome> {
  if (device.kind === "fcm") return sendFcm(device.endpoint, message, ttlSeconds);
  if (!keys) return Promise.resolve(SKIPPED);
  return sendWebPush(
    { endpoint: device.endpoint, p256dh: device.p256dh ?? "", auth: device.auth ?? "" },
    message, keys, ttlSeconds ? { ttlSeconds } : undefined,
  );
}

interface PendingRow {
  notification_id: string;
  kind: string;
  title: string;
  message: string | null;
  document_ref: string | null;
  family_id: string;
  subscription_id: string;
  /** 'webpush' or 'fcm' (push_pending_devices, 075); push_pending's rows are all Web Push. */
  device_kind?: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
}

/** The hour in India (UTC+5:30, no daylight saving). */
const indiaHour = () => new Date(Date.now() + 330 * 60_000).getUTCHours();

async function send(supabase: SupabaseClient): Promise<Response> {
  const hour = indiaHour();
  if (hour >= QUIET_FROM || hour < QUIET_UNTIL) return json(200, { skipped: "quiet hours: it waits for the morning" });

  const { data: claimed, error: leaseErr } = await supabase.rpc("push_claim_send");
  if (isMissing(leaseErr)) return needsMigration();
  if (leaseErr) throw new Error(leaseErr.message);
  if (!claimed) return json(200, { skipped: "a send ran within the last minute" });

  const row = await storedKeys(supabase);
  if (row === "missing") return needsMigration();
  // Web Push needs the keys made when someone first turned it on; an Android
  // phone does not.
  const keys = row ? toKeys(row) : null;

  // Every device with its kind (075); before 075, push_pending's Web Push ones.
  let { data, error } = await supabase.rpc("push_pending_devices", { p_limit: BATCH });
  if (isMissing(error)) ({ data, error } = await supabase.rpc("push_pending", { p_limit: BATCH }));
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as PendingRow[];
  if (!rows.length) return json(200, { notifications: 0, sent: 0 });

  const outcomes = await inBatches(rows, (r) => {
    const message: PushMessage = {
      title: r.title,
      body: r.message ?? undefined,
      url: "/notifications",
      // A newer reminder for the same document replaces the older one on the device.
      tag: `fv-${r.kind}-${r.document_ref ?? r.notification_id}`,
    };
    return sendTo({ kind: r.device_kind ?? "webpush", endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }, message, keys);
  });

  // A notification is done once tried on every device — unless all it met was
  // a push service that was down: then the next run, within the day, tries again.
  // A device skipped (FCM not set up here) counts for neither.
  const byNotification = new Map<string, Outcome[]>();
  rows.forEach((r, i) => byNotification.set(r.notification_id, [...(byNotification.get(r.notification_id) ?? []), outcomes[i]]));
  const done = [...byNotification].filter(([, all]) => {
    const list = all.filter((o) => !isSkipped(o));
    return list.length === 0 || list.some((o) => o.ok) || !list.every(transient);
  }).map(([id]) => id);
  const gone = rows.filter((_, i) => isGone(outcomes[i])).map((r) => r.subscription_id);
  const delivered = rows.filter((_, i) => outcomes[i].ok).map((r) => r.subscription_id);

  const { error: doneErr } = await supabase.rpc("push_done", {
    p_notifications: done,
    p_gone: [...new Set(gone)],
    p_delivered: [...new Set(delivered)],
  });
  if (doneErr) throw new Error(doneErr.message);

  const failed = outcomes.flatMap((o) => (o.ok || isSkipped(o) ? [] : [o]));
  if (failed.length) {
    console.warn("[push] failures:", JSON.stringify(failed.slice(0, 5).map((o) => ({ status: o.status, reason: o.reason }))));
  }
  return json(200, {
    notifications: byNotification.size,
    sent: delivered.length,
    failed: failed.length,
    gone: new Set(gone).size,
    skipped: outcomes.filter(isSkipped).length,
    retry: byNotification.size - done.length,
  });
}

async function test(supabase: SupabaseClient, req: Request, userId: string): Promise<Response> {
  const keys = await ensureKeys(supabase, req);
  if (keys === "missing") return needsMigration();
  // Each device's kind (075); before it, every device is a browser.
  type Device = { id: string; kind?: string; endpoint: string; p256dh: string | null; auth: string | null };
  const read = (columns: string) =>
    supabase.from("push_subscriptions").select(columns).eq("user_id", userId) as unknown as
      Promise<{ data: Device[] | null; error: { code?: string; message?: string } | null }>;
  let { data, error } = await read("id, kind, endpoint, p256dh, auth");
  if (error && /kind/.test(error.message ?? "") && /column|exist/i.test(error.message ?? "")) {
    ({ data, error } = await read("id, endpoint, p256dh, auth"));
  }
  if (isMissing(error)) return needsMigration();
  if (error) throw new Error(error.message);
  const devices = data ?? [];
  if (!devices.length) return json(200, { devices: 0, sent: 0, failed: 0 });

  const outcomes = await inBatches(devices, (d) => sendTo({ ...d, kind: d.kind ?? "webpush" }, {
    title: "Reminders are on",
    body: "This device will hear from AskLocker when a document is about to expire.",
    url: "/settings/notifications",
    tag: "fv-test",
  }, keys, 600));

  const gone = devices.filter((_, i) => isGone(outcomes[i])).map((d) => d.id);
  const delivered = devices.filter((_, i) => outcomes[i].ok).map((d) => d.id);
  await supabase.rpc("push_done", { p_notifications: [], p_gone: gone, p_delivered: delivered });
  return json(200, {
    devices: devices.length,
    sent: delivered.length,
    failed: devices.length - delivered.length,
    gone: gone.length,
    // Status codes only — never an endpoint or token — so a failure can be looked up.
    statuses: outcomes.map((o) => o.status),
    // Android phones are skipped where FCM is not set up (no FCM_SERVICE_ACCOUNT).
    fcm: !!FCM_ACCOUNT,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json().catch(() => ({}));
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "send") return await send(supabase);

    if (action === "key" || action === "test") {
      const auth = await requireUser(req, supabase);
      if (!auth.ok) return auth.response;
      if (action === "test") return await test(supabase, req, auth.userId);
      const keys = await ensureKeys(supabase, req);
      if (keys === "missing") return needsMigration();
      return json(200, { public_key: keys.publicKey });
    }

    return json(400, { error: "action must be key, test or send" });
  } catch (err) {
    console.error("[push]", (err as Error).message);
    return json(500, { error: "Could not reach the reminders service. Please try again." });
  }
});
