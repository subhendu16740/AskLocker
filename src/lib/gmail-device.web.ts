// Gmail import for a locked vault, in the browser (docs/end-to-end-encryption.md,
// "Gmail import"). Google gives this page a Gmail permission for an hour
// (Google Identity Services' token client), the page looks through Gmail
// with the server's own rules (_shared/gmail-rules.ts), and each ticked
// attachment is read and sealed here like an upload. AskLocker's server
// never sees the permission, an email or an attachment.
//
// Needs EXPO_PUBLIC_GMAIL_CLIENT_ID (the Gmail project's OAuth client id,
// public like the sign-in one) and this page's address in that client's
// Authorized JavaScript origins.

import {
  SCAN_QUERY, attachmentParts, classifyAttachment, header, sniffType, type GmailPart, type Suggestion,
} from '../../supabase/functions/_shared/gmail-rules';

const CLIENT_ID = (process.env.EXPO_PUBLIC_GMAIL_CLIENT_ID ?? '').replace(/^["']|["']$/g, '').trim();
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export function gmailInBrowserAvailable(): boolean {
  return Boolean(CLIENT_ID) && typeof window !== 'undefined';
}

let gis: Promise<any> | null = null;
function loadGis(): Promise<any> {
  if (!gis) {
    gis = new Promise((resolve, reject) => {
      const g = (window as any).google;
      if (g?.accounts?.oauth2) return resolve(g);
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve((window as any).google);
      s.onerror = () => reject(new Error("Couldn't reach Google. Try again."));
      document.head.appendChild(s);
    });
    gis.catch(() => { gis = null; });
  }
  return gis;
}

/** Google's permission for this page to read Gmail, for an hour. Never stored. */
export async function connectGmailHere(): Promise<string> {
  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r: { access_token?: string; error?: string }) => (r.access_token ? resolve(r.access_token) : reject(new Error('Gmail was not connected.'))),
      error_callback: () => reject(new Error('Gmail was not connected.')),
    });
    client.requestAccessToken();
  });
}

async function get<T>(token: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = `${API}${path}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) throw new Error('Gmail access ended. Connect again.');
  if (!res.ok) throw new Error(`Gmail said no (${res.status}). Try again.`);
  return res.json() as Promise<T>;
}

const partFields = (depth: number): string =>
  `partId,mimeType,filename,headers(name,value),body(size,attachmentId)${depth > 0 ? `,parts(${partFields(depth - 1)})` : ''}`;

export interface FoundHere {
  key: string;
  messageId: string;
  partId: string;
  fileName: string;
  size: number;
  from: string;
  subject: string;
  sentAt: string | null;
  suggestion: Suggestion;
  reason: string;
  category: string | null;
}

/** Attachments that look like documents, in the newest emails with one. */
export async function scanGmailHere(token: string, maxEmails = 75, onProgress?: (done: number) => void): Promise<FoundHere[]> {
  const ids: string[] = [];
  let page: string | undefined;
  while (ids.length < maxEmails) {
    const r = await get<{ messages?: { id: string }[]; nextPageToken?: string }>(token, '/messages', {
      q: SCAN_QUERY, maxResults: String(Math.min(25, maxEmails - ids.length)), fields: 'messages(id),nextPageToken',
      ...(page ? { pageToken: page } : {}),
    });
    ids.push(...(r.messages ?? []).map((m) => m.id));
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  const found: FoundHere[] = [];
  for (let i = 0; i < ids.length; i++) {
    const m = await get<{ id: string; internalDate?: string; labelIds?: string[]; payload?: GmailPart }>(token, `/messages/${ids[i]}`, {
      format: 'full', fields: `id,internalDate,labelIds,payload(${partFields(5)})`,
    });
    const from = header(m.payload?.headers, 'from') ?? '';
    const subject = header(m.payload?.headers, 'subject') ?? '';
    for (const part of attachmentParts(m.payload)) {
      const verdict = classifyAttachment({ fileName: part.fileName, mimeType: part.mimeType, size: part.size, inline: part.inline, from, subject, labelIds: m.labelIds });
      if (!verdict) continue;
      found.push({
        key: `${m.id}/${part.partId}`, messageId: m.id, partId: part.partId, fileName: part.fileName, size: part.size,
        from, subject, sentAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
        suggestion: verdict.suggestion, reason: verdict.reason, category: verdict.category,
      });
    }
    onProgress?.(i + 1);
  }
  const order = { suggested: 0, maybe: 1, unlikely: 2 } as const;
  return found.sort((a, b) => order[a.suggestion] - order[b.suggestion]);
}

/** One attachment's bytes and what it really is, fetched here. */
export async function fetchAttachmentHere(token: string, item: FoundHere): Promise<{ bytes: Uint8Array; kind: 'pdf' | 'jpg' | 'png' }> {
  // The part's attachment id changes on every fetch: look it up again.
  const m = await get<{ payload?: GmailPart }>(token, `/messages/${item.messageId}`, { format: 'full', fields: `payload(${partFields(5)})` });
  const part = attachmentParts(m.payload).find((p) => p.partId === item.partId);
  if (!part) throw new Error('This attachment is no longer in Gmail.');
  const data = await get<{ data?: string }>(token, `/messages/${item.messageId}/attachments/${part.attachmentId}`);
  const b = atob((data.data ?? '').replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  const kind = sniffType(bytes);
  if (!kind) throw new Error("This file isn't really a PDF or a photo.");
  return { bytes, kind };
}
