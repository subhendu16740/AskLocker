// ─── FCM: notifications to the Android app, straight to Google (075) ───
//
// The Android app has no browser push service, so a phone there gives a
// Firebase Cloud Messaging registration token, and the push function sends
// to FCM's HTTP v1 API itself, with this project's own Firebase service
// account (the FCM_SERVICE_ACCOUNT secret). No other company's push service
// is in between; Google, which carries every Android notification, sees the
// title and the line, as it does for any app's.
//
// Pure apart from WebCrypto (globalThis.crypto, in Deno and in Node), so the
// QA self-test runs it: the service account read, the OAuth JWT signed, the
// message built and FCM's answer sorted. The push function does the fetches.
// ────────────────────────────────────────────────────────────────

/** The parts of a Google service-account key file FCM needs. */
export interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKeyPem: string;
  tokenUri: string;
}

export const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
export const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
/** The Android channel every reminder goes to (the app makes it, push.ts). */
export const FCM_CHANNEL = 'reminders';

/**
 * The FCM_SERVICE_ACCOUNT secret: the key file Firebase gives, as JSON, or
 * that JSON in base64 (easier to paste into one line). Null when it is
 * missing or not a service account's key.
 */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.startsWith('{') ? text : atob(text));
  } catch {
    return null;
  }
  const o = json as Record<string, unknown>;
  const projectId = typeof o.project_id === 'string' ? o.project_id : '';
  const clientEmail = typeof o.client_email === 'string' ? o.client_email : '';
  const privateKeyPem = typeof o.private_key === 'string' ? o.private_key : '';
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) return null;
  if (!/^[^@\s]+@[^@\s]+$/.test(clientEmail)) return null;
  if (!privateKeyPem.includes('PRIVATE KEY')) return null;
  // Always Google's own token address, whatever the file says: a signed
  // request for an access token is never sent anywhere else.
  return { projectId, clientEmail, privateKeyPem, tokenUri: GOOGLE_TOKEN_URI };
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const utf8 = (s: string) => new TextEncoder().encode(s);

/** The OAuth JWT's claims: this service account asks for FCM, for an hour. */
export function fcmJwtClaims(sa: ServiceAccount, nowSeconds: number) {
  const iat = Math.floor(nowSeconds);
  return { iss: sa.clientEmail, scope: FCM_SCOPE, aud: sa.tokenUri, iat, exp: iat + 3600 };
}

/** header.claims, base64url, as RS256 signs it (RFC 7515). */
export function jwtSigningInput(claims: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT' };
  return `${base64url(utf8(JSON.stringify(header)))}.${base64url(utf8(JSON.stringify(claims)))}`;
}

/** A PEM private key (PKCS #8, as Google's key files hold) as bytes. */
export function pemToPkcs8(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** The signed JWT the token address exchanges for an access token. */
export async function signServiceAccountJwt(sa: ServiceAccount, nowSeconds: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(sa.privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const input = jwtSigningInput(fcmJwtClaims(sa, nowSeconds));
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(input)));
  return `${input}.${base64url(signature)}`;
}

/** The form body for the token address (RFC 7523). */
export function tokenRequestBody(jwt: string): string {
  return new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  }).toString();
}

export const fcmSendUrl = (projectId: string) =>
  `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;

export interface FcmMessage {
  title: string;
  body?: string;
  /** Where a tap opens: an app path. */
  url: string;
  /** A newer notification with the same tag replaces the older one. */
  tag?: string;
}

/**
 * The request body for one device. A notification message, so Android shows
 * it even when AskLocker is closed, on the reminders channel; the data says
 * where a tap goes. Data values are strings, as FCM requires.
 */
export function fcmMessageBody(token: string, m: FcmMessage, ttlSeconds = 86_400) {
  const notification: Record<string, string> = { title: m.title.slice(0, 200) };
  if (m.body) notification.body = m.body.slice(0, 1000);
  const android: Record<string, unknown> = {
    priority: 'HIGH',
    ttl: `${Math.max(0, Math.floor(ttlSeconds))}s`,
    notification: { channel_id: FCM_CHANNEL, ...(m.tag ? { tag: m.tag.slice(0, 64) } : {}) },
  };
  return {
    message: {
      token,
      notification,
      data: { url: m.url, ...(m.tag ? { tag: m.tag.slice(0, 64) } : {}) },
      android,
    },
  };
}

export type FcmOutcome =
  | { ok: true; status: number }
  /**
   * `gone`: FCM says this token no longer reaches an app (uninstalled,
   * expired, or not a token at all): forget it. `transient`: FCM, or our
   * access to it, failed just now: try again within the day.
   */
  | { ok: false; status: number; gone: boolean; transient: boolean; reason: string };

/**
 * Sorts FCM's answer. 404 (UNREGISTERED / NOT_FOUND), and a 400 about the
 * token itself, mean the device is gone. 401 means our access token was
 * refused (refetched next time), and 429 or 5xx a busy FCM: both pass. Any
 * other refusal is about the message, not the device, so the token stays.
 */
export function classifyFcmResponse(status: number, body: unknown): FcmOutcome {
  if (status >= 200 && status < 300) return { ok: true, status };
  const error = (body as { error?: { status?: string; message?: string; details?: unknown[] } } | null)?.error;
  const message = String(error?.message ?? '').slice(0, 160);
  const details = Array.isArray(error?.details) ? error!.details : [];
  const codes = details.map((d) => String((d as { errorCode?: string })?.errorCode ?? ''));
  const fields = details.flatMap((d) =>
    ((d as { fieldViolations?: { field?: string }[] })?.fieldViolations ?? []).map((v) => String(v?.field ?? '')));
  const reason = [error?.status, codes.filter(Boolean).join(','), message].filter(Boolean).join(' ') || `HTTP ${status}`;

  const tokenGone = status === 404
    || codes.includes('UNREGISTERED')
    || (status === 400 && (fields.includes('message.token') || /registration token/i.test(message)));
  if (tokenGone) return { ok: false, status, gone: true, transient: false, reason };
  const transient = status === 0 || status === 401 || status === 429 || status >= 500;
  return { ok: false, status, gone: false, transient, reason };
}

/** An FCM token as 075 stores it: never an address. */
export const isFcmToken = (token: string) =>
  token.length >= 32 && token.length <= 4096 && /^[A-Za-z0-9_:.-]+$/.test(token);
