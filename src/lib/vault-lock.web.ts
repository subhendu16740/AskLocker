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
  context, grantVaultKey, importSecretKey, lockTextForPublicKey, newSecretKey, openFile, unlockTextWithPrivateKey, openJson, openVaultKeyGrant, publicIdentity, sealFile,
  sealJson, unwrapSecretKey, wrapSecretKey,
} from '../../supabase/functions/_shared/vault-crypto';
import { chunkText } from '../../supabase/functions/_shared/chunking';
import { extractMetadata } from '../../supabase/functions/_shared/metadata';
import { cleanText } from '../../supabase/functions/_shared/text';
import { MAX_DOCUMENT_TEXT } from '../../supabase/functions/_shared/limits';
import { supabase } from './supabase';
import {
  addSealedPersonRpc, addVaultKeyVersionRpc, deleteVaultItemRpc, fetchLockedVaultIds, fetchMyGrants, fetchPaidBills, fetchSealedDocuments,
  fetchSealedVaultItems, fetchVaultKeyStatus, finishVaultMove, grantVaultKeyRpc, lockVaultRpc, sealExistingDocumentRpc, sealVaultItemRpc,
  sweepSealedDocuments, updateSealedDetailsRpc, type SealedDocumentRow, type VaultItemKind, type VaultKeyMember,
} from './e2e-api';
import { buildGraph, relativesNamedIn, type Gender, type KinLink } from '../../supabase/functions/_shared/kinship';
import { linksAmong } from './tree-rules';
import { parseDocumentDate } from './dates';
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

let locked: { at: number; user: string; ids: Set<string> } | null = null;

/** The locked vaults the signed-in person is in, kept a minute. */
export async function lockedVaults(force = false): Promise<Set<string>> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user.id ?? '';
  if (!force && locked && locked.user === user && Date.now() - locked.at < 60_000) return locked.ids;
  const ids = user ? new Set(await fetchLockedVaultIds()) : new Set<string>();
  locked = { at: Date.now(), user, ids };
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

// Opened vault keys, by person and vault, with the keys that opened them:
// forgotten here, or replaced by new keys, and they are opened afresh.
const vaultKeyCache = new Map<string, { identity: object; keys: Map<number, CryptoKey> }>();

/** Every version of a vault's key this person holds, opened on this device. */
export async function vaultKeys(familyId: string, force = false): Promise<Map<number, CryptoKey>> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const cached = vaultKeyCache.get(`${userId}:${familyId}`);
  if (cached && cached.identity === identity && cached.keys.size && !force) return cached.keys;
  const keys = new Map<number, CryptoKey>();
  for (const g of await fetchMyGrants(familyId)) {
    try {
      keys.set(g.version, await openVaultKeyGrant(g.grant, identity, { vaultId: familyId, userId, keyVersion: g.version }, true));
    } catch {
      // A grant for keys this person had before (a new phone): not theirs to open.
    }
  }
  if (!keys.size) {
    vaultKeyCache.delete(`${userId}:${familyId}`);
    throw new LockedVaultError('no_vault_key', WAITING);
  }
  vaultKeyCache.set(`${userId}:${familyId}`, { identity, keys });
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
  vaultKeyCache.set(`${userId}:${familyId}`, { identity, keys: new Map([[1, vaultKey]]) });
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
    // No keys on this device: the person unlocks them (the caller says so).
    // Keys, but no grant here yet: someone in the vault lets them in.
    if (err instanceof LockedVaultError && err.code === 'no_vault_key') return { waitingForMe: true, needsApproval: [], admin };
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
  // Anything still readable here (a new member's own entry, a note written
  // elsewhere) is sealed now, by whoever may write it (073).
  await moveVaultDetails(familyId, admin).catch(() => undefined);
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
const indexCache = new Map<string, { at: number; passages: IndexedPassage[] }>();
/** Caches are each person's: another account signing in on this page starts afresh. */
let cacheUser = '';
async function forPerson(): Promise<void> {
  const user = await myId();
  if (user !== cacheUser) {
    cacheUser = user;
    detailsCache.clear();
    indexCache.clear();
    itemsCache.clear();
    movedAt.clear();
  }
}

/** The opened details of a locked vault's documents, by document id. */
export async function sealedDetails(familyId: string, force = false): Promise<Map<string, DocumentDetails>> {
  await forPerson();
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

/**
 * A locked vault's rows with their real names, opened here: each document's,
 * and whose it is (073). Other vaults' rows as they are.
 */
export async function overlaySealed<T extends Pick<FamilyDocumentRow, 'id' | 'file_name' | 'ingestion_status'> & Partial<Pick<FamilyDocumentRow, 'belongs_to_member' | 'member_name'>>>(
  familyId: string, rows: T[],
): Promise<T[]> {
  let out = rows;
  if (rows.some((r) => r.ingestion_status === 'sealed')) {
    try {
      let details = await sealedDetails(familyId);
      if (rows.some((r) => r.ingestion_status === 'sealed' && !details.has(r.id))) details = await sealedDetails(familyId, true);
      out = rows.map((r) => (r.ingestion_status === 'sealed' ? { ...r, file_name: details.get(r.id)?.name ?? r.file_name } : r));
    } catch {
      // Not opened here: the rows say "Locked document".
    }
  }
  if (!out.some((r) => r.belongs_to_member) || !(await isLockedVault(familyId).catch(() => false))) return out;
  try {
    const items = await vaultItems(familyId);
    return out.map((r) => {
      const p = r.belongs_to_member ? (items.get(`person:${r.belongs_to_member}`) as SealedPerson | undefined) : undefined;
      return p ? { ...r, member_name: p.name } : r;
    });
  } catch {
    return out;
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

export function forgetVaultIndex(familyId: string): void {
  indexCache.delete(familyId);
}

/** A locked vault's passages, opened here; kept ten minutes. */
export async function vaultIndex(familyId: string): Promise<IndexedPassage[]> {
  await forPerson();
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
  // "Nani's pension": the people a question names by relation, from the
  // asker's place in each vault's tree, opened here (073), join the words.
  const names = new Set<string>();
  for (const id of familyIds) {
    for (const n of await relativesInQuestion(id, question).catch(() => [])) names.add(n);
  }
  const words = names.size ? `${question} ${[...names].join(' ')}` : question;
  return rankPassages(all, vector, words, { limit, perDocument: 4 }).map((p) => ({
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

// ─── Saved chats that quote a locked vault ───────────────────────

/** A saved chat as kept when it quotes a locked vault: sealed for its owner alone. */
export interface SealedChatEnvelope {
  role: 'sealed';
  text: '';
  /** Where it is bound (the context's record id). */
  rid: string;
  sealed: string;
  /** The vaults its answers came from, readable, so 069's rule still holds. */
  sources: { family_id: string }[];
}

export function isSealedChat(messages: unknown): messages is [SealedChatEnvelope] {
  return Array.isArray(messages) && (messages[0] as SealedChatEnvelope | undefined)?.role === 'sealed';
}

/** Seal a chat for its owner: locked with their own public key, opened only on their devices. */
export async function sealChat<M>(title: string, messages: M[], vaultIds: string[]): Promise<[SealedChatEnvelope]> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', 'Unlock your keys on this device to save a chat from a locked vault.');
  const rid = crypto.randomUUID();
  const mine = await publicIdentity(identity);
  const sealed = await lockTextForPublicKey(mine.encrypt, JSON.stringify({ title, messages }), context.personal(userId, 'saved-chat', rid));
  return [{ role: 'sealed', text: '', rid, sealed, sources: [...new Set(vaultIds)].map((family_id) => ({ family_id })) }];
}

export async function openChat<M>(envelope: SealedChatEnvelope): Promise<{ title: string; messages: M[] }> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  return JSON.parse(await unlockTextWithPrivateKey(envelope.sealed, identity.encrypt.privateKey, context.personal(userId, 'saved-chat', envelope.rid)));
}


// ─── A locked vault's name, tree, cards and notes (073) ──────────

/** What the server keeps in their place: a locked vault's name, a person's. */
export const LOCKED_VAULT_NAME = 'Locked vault';
export const LOCKED_PERSON_NAME = 'Person';

/** A person in a locked vault's tree, sealed with the vault's key. */
export interface SealedPerson {
  v: 1;
  name: string;
  gender: Gender;
  birthDate: string | null;
  nickname: string | null;
}

/** An emergency card as save_emergency_card() takes it (032), sealed. */
export type SealedCard = Record<string, unknown> & { contacts?: unknown[] };

// Opened records, by vault, as "<kind>:<item id>".
const itemsCache = new Map<string, Map<string, unknown>>();
const movedAt = new Map<string, number>();

async function vaultItems(familyId: string, force = false): Promise<Map<string, unknown>> {
  await forPerson();
  const cached = itemsCache.get(familyId);
  if (cached && !force) return cached;
  const out = new Map<string, unknown>();
  for (const row of await fetchSealedVaultItems(familyId)) {
    try {
      const key = await vaultKeyFor(familyId, row.key_version);
      out.set(`${row.kind}:${row.item_id}`, await openJson(key, row.sealed, context.record(familyId, row.kind, row.item_id)));
    } catch {
      // Sealed with a key version this person does not hold, or changed: left out.
    }
  }
  itemsCache.set(familyId, out);
  return out;
}

async function sealItem(familyId: string, kind: VaultItemKind, itemId: string, value: unknown): Promise<void> {
  const { version, key } = await latestVaultKey(familyId);
  await sealVaultItemRpc(familyId, kind, itemId, version, await sealJson(key, value, context.record(familyId, kind, itemId)));
  (await vaultItems(familyId)).set(`${kind}:${itemId}`, value);
}

/** Whatever was opened for a vault is opened again next time. */
export function forgetVaultRecords(familyId: string): void {
  itemsCache.delete(familyId);
}

/** A locked vault's real name, opened here, or null. */
export async function lockedVaultName(familyId: string): Promise<string | null> {
  const items = await vaultItems(familyId);
  return (items.get(`vault-name:${familyId}`) as { name?: string } | undefined)?.name ?? null;
}

/** Vaults with their real names where they are locked and opened here; the rest as they are. */
export async function overlayVaultNames<T extends { id: string; name: string }>(vaults: T[]): Promise<T[]> {
  let locked: Set<string>;
  try {
    locked = await lockedVaults();
  } catch {
    return vaults;
  }
  if (!vaults.some((v) => locked.has(v.id))) return vaults;
  return Promise.all(vaults.map(async (v) => {
    if (!locked.has(v.id)) return v;
    const name = await lockedVaultName(v.id).catch(() => null);
    return name ? { ...v, name } : v;
  }));
}

/** Name a locked vault: an admin's, sealed here. */
export async function sealVaultName(familyId: string, name: string): Promise<void> {
  const clean = name.trim();
  if (!clean) throw new LockedVaultError('bad_name', 'Please enter a name.');
  await sealItem(familyId, 'vault-name', familyId, { v: 1, name: clean.slice(0, 120) });
}

/** A locked vault's tree with its people's real details and links, opened here. */
export async function openLockedTree<P extends { id: string; name: string; gender: Gender; birthDate: string | null; nickname?: string | null }>(
  familyId: string, people: P[], links: KinLink[],
): Promise<{ people: P[]; links: KinLink[] }> {
  const items = await vaultItems(familyId);
  const opened = people.map((p) => {
    const s = items.get(`person:${p.id}`) as SealedPerson | undefined;
    return s ? { ...p, name: s.name, gender: s.gender, birthDate: s.birthDate, nickname: s.nickname } : p;
  });
  const sealedLinks = (items.get(`tree-links:${familyId}`) as { links?: KinLink[] } | undefined)?.links ?? [];
  const all = [...sealedLinks];
  for (const l of links) if (!all.some((x) => x.from === l.from && x.to === l.to && x.kind === l.kind)) all.push(l);
  return { people: opened, links: linksAmong(all, opened.map((p) => p.id)) };
}

/** One person's details in a locked vault: an admin, or the person themselves. */
export async function sealPerson(familyId: string, personId: string, details: Omit<SealedPerson, 'v'>): Promise<void> {
  await sealItem(familyId, 'person', personId, { v: 1, ...details });
}

/** Someone new in a locked vault's tree: an admin's. The id is chosen here, since the record is bound to it. */
export async function addSealedPerson(familyId: string, details: Omit<SealedPerson, 'v'>): Promise<string> {
  const id = crypto.randomUUID();
  const { version, key } = await latestVaultKey(familyId);
  const value: SealedPerson = { v: 1, ...details };
  await addSealedPersonRpc(familyId, id, version, await sealJson(key, value, context.record(familyId, 'person', id)));
  (await vaultItems(familyId)).set(`person:${id}`, value);
  return id;
}

/** A locked vault's links, all of them: an admin's. */
export async function sealTreeLinks(familyId: string, links: KinLink[]): Promise<void> {
  await sealItem(familyId, 'tree-links', familyId, { v: 1, links });
}

/** A locked vault's emergency cards, opened here, by person. */
export async function lockedCards(familyId: string): Promise<Map<string, SealedCard>> {
  const items = await vaultItems(familyId);
  const out = new Map<string, SealedCard>();
  for (const [k, v] of items) if (k.startsWith('emergency-card:')) out.set(k.slice('emergency-card:'.length), (v as { card: SealedCard }).card);
  return out;
}

/** Save one person's card in a locked vault, or (null) take it away. An admin, or the person. */
export async function sealCard(familyId: string, personId: string, card: SealedCard | null): Promise<void> {
  if (!card) {
    await deleteVaultItemRpc(familyId, 'emergency-card', personId);
    (await vaultItems(familyId)).delete(`emergency-card:${personId}`);
    return;
  }
  await sealItem(familyId, 'emergency-card', personId, { v: 1, card });
}

const NOTE_FORM = /^n1\.(\d+)\.([0-9a-f-]{36})\.(e1\.[A-Za-z0-9_-]+)$/;

export function isSealedNote(body: string): boolean {
  return NOTE_FORM.test(body);
}

/** A note's text sealed for a locked vault: "n1.<key version>.<id>.<sealed>". */
export async function sealNoteBody(familyId: string, text: string): Promise<string> {
  const { version, key } = await latestVaultKey(familyId);
  const rid = crypto.randomUUID();
  return `n1.${version}.${rid}.${await sealJson(key, { body: text }, context.record(familyId, 'note', rid))}`;
}

/** A note's text, opened here when it is sealed. */
export async function openNoteBody(familyId: string, body: string): Promise<string> {
  const m = body.match(NOTE_FORM);
  if (!m) return body;
  try {
    const key = await vaultKeyFor(familyId, Number(m[1]));
    return (await openJson<{ body: string }>(key, m[3], context.record(familyId, 'note', m[2]))).body;
  } catch {
    return 'This note could not be opened on this device.';
  }
}

/**
 * Seal what a locked vault still holds readable, as far as this person may:
 * an admin its name, its links, everyone's details and cards; anyone their
 * own entry and card, and their own notes. The server blanks each readable
 * copy as it is sealed (073). Kept to once every few minutes a vault.
 */
export async function moveVaultDetails(familyId: string, admin: boolean, force = false): Promise<void> {
  const userId = await myId();
  await forPerson();
  if (!force && Date.now() - (movedAt.get(familyId) ?? 0) < 5 * 60_000) return;
  movedAt.set(familyId, Date.now());
  const items = await vaultItems(familyId, true);
  const db = supabase as any;

  if (admin) {
    const { data: fam } = await db.from('families').select('name').eq('id', familyId).maybeSingle();
    if (fam?.name && fam.name !== LOCKED_VAULT_NAME) await sealVaultName(familyId, fam.name);
  }

  const { data: people } = await db.from('family_people')
    .select('id, user_id, display_name, gender, birth_date, nickname').eq('family_id', familyId);
  const rows = (people ?? []) as { id: string; user_id: string | null; display_name: string; gender: string | null; birth_date: string | null; nickname: string | null }[];
  for (const r of rows) {
    const readable = r.display_name !== LOCKED_PERSON_NAME || r.gender || r.birth_date || r.nickname;
    if (!readable || !(admin || r.user_id === userId)) continue;
    const before = items.get(`person:${r.id}`) as SealedPerson | undefined;
    await sealPerson(familyId, r.id, {
      name: r.display_name !== LOCKED_PERSON_NAME ? r.display_name : before?.name ?? r.display_name,
      gender: r.gender === 'female' || r.gender === 'male' ? r.gender : before?.gender ?? null,
      birthDate: r.birth_date ?? before?.birthDate ?? null,
      nickname: r.nickname ?? before?.nickname ?? null,
    });
  }

  if (admin) {
    const { data: links } = await db.from('family_links').select('from_person, to_person, kind').eq('family_id', familyId);
    const readable = ((links ?? []) as { from_person: string; to_person: string; kind: KinLink['kind'] }[])
      .map((l) => ({ from: l.from_person, to: l.to_person, kind: l.kind }));
    if (readable.length) {
      const sealed = (items.get(`tree-links:${familyId}`) as { links?: KinLink[] } | undefined)?.links ?? [];
      const all = [...sealed];
      for (const l of readable) if (!all.some((x) => x.from === l.from && x.to === l.to && x.kind === l.kind)) all.push(l);
      await sealTreeLinks(familyId, linksAmong(all, rows.map((r) => r.id)));
    }
  }

  const { data: cards } = await db.from('family_emergency_cards').select('*').eq('family_id', familyId);
  const mine = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.id));
  for (const c of (cards ?? []) as Record<string, unknown>[]) {
    const personId = String(c.person_id);
    if (!admin && !mine.has(personId)) continue;
    const { person_id: _p, family_id: _f, updated_by: _b, updated_at: _a, ...card } = c;
    await sealCard(familyId, personId, card as SealedCard);
  }

  const { data: notes } = await db.from('scratch_notes').select('id, body').eq('family_id', familyId);
  for (const n of (notes ?? []) as { id: string; body: string }[]) {
    if (isSealedNote(n.body)) continue;
    await db.from('scratch_notes').update({ body: await sealNoteBody(familyId, n.body) }).eq('id', n.id);
  }
}

/**
 * A locked business's overview, worked out here from the documents it opens,
 * in the shape business_overview() answers (056), as far as `tier` goes.
 */
export async function lockedOverview(
  familyId: string,
  tier: 'free' | 'plus' | 'pro',
  docs: Pick<FamilyDocumentRow, 'id' | 'file_name' | 'category_name' | 'created_at'>[],
): Promise<Record<string, unknown>> {
  const details = await sealedDetails(familyId, true);
  const paid = await fetchPaidBills(familyId).catch(() => new Map<string, string>());
  const today = indiaToday();
  const day = (s: string | null | undefined) => {
    const d = s ? parseDocumentDate(s) : null;
    return d ? Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000) : null;
  };
  const iso = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);
  const meta = (id: string, key: string) => details.get(id)?.meta.find((m) => m.key === key)?.value ?? null;
  const latestExpiry = (id: string) => {
    const d = details.get(id);
    const days = [d?.expiryDate, ...(d?.meta.filter((m) => m.key === 'expiry_date').map((m) => m.value) ?? [])]
      .map(day).filter((n): n is number => n !== null);
    return days.length ? Math.max(...days) : null;
  };
  const live = docs.filter((d) => details.has(d.id));
  const expiries = live.map((d) => ({ d, e: latestExpiry(d.id) })).filter((x): x is { d: typeof live[number]; e: number } => x.e !== null);
  const bills = live.filter((d) => meta(d.id, 'due_date') && !paid.has(d.id));
  const trade = live.filter((d) => d.category_name === 'Sales Invoices' || d.category_name === 'Purchase Bills');
  const out: Record<string, unknown> = {
    tier,
    counts: {
      renewals: expiries.filter((x) => x.e >= today && x.e <= today + 90).length,
      expired: expiries.filter((x) => x.e >= today - 30 && x.e <= today - 1).length,
      bills: bills.length,
      invoices: trade.length,
      documents: docs.length,
    },
    renewals: null,
    bills: null,
    money: null,
  };
  if (tier === 'plus' || tier === 'pro') {
    out.renewals = expiries.filter((x) => x.e >= today - 30 && x.e <= today + 90).sort((a, b) => a.e - b.e).slice(0, 100)
      .map((x) => ({ document_id: x.d.id, file_name: x.d.file_name, category: x.d.category_name, expiry_date: iso(x.e) }));
    out.bills = bills.slice(0, 200).map((d) => ({
      document_id: d.id, file_name: d.file_name, category: d.category_name,
      due_date: meta(d.id, 'due_date'), total_amount: meta(d.id, 'total_amount'), invoice_number: meta(d.id, 'invoice_number'),
    }));
  }
  if (tier === 'pro') {
    out.money = trade.slice(0, 1000).map((d) => ({
      kind: d.category_name === 'Sales Invoices' ? 'in' : 'out',
      invoice_date: meta(d.id, 'invoice_date'), total_amount: meta(d.id, 'total_amount'), created_at: d.created_at,
    }));
  }
  return out;
}

/** The names of the people a question names by relation in a locked vault's tree. */
async function relativesInQuestion(familyId: string, question: string): Promise<string[]> {
  const userId = await myId();
  const db = supabase as any;
  const [{ data: people }, { data: links }] = await Promise.all([
    db.from('family_people').select('id, user_id, display_name, gender, birth_date, nickname').eq('family_id', familyId),
    db.from('family_links').select('from_person, to_person, kind').eq('family_id', familyId),
  ]);
  const rows = ((people ?? []) as { id: string; user_id: string | null; display_name: string; gender: string | null; birth_date: string | null; nickname: string | null }[])
    .map((r) => ({
      id: r.id, userId: r.user_id, name: r.display_name, gender: (r.gender === 'female' || r.gender === 'male' ? r.gender : null) as Gender,
      birthDate: r.birth_date, nickname: r.nickname,
    }));
  const tree = await openLockedTree(familyId, rows,
    ((links ?? []) as { from_person: string; to_person: string; kind: KinLink['kind'] }[]).map((l) => ({ from: l.from_person, to: l.to_person, kind: l.kind })));
  const me = tree.people.find((p) => p.userId === userId)?.id ?? null;
  return relativesNamedIn(buildGraph(tree.people, tree.links), me, question).map((r) => r.name);
}

/** Today in India, as a day number (056 counts days by India's calendar). */
function indiaToday(): number {
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  return Math.round(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) / 86_400_000);
}
