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
  context, grantVaultKey, identityFingerprint, importSecretKey, keyCommitment, keyVersionStatement, newSecretKey, openFile, openJson,
  openText, openVaultKeyGrant, publicIdentity, recordStatement, sealFile, sealJson, sealText, selfKey, signText, unwrapSecretKey,
  verifyText, wrapSecretKey, type Identity, type PublicIdentity,
} from '../../supabase/functions/_shared/vault-crypto';
import { chunkText } from '../../supabase/functions/_shared/chunking';
import { extractMetadata } from '../../supabase/functions/_shared/metadata';
import { cleanText } from '../../supabase/functions/_shared/text';
import { MAX_DOCUMENT_TEXT } from '../../supabase/functions/_shared/limits';
import { supabase } from './supabase';
import {
  addSealedPersonRpc, addVaultKeyVersionRpc, deleteVaultItemRpc, discardMyVaultGrantRpc, fetchLockedVaultIds, fetchMyGrants, fetchPaidBills,
  fetchSealedDocuments, fetchSealedVaultItems, fetchVaultKeyStatus, fetchVaultKeyVersions, finishVaultMove, grantVaultKeyRpc, lockVaultRpc,
  sealExistingDocumentRpc, sealVaultItemRpc, sweepSealedDocuments, updateSealedDetailsRpc, type SealedDocumentRow, type VaultItemKind,
  type VaultKeyMember, type VaultKeyStatus,
} from './e2e-api';
import { accountKey, storageGet, storageSet } from './storage';
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

// ─── Whom this device trusts, and the newest it has seen ─────────
//
// The server lists each member's public keys; it could list its own instead
// (docs/end-to-end-encryption.md, "Limits that stay true"). So this device
// remembers the key ID it first saw for each person and, after that, takes a
// different one only when an admin it trusts let it in (a signed member-key
// record), or the person here says so after comparing key IDs. It also
// remembers the newest version of each vault's key and of each record it
// has opened, so the server cannot hand it an older one.

type TrustStore = Record<string, string[]>;
interface SeenStore {
  /** Newest key version, by vault. */
  v: Record<string, number>;
  /** Newest time of each record, by "<vault>:<kind>:<item>". */
  r: Record<string, number>;
  /** The members of each vault when its newest version was seen, for knowing a new one is due. */
  m: Record<string, { version: number; members: string[] }>;
  /** Vaults whose readable name, links and cards this device has moved already. */
  d: Record<string, true>;
}

async function readStore<T>(key: string, empty: T): Promise<T> {
  try {
    const raw = await storageGet(key);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

async function trustStore(userId: string): Promise<TrustStore> {
  return readStore<TrustStore>(accountKey.keyTrust(userId), {});
}

async function trustKey(userId: string, personId: string, keyId: string): Promise<void> {
  const store = await trustStore(userId);
  const list = store[personId] ?? [];
  if (list.includes(keyId)) return;
  store[personId] = [...list, keyId].slice(-10);
  await storageSet(accountKey.keyTrust(userId), JSON.stringify(store)).catch(() => undefined);
}

/** 'trusted', 'new' (never seen this person here) or 'changed' (seen with other keys). */
function trustOf(store: TrustStore, personId: string, keyId: string): 'trusted' | 'new' | 'changed' {
  const list = store[personId];
  if (!list?.length) return 'new';
  return list.includes(keyId) ? 'trusted' : 'changed';
}

const emptySeen = (): SeenStore => ({ v: {}, r: {}, m: {}, d: {} });

async function seenStore(userId: string): Promise<SeenStore> {
  return readStore<SeenStore>(accountKey.keySeen(userId), emptySeen());
}

async function updateSeen(userId: string, change: (s: SeenStore) => void): Promise<void> {
  const store = await seenStore(userId);
  change(store);
  await storageSet(accountKey.keySeen(userId), JSON.stringify(store)).catch(() => undefined);
}

/** A person's key ID, worked out here from their public keys, never taken from the server. */
async function keyIdOf(pub: { encrypt: string | null; sign: string | null }): Promise<string | null> {
  if (!pub.encrypt || !pub.sign) return null;
  try {
    return await identityFingerprint({ encrypt: pub.encrypt, sign: pub.sign });
  } catch {
    return null;
  }
}

async function myKeyId(identity: Identity): Promise<string> {
  return identityFingerprint(await publicIdentity(identity));
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
const vaultKeyCache = new Map<string, { identity: object; keys: Map<number, CryptoKey>; serverLatest: number }>();

/**
 * Whether a version of a vault's key is the one its maker made: the key opened
 * matches the commitment they signed, and their signature is good, from keys
 * this device trusts for them (or first sees now).
 */
async function versionIsGood(
  familyId: string, key: CryptoKey, row: Awaited<ReturnType<typeof fetchVaultKeyVersions>>[number], userId: string, trust: TrustStore,
): Promise<'good' | 'wrong_key' | 'bad'> {
  if (!row.commitment || !row.signature || !row.makerId || !row.makerEncryptPublic || !row.makerSignPublic) return 'bad';
  if ((await keyCommitment(key, familyId, row.version)) !== row.commitment) return 'wrong_key';
  const makerKeyId = await keyIdOf({ encrypt: row.makerEncryptPublic, sign: row.makerSignPublic });
  if (!makerKeyId) return 'bad';
  const statement = keyVersionStatement(familyId, row.version, row.commitment, row.makerId, makerKeyId);
  if (!(await verifyText(row.makerSignPublic, statement, row.signature))) return 'bad';
  const state = trustOf(trust, row.makerId, makerKeyId);
  if (state === 'changed') return 'bad';
  if (state === 'new') await trustKey(userId, row.makerId, makerKeyId);
  return 'good';
}

/** Every version of a vault's key this person holds, opened and checked on this device. */
export async function vaultKeys(familyId: string, force = false): Promise<Map<number, CryptoKey>> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const cached = vaultKeyCache.get(`${userId}:${familyId}`);
  if (cached && cached.identity === identity && cached.keys.size && !force) return cached.keys;
  const [grants, versions] = await Promise.all([fetchMyGrants(familyId), fetchVaultKeyVersions(familyId)]);
  const rows = new Map(versions.map((v) => [v.version, v]));
  await trustKey(userId, userId, await myKeyId(identity));
  let trust = await trustStore(userId);
  const keys = new Map<number, CryptoKey>();
  for (const g of grants) {
    let key: CryptoKey;
    try {
      key = await openVaultKeyGrant(g.grant, identity, { vaultId: familyId, userId, keyVersion: g.version }, true);
    } catch {
      continue; // a grant for keys this person had before (a new phone): not theirs to open
    }
    const row = rows.get(g.version);
    const check = row ? await versionIsGood(familyId, key, row, userId, trust) : 'bad';
    if (check === 'good') {
      keys.set(g.version, key);
      trust = await trustStore(userId);
    } else if (check === 'wrong_key') {
      // Not the key this version's maker made (planted, or made up): thrown
      // away, so an honest member's app can lock the right one.
      await discardMyVaultGrantRpc(familyId, g.version).catch(() => undefined);
    }
  }
  const serverLatest = versions.length ? Math.max(...versions.map((v) => v.version)) : 0;
  if (!keys.size) {
    vaultKeyCache.delete(`${userId}:${familyId}`);
    throw new LockedVaultError('no_vault_key', WAITING);
  }
  vaultKeyCache.set(`${userId}:${familyId}`, { identity, keys, serverLatest });
  return keys;
}

/**
 * The version everything new is sealed with: the vault's newest, which this
 * person must hold (074 refuses older ones, so someone who left cannot open
 * what comes after), and never older than the newest this device has seen.
 */
async function latestVaultKey(familyId: string): Promise<{ version: number; key: CryptoKey }> {
  const userId = await myId();
  let keys = await vaultKeys(familyId);
  let serverLatest = vaultKeyCache.get(`${userId}:${familyId}`)?.serverLatest ?? 0;
  let version = Math.max(...keys.keys());
  if (version < serverLatest) {
    keys = await vaultKeys(familyId, true);
    serverLatest = vaultKeyCache.get(`${userId}:${familyId}`)?.serverLatest ?? 0;
    version = Math.max(...keys.keys());
  }
  const seen = (await seenStore(userId)).v[familyId] ?? 0;
  if (Math.max(serverLatest, version) < seen) {
    throw new LockedVaultError('rolled_back', "This vault's key looks older than before. Try again later.");
  }
  if (version < serverLatest) throw new LockedVaultError('no_vault_key', WAITING);
  if (version > seen) await updateSeen(userId, (st) => { st.v[familyId] = version; });
  return { version, key: keys.get(version)! };
}

/** A new version of a vault's key, signed by its maker with a commitment to it. */
async function signedVersion(familyId: string, version: number, userId: string, identity: Identity, key: CryptoKey) {
  const commitment = await keyCommitment(key, familyId, version);
  const signature = await signText(identity, keyVersionStatement(familyId, version, commitment, userId, await myKeyId(identity)));
  return { commitment, signature };
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
  const { commitment, signature } = await signedVersion(familyId, 1, userId, identity, vaultKey);
  await lockVaultRpc(familyId, grant, commitment, signature);
  await trustKey(userId, userId, await myKeyId(identity));
  vaultKeyCache.set(`${userId}:${familyId}`, { identity, keys: new Map([[1, vaultKey]]), serverLatest: 1 });
  await updateSeen(userId, (st) => { st.v[familyId] = 1; });
  await lockedVaults(true);
}

/** Someone whose keys this device has not been told are theirs: an admin lets them in, or anyone here trusts them after comparing. */
export interface KeysToCheck {
  member: VaultKeyMember;
  /** Their key ID, worked out here: compare it with the one on their Encryption keys screen. */
  keyId: string;
  /** The server says their keys changed (a new phone), as well as this device. */
  serverSaysChanged: boolean;
}

export interface VaultTending {
  /** This person holds no key here yet: someone in the vault must open AskLocker. */
  waitingForMe: boolean;
  /** Members whose keys need checking: an admin lets them in (approveMember), anyone may trust them here (trustMember). */
  needsApproval: KeysToCheck[];
  /** This person is an admin of the vault. */
  admin: boolean;
  /** How many of this person's own older documents here are still readable (they lock them themselves, 074). */
  myReadable: number;
}

/** A member-key record an admin this device trusts signed for this key ID. */
async function vouchedFor(familyId: string, m: VaultKeyMember, keyId: string): Promise<boolean> {
  const items = await vaultItems(familyId).catch(() => null);
  const rec = items?.get(`member-key:${m.userId}`) as { fingerprint?: string } | undefined;
  return rec?.fingerprint === keyId;
}

/**
 * What every member's app does when it opens a locked vault: lock its key
 * for members who have none, and, for an admin, make a new version after
 * someone left. Nobody taps anything; a member whose keys this device has
 * not been told are theirs waits for an admin, or for someone here to check.
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
    if (err instanceof LockedVaultError && err.code === 'no_vault_key') return { waitingForMe: true, needsApproval: [], admin, myReadable: 0 };
    throw err;
  }
  const seen = await seenStore(userId);
  const roster = seen.m[familyId];
  const someoneLeft = !!roster && roster.version === status.latestVersion
    && roster.members.some((id) => !status.members.some((m) => m.userId === id));
  if ((status.needsNewKey || someoneLeft) && admin) {
    const identity = await myDeviceIdentity(userId);
    if (identity) {
      const version = status.latestVersion + 1;
      const fresh = await newSecretKey();
      try {
        const { commitment, signature } = await signedVersion(familyId, version, userId, identity, fresh);
        await addVaultKeyVersionRpc(familyId, version,
          await grantVaultKey(fresh, await publicIdentity(identity), { vaultId: familyId, userId, keyVersion: version }), commitment, signature);
        keys.set(version, fresh);
        status.latestVersion = version;
        await updateSeen(userId, (st) => { st.v[familyId] = version; });
      } catch {
        // Another admin's app made it first: picked up next time.
      }
    }
  }
  const trust = await trustStore(userId);
  const needsApproval: KeysToCheck[] = [];
  for (const m of status.members) {
    if (m.userId === userId || !m.encryptPublic || !m.signPublic || !m.identityVersion) continue;
    const keyId = await keyIdOf({ encrypt: m.encryptPublic, sign: m.signPublic });
    if (!keyId || (m.fingerprint && m.fingerprint !== keyId)) continue; // not keys at all, or not what they claim
    let state = trustOf(trust, m.userId, keyId);
    if (state === 'changed' && (await vouchedFor(familyId, m, keyId))) {
      await trustKey(userId, m.userId, keyId);
      state = 'trusted';
    }
    if (state === 'changed' || (state === 'new' && m.needsApproval)) {
      needsApproval.push({ member: m, keyId, serverSaysChanged: m.needsApproval });
      continue;
    }
    if (state === 'new') await trustKey(userId, m.userId, keyId);
    if (m.needsApproval && !admin) continue; // only an admin's app locks it for changed keys
    await grantMissing(familyId, keys, m);
  }
  if (status.latestVersion) {
    await updateSeen(userId, (st) => { st.m[familyId] = { version: status.latestVersion, members: status.members.map((m) => m.userId) }; });
  }
  // Anything still readable here (a new member's own entry, a note written
  // elsewhere) is sealed now, by whoever may write it (073); sealed parts of
  // documents that are gone go too.
  await moveVaultDetails(familyId, admin, false, status).catch(() => undefined);
  return { waitingForMe: false, needsApproval, admin, myReadable: await myReadableCount(familyId, userId).catch(() => 0) };
}

async function grantMissing(familyId: string, keys: Map<number, CryptoKey>, m: VaultKeyMember): Promise<void> {
  for (const [version, key] of keys) {
    if (m.versions.includes(version)) continue;
    const grant = await grantVaultKey(key, { encrypt: m.encryptPublic!, sign: m.signPublic! }, { vaultId: familyId, userId: m.userId, keyVersion: version });
    await grantVaultKeyRpc(familyId, version, m.userId, m.identityVersion!, grant).catch(() => undefined);
  }
}

/**
 * An admin lets a member whose keys changed back in: this device trusts their
 * new key ID, records that it let them in (signed, so the other members'
 * apps trust it too), and locks every version for them.
 */
export async function approveMember(familyId: string, memberId: string): Promise<void> {
  const status = await fetchVaultKeyStatus(familyId);
  if (status === 'unavailable' || !status.locked) return;
  const userId = await myId();
  const m = status.members.find((x) => x.userId === memberId);
  if (!m?.encryptPublic || !m.signPublic || !m.identityVersion) return;
  const keyId = await keyIdOf({ encrypt: m.encryptPublic, sign: m.signPublic });
  if (!keyId) return;
  await trustKey(userId, memberId, keyId);
  await sealItem(familyId, 'member-key', memberId, { v: 1, user: memberId, fingerprint: keyId, identityVersion: m.identityVersion });
  const keys = await vaultKeys(familyId);
  for (const [version, key] of keys) {
    const grant = await grantVaultKey(key, { encrypt: m.encryptPublic, sign: m.signPublic }, { vaultId: familyId, userId: m.userId, keyVersion: version });
    await grantVaultKeyRpc(familyId, version, m.userId, m.identityVersion, grant);
  }
}

/** Anyone in the vault trusts a member's new keys on this device, after comparing key IDs with them. */
export async function trustMember(familyId: string, memberId: string): Promise<void> {
  const status = await fetchVaultKeyStatus(familyId);
  if (status === 'unavailable' || !status.locked) return;
  const m = status.members.find((x) => x.userId === memberId);
  const keyId = m ? await keyIdOf({ encrypt: m.encryptPublic, sign: m.signPublic }) : null;
  if (!m || !keyId) return;
  await trustKey(await myId(), memberId, keyId);
  if (!m.needsApproval) await grantMissing(familyId, await vaultKeys(familyId), m).catch(() => undefined);
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
  /** Whose it is and what it is filed under, sealed (074): the row keeps only a built-in category. */
  belongsTo?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

/**
 * The type a locked file is opened as: from a short list, never the type
 * written inside it, so a file cannot pass itself off as a web page in
 * AskLocker's own address. Spreadsheets and anything else are downloads.
 */
const SAFE_MIME: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png' };
export function safeMime(fileType: string | null | undefined): string {
  return SAFE_MIME[(fileType ?? '').toLowerCase()] ?? 'application/octet-stream';
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
    itemWriters.clear();
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
 * whose it is and what it is filed under (073, 074). Other vaults' rows as
 * they are.
 */
export async function overlaySealed<T extends Pick<FamilyDocumentRow, 'id' | 'file_name' | 'ingestion_status'> & Partial<Pick<FamilyDocumentRow, 'belongs_to_member' | 'member_name' | 'category_id' | 'category_name'>>>(
  familyId: string, rows: T[],
): Promise<T[]> {
  let out = rows;
  if (rows.some((r) => r.ingestion_status === 'sealed')) {
    try {
      let details = await sealedDetails(familyId);
      if (rows.some((r) => r.ingestion_status === 'sealed' && !details.has(r.id))) details = await sealedDetails(familyId, true);
      out = rows.map((r) => {
        const d = r.ingestion_status === 'sealed' ? details.get(r.id) : undefined;
        if (!d) return r;
        return {
          ...r,
          file_name: d.name,
          ...(d.belongsTo !== undefined ? { belongs_to_member: d.belongsTo } : {}),
          ...(d.categoryId ? { category_id: d.categoryId, category_name: d.categoryName ?? r.category_name } : {}),
        };
      });
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
  const mime = safeMime(header.fileType);
  return { blob: new Blob([bytes.slice()], { type: mime }), name: header.name, mime };
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
  const mime = safeMime(header.fileType);
  return { blob: new Blob([bytes.slice()], { type: mime }), name: header.name, mime, fileType: header.fileType };
}

/** Change a locked document's name, whose it is or its category: its details sealed again, never in the clear. */
export async function updateLockedDocument(
  familyId: string, documentId: string,
  change: { name?: string; belongsTo?: string | null; categoryId?: string | null; categoryName?: string | null },
): Promise<void> {
  const [row] = await fetchSealedDocuments(familyId, { documentIds: [documentId] });
  if (!row) throw new LockedVaultError('not_sealed', 'This document is not locked.');
  const fk = await fileKeyOf(row);
  const where = context.document(familyId, documentId, 'details');
  const details = await openJson<DocumentDetails>(fk, row.details, where);
  const next: DocumentDetails = { ...details };
  if (change.name !== undefined) next.name = change.name;
  if (change.belongsTo !== undefined) next.belongsTo = change.belongsTo;
  if (change.categoryId !== undefined) {
    next.categoryId = change.categoryId;
    next.categoryName = change.categoryName ?? null;
  }
  await updateSealedDetailsRpc(familyId, documentId, await sealJson(fk, next, where));
  detailsCache.get(familyId)?.set(documentId, next);
}

/** Rename a locked document: its details sealed again, never its name in the clear. */
export async function renameLockedDocument(familyId: string, documentId: string, name: string): Promise<void> {
  await updateLockedDocument(familyId, documentId, { name });
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
  belongsTo?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
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
    belongsTo: p.belongsTo ?? null, categoryId: p.categoryId ?? null, categoryName: p.categoryName ?? null,
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
 * The older, readable documents in a locked vault that this person may lock:
 * the ones they added (074: in a family nobody else locks them, admins
 * included, as nobody else deletes them, 047), and in a business, as an
 * admin, everyone's (051).
 */
async function myReadableDocuments(familyId: string): Promise<FamilyDocumentRow[]> {
  const userId = await myId();
  const { data, error } = await supabase.rpc('get_family_documents', { p_family_id: familyId, p_limit: 1000, p_offset: 0 });
  if (error) throw error;
  const rows = ((data ?? []) as FamilyDocumentRow[]).filter((r) => r.ingestion_status !== 'sealed');
  let businessAdmin = false;
  if (rows.some((r) => r.uploaded_by !== userId)) {
    const db = supabase as any;
    const [{ data: fam }, { data: me }] = await Promise.all([
      db.from('families').select('kind').eq('id', familyId).maybeSingle(),
      db.from('family_members').select('role').eq('family_id', familyId).eq('user_id', userId).maybeSingle(),
    ]);
    businessAdmin = fam?.kind === 'business' && me?.role === 'admin';
  }
  return businessAdmin ? rows : rows.filter((r) => r.uploaded_by === userId);
}

const readableCounts = new Map<string, { at: number; n: number }>();

/** How many of those there are, kept five minutes. */
async function myReadableCount(familyId: string, _userId: string): Promise<number> {
  const kept = readableCounts.get(familyId);
  if (kept && Date.now() - kept.at < 5 * 60_000) return kept.n;
  const n = (await myReadableDocuments(familyId)).length;
  readableCounts.set(familyId, { at: Date.now(), n });
  return n;
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
  const rows = await myReadableDocuments(familyId);
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
        belongsTo: r.belongs_to_member ?? null, categoryId: r.category_id ?? null, categoryName: r.category_name ?? null,
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
  readableCounts.delete(familyId);
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

// A person's own key (ECDH of their own key pair): only they can seal or
// open with it, so nobody else can read their notes and chats, or make one
// that opens as theirs. Worked out once a visit.
const selfKeys = new WeakMap<Identity, CryptoKey>();
async function myOwnKey(): Promise<{ userId: string; key: CryptoKey }> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  let key = selfKeys.get(identity);
  if (!key) {
    key = await selfKey(identity, userId);
    selfKeys.set(identity, key);
  }
  return { userId, key };
}

/** Seal a chat for its owner: with their own key, opened only on their devices. */
export async function sealChat<M>(title: string, messages: M[], vaultIds: string[]): Promise<[SealedChatEnvelope]> {
  const { userId, key } = await myOwnKey().catch(() => {
    throw new LockedVaultError('no_keys_here', 'Unlock your keys on this device to save a chat from a locked vault.');
  });
  const rid = crypto.randomUUID();
  const sealed = await sealText(key, JSON.stringify({ title, messages }), context.personal(userId, 'saved-chat', rid));
  return [{ role: 'sealed', text: '', rid, sealed, sources: [...new Set(vaultIds)].map((family_id) => ({ family_id })) }];
}

export async function openChat<M>(envelope: SealedChatEnvelope): Promise<{ title: string; messages: M[] }> {
  const { userId, key } = await myOwnKey();
  return JSON.parse(await openText(key, envelope.sealed, context.personal(userId, 'saved-chat', envelope.rid)));
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

/**
 * A record as sealed (074): who wrote it, with their public keys, when, the
 * record itself as text, and their signature over all of it and where it
 * belongs. Inside the seal, so only members see who wrote what.
 */
interface SignedRecord {
  v: 2;
  by: string;
  keys: PublicIdentity;
  at: number;
  d: string;
  sig: string;
}

async function signedRecord(ctx: string, value: unknown): Promise<SignedRecord> {
  const userId = await myId();
  const identity = await myDeviceIdentity(userId);
  if (!identity) throw new LockedVaultError('no_keys_here', NO_KEYS_HERE);
  const d = JSON.stringify(value);
  const at = Date.now();
  return { v: 2, by: userId, keys: await publicIdentity(identity), at, d, sig: await signText(identity, await recordStatement(ctx, at, userId, d)) };
}

/**
 * Who may write each kind of record: an admin, or for a person or a card the
 * person themselves (031, 032). Someone who has left: only if this device
 * knew their keys while they were in (an admin's app signs their records
 * again, moveVaultDetails), never an account it has not seen.
 */
function mayWrite(kind: VaultItemKind, writer: string, roles: Map<string, string>, personUser: string | null, knownBefore: boolean): boolean {
  const role = roles.get(writer);
  if (role === undefined) return knownBefore;
  if (role === 'admin') return true;
  return (kind === 'person' || kind === 'emergency-card') && personUser === writer;
}

// Who wrote each record opened here, by vault, so an admin's app can sign
// again what someone who has left wrote.
const itemWriters = new Map<string, Map<string, string>>();

async function vaultItems(familyId: string, force = false): Promise<Map<string, unknown>> {
  await forPerson();
  const cached = itemsCache.get(familyId);
  if (cached && !force) return cached;
  const userId = await myId();
  const [rows, status, people] = await Promise.all([
    fetchSealedVaultItems(familyId),
    fetchVaultKeyStatus(familyId).catch(() => 'unavailable' as const),
    (async () => {
      const { data } = await (supabase as any).from('family_people').select('id, user_id').eq('family_id', familyId);
      return (data ?? []) as { id: string; user_id: string | null }[];
    })(),
  ]);
  const members = status === 'unavailable' ? [] : status.members;
  const roles = new Map(members.map((m) => [m.userId, m.role]));
  const personUser = new Map((people as { id: string; user_id: string | null }[]).map((p) => [p.id, p.user_id]));
  const trust = await trustStore(userId);
  const seen = await seenStore(userId);
  const newer: Record<string, number> = {};
  const out = new Map<string, unknown>();
  const writers = new Map<string, string>();
  for (const row of rows) {
    try {
      const key = await vaultKeyFor(familyId, row.key_version);
      const ctx = context.record(familyId, row.kind, row.item_id);
      const rec = await openJson<SignedRecord>(key, row.sealed, ctx);
      if (rec?.v !== 2 || typeof rec.d !== 'string' || !rec.keys?.sign) continue;
      if (!(await verifyText(rec.keys.sign, await recordStatement(ctx, rec.at, rec.by, rec.d), rec.sig))) continue;
      const writerKeyId = await keyIdOf(rec.keys);
      if (!writerKeyId) continue;
      const state = trustOf(trust, rec.by, writerKeyId);
      if (state === 'changed') continue;
      if (state === 'new') {
        // First sight: only keys the server lists for them now, if they are still here.
        const now = members.find((m) => m.userId === rec.by);
        if (now && (await keyIdOf({ encrypt: now.encryptPublic, sign: now.signPublic })) !== writerKeyId) continue;
        if (now) await trustKey(userId, rec.by, writerKeyId);
      }
      if (!mayWrite(row.kind, rec.by, roles, personUser.get(row.item_id) ?? null, state === 'trusted')) continue;
      writers.set(`${row.kind}:${row.item_id}`, rec.by);
      const where = `${familyId}:${row.kind}:${row.item_id}`;
      if (rec.at < (seen.r[where] ?? 0)) continue; // an older copy than this device has seen
      if (rec.at > (seen.r[where] ?? 0)) newer[where] = rec.at;
      out.set(`${row.kind}:${row.item_id}`, JSON.parse(rec.d));
    } catch {
      // Sealed with a key version this person does not hold, or changed: left out.
    }
  }
  if (Object.keys(newer).length) await updateSeen(userId, (st) => { Object.assign(st.r, newer); });
  itemsCache.set(familyId, out);
  itemWriters.set(familyId, writers);
  return out;
}

async function sealItem(familyId: string, kind: VaultItemKind, itemId: string, value: unknown): Promise<void> {
  const { version, key } = await latestVaultKey(familyId);
  const ctx = context.record(familyId, kind, itemId);
  const rec = await signedRecord(ctx, value);
  await sealVaultItemRpc(familyId, kind, itemId, version, await sealJson(key, rec, ctx));
  const userId = await myId();
  await updateSeen(userId, (st) => { st.r[`${familyId}:${kind}:${itemId}`] = rec.at; });
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
  // Once the links are sealed, readable ones are never taken: a server could add them (074).
  const sealed = items.get(`tree-links:${familyId}`) as { links?: KinLink[] } | undefined;
  return { people: opened, links: linksAmong(sealed ? sealed.links ?? [] : links, opened.map((p) => p.id)) };
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
  const ctx = context.record(familyId, 'person', id);
  const rec = await signedRecord(ctx, value);
  await addSealedPersonRpc(familyId, id, version, await sealJson(key, rec, ctx));
  await updateSeen(await myId(), (st) => { st.r[`${familyId}:person:${id}`] = rec.at; });
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

const NOTE_FORM = /^n2\.([0-9a-f-]{36})\.(e1\.[A-Za-z0-9_-]+)$/;

export function isSealedNote(body: string): boolean {
  return /^n[0-9]\./.test(body);
}

/**
 * A note's text sealed for a locked vault, with its owner's own key, not the
 * vault's (074): "n2.<id>.<sealed>". Bound to the vault and to them, so it
 * opens nowhere else and for nobody else.
 */
export async function sealNoteBody(familyId: string, text: string): Promise<string> {
  const { userId, key } = await myOwnKey();
  const rid = crypto.randomUUID();
  return `n2.${rid}.${await sealJson(key, { vault: familyId, body: text }, context.personal(userId, 'note', rid))}`;
}

/** A note's text, opened here when it is sealed. */
export async function openNoteBody(familyId: string, body: string): Promise<string> {
  const m = body.match(NOTE_FORM);
  if (!m) return isSealedNote(body) ? 'This note could not be opened on this device.' : body;
  try {
    const { userId, key } = await myOwnKey();
    const note = await openJson<{ vault: string; body: string }>(key, m[2], context.personal(userId, 'note', m[1]));
    if (note.vault !== familyId) throw new Error('another vault');
    return note.body;
  } catch {
    return 'This note could not be opened on this device.';
  }
}

/**
 * Seal what a locked vault still holds readable, as far as this person may:
 * an admin its name, its links, everyone's details and cards; anyone their
 * own entry and card, and their own notes. The server blanks each readable
 * copy as it is sealed (073). Kept to once every few minutes a vault.
 *
 * A readable copy is taken only where nothing is sealed yet (074): a server
 * could otherwise put up a readable card or link and have an admin's app seal
 * it as if a member had written it. Once an admin's app has moved a vault,
 * its readable name, links and cards are never read again here; new members'
 * own entries still are, since their membership makes them readable.
 */
export async function moveVaultDetails(familyId: string, admin: boolean, force = false, status?: VaultKeyStatus): Promise<void> {
  const userId = await myId();
  await forPerson();
  if (!force && Date.now() - (movedAt.get(familyId) ?? 0) < 5 * 60_000) return;
  movedAt.set(familyId, Date.now());
  const items = await vaultItems(familyId, true);
  const db = supabase as any;
  const done = (await seenStore(userId)).d[familyId] === true;
  const has = (k: string) => items.has(k);

  if (admin && !done && !has(`vault-name:${familyId}`)) {
    const { data: fam } = await db.from('families').select('name').eq('id', familyId).maybeSingle();
    if (fam?.name && fam.name !== LOCKED_VAULT_NAME) await sealVaultName(familyId, fam.name);
  }

  const { data: people } = await db.from('family_people')
    .select('id, user_id, display_name, gender, birth_date, nickname').eq('family_id', familyId);
  const rows = (people ?? []) as { id: string; user_id: string | null; display_name: string; gender: string | null; birth_date: string | null; nickname: string | null }[];
  const members = new Set((status?.members ?? []).map((m) => m.userId));
  for (const r of rows) {
    const readable = r.display_name !== LOCKED_PERSON_NAME || r.gender || r.birth_date || r.nickname;
    if (!readable || has(`person:${r.id}`) || !(admin || r.user_id === userId)) continue;
    // After the move, only a member's own entry can still be readable.
    if (done && !(r.user_id && (members.size === 0 || members.has(r.user_id)))) continue;
    await sealPerson(familyId, r.id, {
      name: r.display_name,
      gender: r.gender === 'female' || r.gender === 'male' ? r.gender : null,
      birthDate: r.birth_date ?? null,
      nickname: r.nickname ?? null,
    });
  }

  if (admin && !done && !has(`tree-links:${familyId}`)) {
    const { data: links } = await db.from('family_links').select('from_person, to_person, kind').eq('family_id', familyId);
    const readable = ((links ?? []) as { from_person: string; to_person: string; kind: KinLink['kind'] }[])
      .map((l) => ({ from: l.from_person, to: l.to_person, kind: l.kind }));
    await sealTreeLinks(familyId, linksAmong(readable, rows.map((r) => r.id)));
  }

  if (!done) {
    const { data: cards } = await db.from('family_emergency_cards').select('*').eq('family_id', familyId);
    const mine = new Set(rows.filter((r) => r.user_id === userId).map((r) => r.id));
    for (const c of (cards ?? []) as Record<string, unknown>[]) {
      const personId = String(c.person_id);
      if ((!admin && !mine.has(personId)) || has(`emergency-card:${personId}`)) continue;
      const { person_id: _p, family_id: _f, updated_by: _b, updated_at: _a, ...card } = c;
      await sealCard(familyId, personId, card as SealedCard);
    }
  }
  if (admin && !done) await updateSeen(userId, (st) => { st.d[familyId] = true; });

  // What someone who has left wrote is signed again by an admin here, so
  // members who join later, who never knew that person's keys, can take it.
  if (admin && members.size) {
    for (const [k, writer] of itemWriters.get(familyId) ?? []) {
      if (members.has(writer)) continue;
      const [kind, itemId] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)] as [VaultItemKind, string];
      if (kind === 'member-key' && !members.has(itemId)) continue;
      await sealItem(familyId, kind, itemId, items.get(k)).catch(() => undefined);
    }
  }

  const { data: notes } = await db.from('scratch_notes').select('id, body').eq('family_id', familyId);
  for (const n of (notes ?? []) as { id: string; body: string }[]) {
    if (isSealedNote(n.body)) continue;
    await db.from('scratch_notes').update({ body: await sealNoteBody(familyId, n.body) }).eq('id', n.id);
  }
  // Sealed parts whose document is gone (deleted, or removed when a plan ended).
  await sweepSealedDocuments(familyId).catch(() => undefined);
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
