// Encryption keys on this device — the web app's (end-to-end encryption;
// docs/end-to-end-encryption.md, "A person's keys"). Test builds only.
//
// A person's keys are made here, by vault-crypto.ts, without a screen. The
// account keeps only their public parts (070). This device keeps them in
// IndexedDB twice: as keys the browser will not hand out, for every day,
// and sealed with a key of this device's own that the browser will not hand
// out either, so this device can lock them for a new phone, a passkey or a
// backup key (handing them on). A new device gets them back by:
//   * the phone's lock — a passkey that gives a key (WebAuthn PRF), synced
//     by Google Password Manager or iCloud Keychain (key_unlocks, 071);
//   * approving it from a device already signed in, the same six digits on
//     both screens (key_device_requests, 071);
//   * the backup (Recovery) Key, if one was saved.
// Lose all three and the person makes new keys (replace_my_identity): the
// family lets them back in; their personal vault does not come back.
//
// Signing out keeps the keys on this device; "Forget keys on this device"
// and deleting the account remove them.

import {
  VaultCryptoError,
  context,
  deviceCopy,
  exportIdentity,
  exportPublicKey,
  fromBase64Url,
  identityFingerprint,
  importIdentity,
  keyFromPasskey,
  lockTextForPublicKey,
  newDeviceKey,
  newIdentity,
  newRecoveryKey,
  newRequestKeyPair,
  newSalt,
  openIdentity,
  openIdentityWithKey,
  pairingCode,
  publicIdentity,
  sealIdentity,
  sealIdentityWithKey,
  toBase64Url,
  unlockTextWithPrivateKey,
  type Identity,
} from '../../supabase/functions/_shared/vault-crypto';
import {
  deleteMyIdentity,
  fetchMyIdentity,
  registerMyIdentity,
  updateMyIdentityBackup,
  type MyIdentity,
} from './api';
import {
  addKeyUnlockRpc,
  answerDeviceRequestRpc,
  cancelDeviceRequestRpc,
  fetchKeyUnlocks,
  fetchMyDeviceRequests,
  removeKeyUnlockRpc,
  replaceMyIdentityRpc,
  requestDeviceKeysRpc,
  takeDeviceAnswerRpc,
} from './e2e-api';
import { deviceKey, storageSet } from './storage';
import type {
  DeviceRequest, KeysState, PendingDevice, PhoneLockEntry, PreparedKeys, ServerIdentity, UnlockWays,
} from './vault-keys-types';

export type { DeviceRequest, KeysState, PendingDevice, PhoneLockEntry, PreparedKeys, ServerIdentity, UnlockWays };

// ─── This device's store (IndexedDB) ─────────────────────────────

const DB_NAME = 'asklocker-keys';
const STORE = 'identities';

interface KeptIdentity {
  /** 2 since 071; 1 (070) kept only the everyday keys, so cannot hand them on. */
  v?: 2;
  identity: Identity;     // private halves cannot be read out
  deviceKey?: CryptoKey;  // this device's own, cannot be read out
  kept?: string;          // the identity sealed with deviceKey
  fingerprint: string;
  keyVersion: number;
  savedAt: string;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function openStore(): Promise<IDBDatabase> {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
  };
  return request(req);
}

async function readKept(userId: string): Promise<KeptIdentity | null> {
  const db = await openStore();
  try {
    return ((await request(db.transaction(STORE).objectStore(STORE).get(userId))) as KeptIdentity | undefined) ?? null;
  } finally {
    db.close();
  }
}

async function writeKept(userId: string, kept: KeptIdentity): Promise<void> {
  const db = await openStore();
  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).put(kept, userId));
  } finally {
    db.close();
  }
}

async function removeKept(userId: string): Promise<void> {
  const db = await openStore();
  try {
    await request(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(userId));
  } finally {
    db.close();
  }
}

/** Asks the browser not to clear this site's storage when space runs low. */
async function askToKeepStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Not offered, or refused: the phone lock, another device or the backup key brings the keys back.
  }
}

// The keys a page has opened, kept in memory for the visit.
const opened = new Map<string, Identity>();

/** Keep an identity on this device. `identity` must be extractable (just made, or just unlocked). */
async function keep(userId: string, identity: Identity, server: { fingerprint: string; keyVersion: number }): Promise<void> {
  const key = await newDeviceKey();
  const daily = await deviceCopy(identity);
  await writeKept(userId, {
    v: 2,
    identity: daily,
    deviceKey: key,
    kept: await sealIdentityWithKey(identity, key, context.deviceKeep(userId)),
    fingerprint: server.fingerprint,
    keyVersion: server.keyVersion,
    savedAt: new Date().toISOString(),
  });
  opened.set(userId, daily);
  await askToKeepStorage();
}

/** The keys this device keeps, for every day (opening vault keys). Null when not kept here. */
export async function myDeviceIdentity(userId: string): Promise<Identity | null> {
  const cached = opened.get(userId);
  if (cached) return cached;
  const kept = await readKept(userId).catch(() => null);
  if (!kept) return null;
  opened.set(userId, kept.identity);
  return kept.identity;
}

/** The keys this device keeps, in a form it can lock for others. Throws where it cannot (a 070 store). */
async function handOnIdentity(userId: string): Promise<Identity> {
  const kept = await readKept(userId);
  if (!kept) throw new VaultKeysError('not_here', 'Your keys are not on this device.');
  if (!kept.deviceKey || !kept.kept) {
    throw new VaultKeysError('old_store', 'This device keeps your keys the old way. Forget them here, then unlock again.');
  }
  return openIdentityWithKey(kept.kept, kept.deviceKey, context.deviceKeep(userId), true);
}

export class VaultKeysError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// ─── What this device can do ─────────────────────────────────────

function unsupportedReason(): string | null {
  if (typeof window === 'undefined') return 'Encryption keys work in a browser.';
  if (!window.isSecureContext) return 'Encryption keys need a secure (https) page.';
  if (!globalThis.crypto?.subtle) return "This browser can't make encryption keys. Try Chrome or Safari.";
  if (!('indexedDB' in window)) return "This browser can't keep encryption keys. Try Chrome or Safari.";
  return null;
}

function serverPart(me: MyIdentity): ServerIdentity {
  return {
    fingerprint: me.fingerprint, keyVersion: me.keyVersion, createdAt: me.createdAt, updatedAt: me.updatedAt,
    hasBackup: Boolean(me.backup),
  };
}

async function myIdentityOrThrow(): Promise<MyIdentity> {
  const me = await fetchMyIdentity();
  if (me === 'unavailable') throw new Error("Encryption keys aren't switched on yet.");
  if (!me) throw new Error('Your keys are not set up yet.');
  return me;
}

/** Unlocked keys must be the account's own: a server could serve someone else's. */
async function checkIsMine(me: MyIdentity, identity: Identity): Promise<void> {
  const pub = await publicIdentity(identity);
  if (pub.encrypt !== me.encryptPublic || pub.sign !== me.signPublic) {
    throw new Error("These keys don't match your account's. Ask us for help.");
  }
}

/** Opens the account's backup with a typed backup key, and checks it is the account's own keys. */
async function openBackup(userId: string, typed: string, extractable: boolean): Promise<{ me: MyIdentity; identity: Identity }> {
  const me = await myIdentityOrThrow();
  if (!me.backup) throw new VaultKeysError('no_backup', "You haven't saved a backup key.");
  const identity = await openIdentity(me.backup, typed, userId, extractable);
  await checkIsMine(me, identity);
  return { me, identity };
}

function phoneLocksFrom(rows: Awaited<ReturnType<typeof fetchKeyUnlocks>>, keyVersion: number): PhoneLockEntry[] {
  return rows.map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, current: r.identityVersion === keyVersion }));
}

// ─── The screen's actions ────────────────────────────────────────

export async function loadKeysState(userId: string): Promise<KeysState> {
  const reason = unsupportedReason();
  if (reason) return { kind: 'unsupported', reason };
  const me = await fetchMyIdentity();
  if (me === 'unavailable') return { kind: 'unavailable' };
  if (!me) return { kind: 'none' };
  const server = serverPart(me);
  const [kept, unlocks] = await Promise.all([
    readKept(userId).catch(() => null),
    fetchKeyUnlocks().catch(() => []),
  ]);
  if (!kept) {
    const ways: UnlockWays = {
      phoneLock: unlocks.some((u) => u.identityVersion === me.keyVersion),
      backupKey: server.hasBackup,
    };
    return { kind: 'locked', server, ways };
  }
  // The background check: the keys this device holds are the account's.
  const devicePrint = await identityFingerprint(await publicIdentity(kept.identity));
  if (devicePrint !== me.fingerprint) return { kind: 'mismatch', server, deviceFingerprint: devicePrint };
  opened.set(userId, kept.identity);
  return { kind: 'ready', server, phoneLocks: phoneLocksFrom(unlocks, me.keyVersion), canHandOn: Boolean(kept.deviceKey && kept.kept) };
}

/** Make this person's keys, here, with no screen: the account gets the public parts. */
export async function setUpKeys(userId: string): Promise<void> {
  const identity = await newIdentity();
  const pub = await publicIdentity(identity);
  const fingerprint = await identityFingerprint(pub);
  await registerMyIdentity(pub.encrypt, pub.sign, fingerprint, null);
  await keep(userId, identity, { fingerprint, keyVersion: 1 });
}

/** Make keys if this account has none yet, and say whether this device has them now. */
export async function ensureKeys(userId: string): Promise<KeysState> {
  const state = await loadKeysState(userId);
  if (state.kind !== 'none') return state;
  await setUpKeys(userId);
  return loadKeysState(userId);
}

/** A backup key for the keys this device keeps. Nothing is saved until commit(). */
export async function prepareBackupKey(userId: string): Promise<PreparedKeys> {
  const identity = await handOnIdentity(userId);
  const me = await myIdentityOrThrow();
  await checkIsMine(me, identity);
  const recoveryKey = await newRecoveryKey();
  const backup = await sealIdentity(identity, recoveryKey, userId);
  return { recoveryKey, fingerprint: me.fingerprint, commit: () => updateMyIdentityBackup(backup) };
}

/** Puts the account's keys on this device, from the backup key. */
export async function unlockWithRecoveryKey(userId: string, typed: string): Promise<void> {
  const { me, identity } = await openBackup(userId, typed, true);
  await keep(userId, identity, { fingerprint: me.fingerprint, keyVersion: me.keyVersion });
}

/** True when the typed backup key opens the account's keys. Changes nothing. */
export async function checkRecoveryKey(userId: string, typed: string): Promise<boolean> {
  try {
    await openBackup(userId, typed, false);
    return true;
  } catch (err) {
    if (err instanceof VaultCryptoError && (err.code === 'cannot_open' || err.code === 'recovery_key_typo')) return false;
    throw err;
  }
}

/**
 * A new backup key when this device cannot hand its keys on (a 070 store):
 * the old one opens them. Nothing changes until commit().
 */
export async function prepareNewRecoveryKey(userId: string, oldTyped: string): Promise<PreparedKeys> {
  const { me, identity } = await openBackup(userId, oldTyped, true);
  const recoveryKey = await newRecoveryKey();
  const backup = await sealIdentity(identity, recoveryKey, userId);
  return { recoveryKey, fingerprint: me.fingerprint, commit: () => updateMyIdentityBackup(backup) };
}

// ─── The phone's lock (a passkey that gives a key) ───────────────

/** Whether this browser can use the phone's lock to keep the keys. */
export async function phoneLockSupported(): Promise<boolean> {
  try {
    const PKC = (window as any).PublicKeyCredential;
    if (!PKC || !navigator.credentials) return false;
    if (typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return Boolean(await PKC.isUserVerifyingPlatformAuthenticatorAvailable());
    }
    return true;
  } catch {
    return false;
  }
}

/** A short name for this device: "Chrome on Android". */
function deviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone'
    : /Mac OS X/i.test(ua) ? 'Mac' : /Windows/i.test(ua) ? 'Windows' : /Linux/i.test(ua) ? 'Linux' : 'this device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

/** Our passkey's user handle: not the sign-in passkey's, so making one never replaces it. */
async function documentsKeyHandle(userId: string): Promise<Uint8Array<ArrayBuffer>> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`asklocker/documents-key/${userId}`)));
  return digest.slice(0, 16);
}

function prfFirst(cred: PublicKeyCredential | null): ArrayBuffer | null {
  const ext = (cred?.getClientExtensionResults?.() ?? {}) as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };
  return ext.prf?.results?.first ?? null;
}

/**
 * Make an AskLocker documents key: a passkey whose PRF output seals this
 * person's keys. One fingerprint, face, PIN or pattern; a second where the
 * phone gives the key only when it is used.
 */
export async function addPhoneLock(userId: string, accountName: string): Promise<void> {
  const identity = await handOnIdentity(userId);
  const me = await myIdentityOrThrow();
  await checkIsMine(me, identity);
  const salt = newSalt(32);
  const rpId = window.location.hostname;
  const created = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'AskLocker', id: rpId },
      user: { id: await documentsKeyHandle(userId), name: `${accountName} · documents key`, displayName: 'AskLocker documents key' },
      challenge: newSalt(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      timeout: 120_000,
      extensions: { prf: { eval: { first: salt } } } as any,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new VaultKeysError('cancelled', 'That was cancelled. Try again.');
  await storageSet(deviceKey.documentsKeyHere, '1');
  let output = prfFirst(created);
  if (!output) {
    const ext = created.getClientExtensionResults() as { prf?: { enabled?: boolean } };
    if (ext.prf && ext.prf.enabled === false) {
      throw new VaultKeysError('no_prf', "This phone's lock can't keep your keys. Approve your next phone from this one, or save a backup key.");
    }
    const used = (await navigator.credentials.get({
      publicKey: {
        challenge: newSalt(32),
        rpId,
        allowCredentials: [{ type: 'public-key', id: created.rawId }],
        userVerification: 'required',
        timeout: 120_000,
        extensions: { prf: { eval: { first: salt } } } as any,
      },
    })) as PublicKeyCredential | null;
    output = prfFirst(used);
  }
  if (!output) {
    throw new VaultKeysError('no_prf', "This phone's lock can't keep your keys. Approve your next phone from this one, or save a backup key.");
  }
  const key = await keyFromPasskey(output, salt);
  const sealed = await sealIdentityWithKey(identity, key, context.passkeyUnlock(userId));
  await addKeyUnlockRpc(toBase64Url(new Uint8Array(created.rawId)), toBase64Url(salt), sealed, deviceLabel());
}

/** Puts the account's keys on this device with the phone's lock (a synced documents key). */
export async function unlockWithPhoneLock(userId: string): Promise<void> {
  const me = await myIdentityOrThrow();
  const unlocks = (await fetchKeyUnlocks()).filter((u) => u.identityVersion === me.keyVersion);
  if (!unlocks.length) throw new VaultKeysError('no_phone_lock', "Your phone's lock isn't set up for your keys yet.");
  const evalByCredential: Record<string, { first: Uint8Array<ArrayBuffer> }> = {};
  for (const u of unlocks) evalByCredential[u.credentialId] = { first: fromBase64Url(u.prfSalt) };
  const used = (await navigator.credentials.get({
    publicKey: {
      challenge: newSalt(32),
      rpId: window.location.hostname,
      allowCredentials: unlocks.map((u) => ({ type: 'public-key' as const, id: fromBase64Url(u.credentialId) })),
      userVerification: 'required',
      timeout: 120_000,
      extensions: { prf: { evalByCredential } } as any,
    },
  })) as PublicKeyCredential | null;
  if (!used) throw new VaultKeysError('cancelled', 'That was cancelled. Try again.');
  const which = unlocks.find((u) => u.credentialId === toBase64Url(new Uint8Array(used.rawId)));
  const output = prfFirst(used);
  if (!which || !output) throw new VaultKeysError('no_prf', "This device's lock couldn't open your keys. Approve it from another device instead.");
  const key = await keyFromPasskey(output, fromBase64Url(which.prfSalt));
  const identity = await openIdentityWithKey(which.sealedIdentity, key, context.passkeyUnlock(userId), true);
  await checkIsMine(me, identity);
  await keep(userId, identity, { fingerprint: me.fingerprint, keyVersion: me.keyVersion });
  await storageSet(deviceKey.documentsKeyHere, '1');
}

export async function removePhoneLock(id: string): Promise<void> {
  await removeKeyUnlockRpc(id);
}

// ─── Approving a new device from one already signed in ──────────

/** This (new) device asks for the keys and waits for another device to approve it. */
export async function startDeviceRequest(userId: string): Promise<DeviceRequest> {
  const me = await myIdentityOrThrow();
  const pair = await newRequestKeyPair();
  const requestKey = await exportPublicKey(pair.publicKey);
  const id = await requestDeviceKeysRpc(requestKey, deviceLabel());
  const code = await pairingCode(requestKey);
  let stopped = false;
  const done = (async () => {
    const until = Date.now() + 15 * 60_000;
    while (!stopped && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 3000));
      if (stopped) break;
      const answer = await takeDeviceAnswerRpc(id).catch(() => null);
      if (!answer) continue;
      const identity = await importIdentity(await unlockTextWithPrivateKey(answer, pair.privateKey, context.deviceRequest(userId, id)), true);
      await checkIsMine(me, identity);
      await keep(userId, identity, { fingerprint: me.fingerprint, keyVersion: me.keyVersion });
      return;
    }
    throw new VaultKeysError(stopped ? 'cancelled' : 'request_gone', stopped ? 'Stopped.' : 'That took too long. Ask again.');
  })();
  return {
    code,
    done,
    cancel: async () => {
      stopped = true;
      await cancelDeviceRequestRpc(id);
    },
  };
}

/** New devices asking this one for the keys, with the code each shows. */
export async function pendingDeviceRequests(): Promise<PendingDevice[]> {
  const rows = (await fetchMyDeviceRequests()).filter((r) => !r.answered && new Date(r.expiresAt).getTime() > Date.now());
  return Promise.all(rows.map(async (r) => ({ id: r.id, code: await pairingCode(r.requestKey), label: r.label, createdAt: r.createdAt })));
}

/** Approve one: the keys, locked for that device's one-time key. */
export async function approveDeviceRequest(userId: string, requestId: string): Promise<void> {
  const row = (await fetchMyDeviceRequests()).find((r) => r.id === requestId);
  if (!row || row.answered) throw new VaultKeysError('request_gone', 'That request has ended. Ask again on the new device.');
  const identity = await handOnIdentity(userId);
  const answer = await lockTextForPublicKey(row.requestKey, await exportIdentity(identity), context.deviceRequest(userId, requestId));
  await answerDeviceRequestRpc(requestId, answer);
}

// ─── New keys, after losing every way back ───────────────────────

/** New keys for this account. Every locked vault's admins are asked to let you back in. */
export async function makeNewKeys(userId: string): Promise<void> {
  const identity = await newIdentity();
  const pub = await publicIdentity(identity);
  const fingerprint = await identityFingerprint(pub);
  const keyVersion = await replaceMyIdentityRpc(pub.encrypt, pub.sign, fingerprint);
  await keep(userId, identity, { fingerprint, keyVersion });
}

export async function forgetKeysOnThisDevice(userId: string): Promise<void> {
  opened.delete(userId);
  if (typeof indexedDB === 'undefined') return;
  await removeKept(userId).catch(() => undefined);
}

/** Test builds only: forgets the keys on the account and here (refused once they open a locked vault). */
export async function deleteKeysEverywhere(userId: string): Promise<void> {
  await deleteMyIdentity();
  await forgetKeysOnThisDevice(userId);
}

/** Every failure said in words. */
export function keysErrorText(err: unknown): string {
  if (err instanceof VaultKeysError) return err.message;
  if (err instanceof VaultCryptoError) {
    switch (err.code) {
      case 'not_a_recovery_key': return 'A backup key is 28 letters and numbers, in 7 groups of 4.';
      case 'recovery_key_typo': return 'One of the characters is wrong. Check the backup key and try again.';
      case 'cannot_open': return "That doesn't open your keys. Check it and try again.";
      default: return 'Your keys could not be read. Please try again.';
    }
  }
  const e = err as { hint?: string; message?: string; name?: string } | null;
  if (e?.name === 'NotAllowedError') return 'That was cancelled or took too long. Try again.';
  if (e?.name === 'InvalidStateError') return 'This device already has a documents key for you.';
  if (e?.name === 'SecurityError') return `The phone's lock can't be used on this address (${window.location.host}).`;
  if (e?.hint === 'identity_exists') return 'Your keys are already set up. Unlock this device instead.';
  if (e?.hint === 'no_identity') return 'Your keys are not set up yet.';
  if (e?.hint === 'bad_keys') return "Those keys weren't accepted. Please try again.";
  if (e?.hint === 'holds_vault_keys' || e?.hint === 'too_many' || e?.hint === 'request_gone') return e.message ?? '';
  if (e?.message && /fetch|network/i.test(e.message)) return "You're offline. Connect and try again.";
  return e?.message || "That didn't work. Please try again.";
}
