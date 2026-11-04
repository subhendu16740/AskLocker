// Locked vaults on this device — the web app's (docs/end-to-end-encryption.md,
// "A vault's key", "A locked document", "Search and Ask", "Moving a vault's
// older documents"). Test builds only.
//
// Everything a locked vault holds is sealed here before it leaves the phone
// and opened here after it arrives: the vault's key (locked for each member
// by grantVaultKey), each document's file key, its file, its details and its
// passages with their search vectors. The server keeps what it cannot open
// (071) and passes the few passages a question needs to the AI service.

import {
  context, grantVaultKey, importSecretKey, newSecretKey, openFile, openJson, openVaultKeyGrant, publicIdentity, sealFile,
  sealJson, unwrapSecretKey, wrapSecretKey,
} from '../../supabase/functions/_shared/vault-crypto';
import { chunkText } from '../../supabase/functions/_shared/chunking';
import { extractMetadata } from '../../supabase/functions/_shared/metadata';
import { cleanText } from '../../supabase/functions/_shared/text';
import { MAX_DOCUMENT_TEXT } from '../../supabase/functions/_shared/limits';
import { supabase } from './supabase';
import {
  addVaultKeyVersionRpc, fetchLockedVaultIds, fetchMyGrants, fetchSealedDocuments, fetchVaultKeyStatus, finishVaultMove,
  grantVaultKeyRpc, lockVaultRpc, sealExistingDocumentRpc, sweepSealedDocuments, updateSealedDetailsRpc,
  type SealedDocumentRow, type VaultKeyMember,
} from './e2e-api';
import { ensureKeys, myDeviceIdentity } from './vault-keys';
import { packVector, rankPassages, unpackVector, type IndexedPassage, type RankedPassage, type SealedPassage } from './local-search';
import { embedQuery, embedTexts } from './on-device-model';
import { readPdfOnDevice } from './on-device-reader';
import { extractTextFromImage, isImageFile } from './ocr';
import { readSpreadsheet, isSpreadsheetType } from './spreadsheet';
import type { FamilyDocumentRow } from './database.types';

export type { RankedPassage };

export class LockedVaultError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const NO_KEYS_HERE = 'Unlock your keys on this device first: Settings › Security › Encryption keys.';
const WAITING = 'Waiting for someone in this vault to open AskLocker and let you in.';

async function myId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new LockedVaultError('signed_out', 'Sign in first.');
  return id;
}

// ─── Which vaults are locked ─────────────────────────────────────

let locked: { at: number; ids: Set<string> } | null = null;

/** The locked vaults the signed-in person is in, kept a minute. */
export async function lockedVaults(force = false): Promise<Set<string>> {
  if (!force && locked && Date.now() - locked.at < 60_000) return locked.ids;
  const ids = new Set(await fetchLockedVaultIds());
  locked = { at: Date.now(), ids };
  return ids;
}

/** Without asking the server: true only once lockedVaults() has said so. */
export function knownLocked(familyId: string): boolean {
  return Boolean(locked?.ids.has(familyId));
}

export async function isLockedVault(familyId: string): Promise<boolean> {
  return (await lockedVaults()).has(familyId);
}

// ─── A vault's keys ──────────────────────────────────────────────

const vaultKeyCache = new Map<string, Map<number, CryptoKey>>();

/** Every version of a vault's key this person holds, opened on this device. */
export async function vaultKeys(familyId: string, force = false): Promise<Map<number, CryptoKey>> {
  const cached = vaultKeyCache.get(familyId);
  if (cached?.size && !force) return cached;
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const keys = new Map<number, CryptoKey>();
  for (const g of await fetchMyGrants(familyId)) {
    try {
      keys.set(g.version, await openVaultKeyGrant(g.grant, identity, { vaultId: familyId, userId, keyVersion: g.version }, true));
    } catch {
      // A grant for keys this person had before (a new phone): not theirs to open.
    }
  }
  if (!keys.size) throw new LockedVaultError('no_vault_key', WAITING);
  vaultKeyCache.set(familyId, keys);
  return keys;
}

async function latestVaultKey(familyId: string): Promise<{ version: number; key: CryptoKey }> {
  const keys = await vaultKeys(familyId);
  const version = Math.max(...keys.keys());
  return { version, key: keys.get(version)! };
}

async function vaultKeyFor(familyId: string, version: number): Promise<CryptoKey> {
  let key = (await vaultKeys(familyId)).get(version);
  if (!key) key = (await vaultKeys(familyId, true)).get(version);
  if (!key) throw new LockedVaultError('no_vault_key', WAITING);
  return key;
}

/** Lock a vault: its owner, once. Their keys are made here first if they have none. */
export async function lockVault(familyId: string): Promise<void> {
  const userId = await myId();
  const state = await ensureKeys(userId);
  if (state.kind !== 'ready') throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const vaultKey = await newSecretKey();
  const grant = await grantVaultKey(vaultKey, await publicIdentity(identity), { vaultId: familyId, userId, keyVersion: 1 });
  await lockVaultRpc(familyId, grant);
  vaultKeyCache.set(familyId, new Map([[1, vaultKey]]));
  await lockedVaults(true);
}

export interface VaultTending {
  /** This person holds no key here yet: someone in the vault must open AskLocker. */
  waitingForMe: boolean;
  /** Members whose keys changed: an admin lets them back in (approveMember). */
  needsApproval: VaultKeyMember[];
  /** This person is an admin of the vault. */
  admin: boolean;
}

/**
 * What every member's app does when it opens a locked vault: lock its key
 * for members who have none, and, for an admin, make a new version after
 * someone left. Nobody taps anything; members whose keys changed wait for an
 * admin's approval.
 */
export async function tendVault(familyId: string): Promise<VaultTending | null> {
  const status = await fetchVaultKeyStatus(familyId);
  if (status === 'unavailable' || !status.locked) return null;
  const userId = await myId();
  const meRow = status.members.find((m) => m.userId === userId);
  const admin = meRow?.role === 'admin';
  let keys: Map<number, CryptoKey>;
  try {
    keys = await vaultKeys(familyId);
  } catch (err) {
    if (err instanceof LockedVaultError) return { waitingForMe: true, needsApproval: [], admin };
    throw err;
  }
  if (status.needsNewKey && admin) {
    const identity = await myDeviceIdentity(userId);
    if (identity) {
      const version = status.latestVersion + 1;
      const fresh = await newSecretKey();
      try {
        await addVaultKeyVersionRpc(familyId, version, await grantVaultKey(fresh, await publicIdentity(identity), { vaultId: familyId, userId, keyVersion: version }));
        keys.set(version, fresh);
      } catch {
        // Another admin's app made it first: picked up next time.
      }
    }
  }
  const needsApproval: VaultKeyMember[] = [];
  for (const m of status.members) {
    if (m.userId === userId || !m.encryptPublic || !m.signPublic || !m.identityVersion) continue;
    if (m.needsApproval) {
      needsApproval.push(m);
      continue;
    }
    await grantMissing(familyId, keys, m);
  }
  return { waitingForMe: false, needsApproval, admin };
}

async function grantMissing(familyId: string, keys: Map<number, CryptoKey>, m: VaultKeyMember): Promise<void> {
  for (const [version, key] of keys) {
    if (m.versions.includes(version)) continue;
    const grant = await grantVaultKey(key, { encrypt: m.encryptPublic!, sign: m.signPublic! }, { vaultId: familyId, userId: m.userId, keyVersion: version });
    await grantVaultKeyRpc(familyId, version, m.userId, m.identityVersion!, grant).catch(() => undefined);
  }
}

/** An admin lets a member whose keys changed back in. */
export async function approveMember(familyId: string, memberId: string): Promise<void> {
  const status = await fetchVaultKeyStatus(familyId);
  if (status === 'unavailable' || !status.locked) return;
  const m = status.members.find((x) => x.userId === memberId);
  if (!m?.encryptPublic || !m.signPublic || !m.identityVersion) return;
  const keys = await vaultKeys(familyId);
  for (const [version, key] of keys) {
    const grant = await grantVaultKey(key, { encrypt: m.encryptPublic, sign: m.signPublic }, { vaultId: familyId, userId: m.userId, keyVersion: version });
    await grantVaultKeyRpc(familyId, version, m.userId, m.identityVersion, grant);
  }
}

// ─── A document's sealed parts ───────────────────────────────────

/** What a locked document's details hold, sealed with its file key. */
export interface DocumentDetails {
  v: 1;
  name: string;
  fileType: string;
  mime: string;
  size: number;
  /** What _shared/metadata.ts found in its text: expiry dates, ID numbers, amounts. */
  meta: { key: string; value: string }[];
  expiryDate: string | null;
  addedAt: string;
}

const HEADER_MAGIC = [0x41, 0x4c, 0x46, 0x31]; // "ALF1"

/** The file with its name and type in front, so whoever opens it knows what it is. */
function packFile(header: { name: string; mime: string; fileType: string }, bytes: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const out = new Uint8Array(8 + json.length + bytes.length);
  out.set(HEADER_MAGIC, 0);
  new DataView(out.buffer).setUint32(4, json.length);
  out.set(json, 8);
  out.set(bytes, 8 + json.length);
  return out;
}

function unpackFile(data: Uint8Array): { header: { name: string; mime: string; fileType: string }; bytes: Uint8Array } {
  if (data.length < 8 || HEADER_MAGIC.some((b, i) => data[i] !== b)) throw new LockedVaultError('bad_file', 'This file could not be read.');
  const len = new DataView(data.buffer, data.byteOffset).getUint32(4);
  const header = JSON.parse(new TextDecoder().decode(data.subarray(8, 8 + len)));
  return { header, bytes: data.subarray(8 + len) };
}

async function fileKeyOf(row: SealedDocumentRow): Promise<CryptoKey> {
  const vaultKey = await vaultKeyFor(row.family_id, row.key_version);
  return unwrapSecretKey(row.file_key, vaultKey, context.fileKey(row.family_id, row.document_id, row.key_version), true);
}

const detailsCache = new Map<string, Map<string, DocumentDetails>>();

/** The opened details of a locked vault's documents, by document id. */
export async function sealedDetails(familyId: string, force = false): Promise<Map<string, DocumentDetails>> {
  const cached = detailsCache.get(familyId);
  if (cached && !force) return cached;
  const out = new Map<string, DocumentDetails>();
  for (const row of await fetchSealedDocuments(familyId)) {
    try {
      const fk = await fileKeyOf(row);
      out.set(row.document_id, await openJson<DocumentDetails>(fk, row.details, context.document(familyId, row.document_id, 'details')));
    } catch {
      // Sealed with a version this person does not hold: stays "Locked document".
    }
  }
  detailsCache.set(familyId, out);
  return out;
}

/** A locked vault's rows with their real names, opened here; other vaults' rows as they are. */
export async function overlaySealed<T extends Pick<FamilyDocumentRow, 'id' | 'file_name' | 'ingestion_status'>>(
  familyId: string, rows: T[],
): Promise<T[]> {
  if (!rows.some((r) => r.ingestion_status === 'sealed')) return rows;
  try {
    const details = await sealedDetails(familyId);
    if (rows.some((r) => r.ingestion_status === 'sealed' && !details.has(r.id))) {
      const fresh = await sealedDetails(familyId, true);
      return rows.map((r) => (r.ingestion_status === 'sealed' ? { ...r, file_name: fresh.get(r.id)?.name ?? r.file_name } : r));
    }
    return rows.map((r) => (r.ingestion_status === 'sealed' ? { ...r, file_name: details.get(r.id)?.name ?? r.file_name } : r));
  } catch {
    return rows;
  }
}

/** One locked document's details, or null. */
export async function documentDetails(familyId: string, documentId: string): Promise<DocumentDetails | null> {
  const map = await sealedDetails(familyId);
  return map.get(documentId) ?? (await sealedDetails(familyId, true)).get(documentId) ?? null;
}

/** A locked document's file, opened here: its bytes, name and type. */
export async function openDocumentFile(familyId: string, documentId: string, storagePath: string): Promise<{ blob: Blob; name: string; mime: string }> {
  const [row] = await fetchSealedDocuments(familyId, { documentIds: [documentId] });
  if (!row) throw new LockedVaultError('not_sealed', 'This document is not locked.');
  const fk = await fileKeyOf(row);
  const { data, error } = await supabase.storage.from('documents').download(storagePath);
  if (error || !data) throw new LockedVaultError('no_file', "Couldn't open the file. Try again.");
  const opened = await openFile(fk, new Uint8Array(await data.arrayBuffer()), context.document(familyId, documentId, 'file'));
  const { header, bytes } = unpackFile(opened);
  return { blob: new Blob([bytes.slice()], { type: header.mime }), name: header.name, mime: header.mime };
}

/** The file key of a locked document, as text: what a share link carries after "#". */
export async function documentFileKeyText(familyId: string, documentId: string): Promise<string> {
  const [row] = await fetchSealedDocuments(familyId, { documentIds: [documentId] });
  if (!row) throw new LockedVaultError('not_sealed', 'This document is not locked.');
  const fk = await fileKeyOf(row);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', fk));
  let b = '';
  for (const x of raw) b += String.fromCharCode(x);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * A shared locked document, opened in the browser of whoever has the link:
 * the file comes sealed, and the key is in the link after "#".
 */
export async function openSharedFile(
  signedUrl: string, vaultId: string, documentId: string, keyText: string,
): Promise<{ blob: Blob; name: string; mime: string; fileType: string }> {
  const res = await fetch(signedUrl);
  if (!res.ok) throw new LockedVaultError('no_file', "Couldn't open this document. Try again.");
  const key = await importSecretKey(keyText);
  const opened = await openFile(key, new Uint8Array(await res.arrayBuffer()), context.document(vaultId, documentId, 'file'));
  const { header, bytes } = unpackFile(opened);
  return { blob: new Blob([bytes.slice()], { type: header.mime }), name: header.name, mime: header.mime, fileType: header.fileType };
}

/** Rename a locked document: its details sealed again, never its name in the clear. */
export async function renameLockedDocument(familyId: string, documentId: string, name: string): Promise<void> {
  const [row] = await fetchSealedDocuments(familyId, { documentIds: [documentId] });
  if (!row) throw new LockedVaultError('not_sealed', 'This document is not locked.');
  const fk = await fileKeyOf(row);
  const where = context.document(familyId, documentId, 'details');
  const details = await openJson<DocumentDetails>(fk, row.details, where);
  await updateSealedDetailsRpc(familyId, documentId, await sealJson(fk, { ...details, name }, where));
  detailsCache.get(familyId)?.set(documentId, { ...details, name });
}

// ─── Reading and sealing a new document ──────────────────────────

export type LockProgress = (stage: 'reading' | 'searching' | 'locking', done: number, total: number) => void;

/** The text of a file, read on this device: photos, PDFs (scans too) and spreadsheets. */
export async function readOnDevice(
  file: { bytes: Uint8Array; fileType: string; name: string; uri?: string },
  languages?: string[],
  onProgress?: LockProgress,
): Promise<string> {
  const type = file.fileType.toLowerCase();
  if (type === 'pdf') {
    const { text } = await readPdfOnDevice(file.bytes, languages, (p) => onProgress?.('reading', p.page, p.pages || 1));
    return text;
  }
  const uri = file.uri ?? URL.createObjectURL(new Blob([file.bytes.slice()]));
  try {
    if (isImageFile(type)) return await extractTextFromImage(uri, undefined, languages);
    if (isSpreadsheetType(type)) return (await readSpreadsheet(uri, file.name, type as 'xlsx' | 'csv')).text;
    return '';
  } finally {
    if (!file.uri) URL.revokeObjectURL(uri);
  }
}

export interface SealedNewDocument {
  documentId: string;
  storagePath: string;
  sealedFile: Uint8Array;
  keyVersion: number;
  fileKey: string;
  details: string;
  passages: string | null;
  passageCount: number;
  expiryDate: string | null;
}

/** Split, find details, make vectors and seal: everything a locked document is, before it leaves. */
export async function sealDocument(p: {
  familyId: string;
  storageNamespace: string;
  documentId?: string;
  fileName: string;
  fileType: string;
  mime: string;
  bytes: Uint8Array;
  text: string;
  onProgress?: LockProgress;
}): Promise<SealedNewDocument> {
  const documentId = p.documentId ?? crypto.randomUUID();
  const { version, key: vaultKey } = await latestVaultKey(p.familyId);
  const fileKey = await newSecretKey();
  const text = cleanText(p.text ?? '').slice(0, MAX_DOCUMENT_TEXT);
  const chunks = text ? chunkText(text) : [];
  p.onProgress?.('searching', 0, chunks.length);
  const vectors = chunks.length ? await embedTexts(chunks.map((c) => c.content), (d, t) => p.onProgress?.('searching', d, t)) : [];
  const passages: SealedPassage[] = chunks.map((c, i) => ({ i: c.chunk_index, t: c.content, v: packVector(vectors[i]) }));
  const meta = text ? extractMetadata(text).map((m) => ({ key: m.key, value: m.value })) : [];
  const expiryDate = meta.find((m) => m.key === 'expiry_date')?.value ?? null;
  const details: DocumentDetails = {
    v: 1, name: p.fileName, fileType: p.fileType, mime: p.mime, size: p.bytes.length, meta, expiryDate,
    addedAt: new Date().toISOString(),
  };
  p.onProgress?.('locking', 0, 1);
  const sealedFile = await sealFile(fileKey, packFile({ name: p.fileName, mime: p.mime, fileType: p.fileType }, p.bytes),
    context.document(p.familyId, documentId, 'file'));
  const out: SealedNewDocument = {
    documentId,
    storagePath: `${p.storageNamespace}/${documentId}.al`,
    sealedFile,
    keyVersion: version,
    fileKey: await wrapSecretKey(fileKey, vaultKey, context.fileKey(p.familyId, documentId, version)),
    details: await sealJson(fileKey, details, context.document(p.familyId, documentId, 'details')),
    passages: passages.length ? await sealJson(fileKey, passages, context.document(p.familyId, documentId, 'passages')) : null,
    passageCount: passages.length,
    expiryDate,
  };
  p.onProgress?.('locking', 1, 1);
  detailsCache.get(p.familyId)?.set(documentId, details);
  forgetVaultIndex(p.familyId);
  return out;
}

/** After a locked document is deleted: its sealed parts go too, and the lists forget it. */
export async function forgetLockedDocument(familyId: string, documentId: string): Promise<void> {
  detailsCache.get(familyId)?.delete(documentId);
  forgetVaultIndex(familyId);
  await sweepSealedDocuments(familyId).catch(() => undefined);
}

// ─── The search index ────────────────────────────────────────────

const indexCache = new Map<string, { at: number; passages: IndexedPassage[] }>();

export function forgetVaultIndex(familyId: string): void {
  indexCache.delete(familyId);
}

/** A locked vault's passages, opened here; kept ten minutes. */
export async function vaultIndex(familyId: string): Promise<IndexedPassage[]> {
  const cached = indexCache.get(familyId);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.passages;
  const out: IndexedPassage[] = [];
  for (const row of await fetchSealedDocuments(familyId, { withPassages: true })) {
    if (!row.passages) continue;
    try {
      const fk = await fileKeyOf(row);
      const [details, passages] = await Promise.all([
        openJson<DocumentDetails>(fk, row.details, context.document(familyId, row.document_id, 'details')),
        openJson<SealedPassage[]>(fk, row.passages, context.document(familyId, row.document_id, 'passages')),
      ]);
      for (const p of passages) {
        out.push({ familyId, documentId: row.document_id, documentName: details.name, index: p.i, text: p.t, vector: unpackVector(p.v) });
      }
    } catch {
      // Not openable by this person: left out of their search.
    }
  }
  indexCache.set(familyId, { at: Date.now(), passages: out });
  return out;
}

/** What the phone sends rag-search for its locked vaults. */
export interface ClientPassage {
  family_id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  score: number;
}

/** The best passages in these locked vaults for a question, found on this device. */
export async function searchLockedVaults(familyIds: string[], question: string, limit = 15): Promise<ClientPassage[]> {
  const all: IndexedPassage[] = [];
  for (const id of familyIds) {
    try {
      all.push(...(await vaultIndex(id)));
    } catch {
      // This person holds no key here yet: nothing of it to search.
    }
  }
  if (!all.length) return [];
  let vector: number[] | null = null;
  try {
    vector = await embedQuery(question);
  } catch {
    vector = null; // the model could not load: words alone
  }
  return rankPassages(all, vector, question, { limit, perDocument: 4 }).map((p) => ({
    family_id: p.familyId,
    document_id: p.documentId,
    document_name: p.documentName,
    chunk_index: p.index,
    content: p.text,
    score: Number(p.score.toFixed(4)),
  }));
}

/** Expiry dates of a locked vault's documents, for Reminders and Home. */
export async function lockedExpiries(familyId: string): Promise<{ documentId: string; name: string; expiryDate: string }[]> {
  const details = await sealedDetails(familyId);
  return [...details.entries()]
    .filter(([, d]) => d.expiryDate)
    .map(([documentId, d]) => ({ documentId, name: d.name, expiryDate: d.expiryDate! }));
}

// ─── Moving a vault's older documents ────────────────────────────

const MIME: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv',
};

export function mimeOf(fileType: string): string {
  return MIME[fileType.toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Lock every older document of a locked vault: read on this device, sealed,
 * uploaded; the server then deletes its readable copies and the app deletes
 * the readable file. Resumable: a document already locked is skipped.
 */
export async function moveOlderDocuments(
  familyId: string,
  storageNamespace: string,
  languages: string[] | undefined,
  onProgress?: (done: number, total: number, name: string) => void,
): Promise<{ moved: number; failed: { name: string; reason: string }[]; left: number }> {
  const { data, error } = await supabase.rpc('get_family_documents', { p_family_id: familyId, p_limit: 1000, p_offset: 0 });
  if (error) throw error;
  const rows = ((data ?? []) as FamilyDocumentRow[]).filter((r) => r.ingestion_status !== 'sealed');
  const failed: { name: string; reason: string }[] = [];
  let moved = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    onProgress?.(i, rows.length, r.file_name);
    try {
      const { data: file, error: dErr } = await supabase.storage.from('documents').download(r.storage_path);
      if (dErr || !file) throw new Error("Couldn't download it.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = await readOnDevice({ bytes, fileType: r.file_type, name: r.file_name }, languages);
      const sealed = await sealDocument({
        familyId, storageNamespace, documentId: r.id, fileName: r.file_name, fileType: r.file_type,
        mime: mimeOf(r.file_type), bytes, text,
      });
      const { error: upErr } = await supabase.storage.from('documents')
        .upload(sealed.storagePath, new Blob([sealed.sealedFile.slice()]), { contentType: mimeOf(r.file_type), upsert: false });
      if (upErr && !/exists/i.test(upErr.message)) throw new Error(upErr.message);
      const oldPath = await sealExistingDocumentRpc({
        familyId, documentId: r.id, storagePath: sealed.storagePath, keyVersion: sealed.keyVersion,
        fileKey: sealed.fileKey, details: sealed.details, passages: sealed.passages, passageCount: sealed.passageCount,
      });
      if (oldPath) await supabase.storage.from('documents').remove([oldPath]);
      moved++;
    } catch (err) {
      failed.push({ name: r.file_name, reason: (err as Error)?.message ?? 'It could not be locked.' });
    }
  }
  onProgress?.(rows.length, rows.length, '');
  const left = await finishVaultMove(familyId).catch(() => rows.length - moved);
  detailsCache.delete(familyId);
  forgetVaultIndex(familyId);
  return { moved, failed, left };
}
