// Encryption keys on this device — the web app's (end-to-end encryption,
// Phase 1; docs/end-to-end-encryption.md). Test builds only, while nothing
// is encrypted.
//
// A person's keys are made here, on the device, by vault-crypto.ts. The
// account keeps only their public parts and a copy locked with the Recovery
// Key, which never leaves the device (070). This device keeps the keys in
// IndexedDB in a form the browser will not hand out (deviceCopy()): they can
// be used here, not read out. A new device gets them back from the locked
// copy and the Recovery Key.
//
// Signing out keeps them on this device, so signing in again needs no
// Recovery Key; "Forget keys on this device" and deleting the account remove
// them.

import {
  VaultCryptoError,
  deviceCopy,
  identityFingerprint,
  newIdentity,
  newRecoveryKey,
  openIdentity,
  publicIdentity,
  sealIdentity,
  type Identity,
} from '../../supabase/functions/_shared/vault-crypto';
import {
  deleteMyIdentity,
  fetchMyIdentity,
  registerMyIdentity,
  updateMyIdentityBackup,
  type MyIdentity,
} from './api';
import type { KeysState, PreparedKeys, ServerIdentity } from './vault-keys-types';

export type { KeysState, PreparedKeys, ServerIdentity };

// ─── This device's store (IndexedDB) ─────────────────────────────

const DB_NAME = 'asklocker-keys';
const STORE = 'identities';

interface KeptIdentity {
  identity: Identity; // private halves cannot be read out
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
    // Not offered, or refused: the Recovery Key still brings the keys back.
  }
}

async function keep(userId: string, identity: Identity, server: { fingerprint: string; keyVersion: number }): Promise<void> {
  await writeKept(userId, {
    identity: await deviceCopy(identity),
    fingerprint: server.fingerprint,
    keyVersion: server.keyVersion,
    savedAt: new Date().toISOString(),
  });
  await askToKeepStorage();
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
  return { fingerprint: me.fingerprint, keyVersion: me.keyVersion, createdAt: me.createdAt, updatedAt: me.updatedAt };
}

async function myIdentityOrThrow(): Promise<MyIdentity> {
  const me = await fetchMyIdentity();
  if (me === 'unavailable') throw new Error("Encryption keys aren't switched on yet.");
  if (!me) throw new Error('Your keys are not set up yet.');
  return me;
}

/** Opens the account's locked copy with a typed Recovery Key, and checks it is the account's own keys. */
async function openBackup(userId: string, typed: string, extractable: boolean): Promise<{ me: MyIdentity; identity: Identity }> {
  const me = await myIdentityOrThrow();
  const identity = await openIdentity(me.backup, typed, userId, extractable);
  const pub = await publicIdentity(identity);
  if (pub.encrypt !== me.encryptPublic || pub.sign !== me.signPublic) {
    throw new Error("These keys don't match your account's. Ask us for help.");
  }
  return { me, identity };
}

// ─── The screen's actions ────────────────────────────────────────

export async function loadKeysState(userId: string): Promise<KeysState> {
  const reason = unsupportedReason();
  if (reason) return { kind: 'unsupported', reason };
  const me = await fetchMyIdentity();
  if (me === 'unavailable') return { kind: 'unavailable' };
  if (!me) return { kind: 'none' };
  const server = serverPart(me);
  const kept = await readKept(userId).catch(() => null);
  if (!kept) return { kind: 'locked', server };
  // The background check: the keys this device holds are the account's.
  const devicePrint = await identityFingerprint(await publicIdentity(kept.identity));
  if (devicePrint !== me.fingerprint) return { kind: 'mismatch', server, deviceFingerprint: devicePrint };
  return { kind: 'ready', server };
}

/** New keys and a new Recovery Key, made here. Nothing is saved until commit(). */
export async function prepareKeys(userId: string): Promise<PreparedKeys> {
  const identity = await newIdentity();
  const recoveryKey = await newRecoveryKey();
  const pub = await publicIdentity(identity);
  const fingerprint = await identityFingerprint(pub);
  const backup = await sealIdentity(identity, recoveryKey, userId);
  return {
    recoveryKey,
    fingerprint,
    commit: async () => {
      await registerMyIdentity(pub.encrypt, pub.sign, fingerprint, backup);
      await keep(userId, identity, { fingerprint, keyVersion: 1 });
    },
  };
}

/** Puts the account's keys on this device, from the Recovery Key. */
export async function unlockWithRecoveryKey(userId: string, typed: string): Promise<void> {
  const { me, identity } = await openBackup(userId, typed, true);
  await keep(userId, identity, { fingerprint: me.fingerprint, keyVersion: me.keyVersion });
}

/** True when the typed Recovery Key opens the account's keys. Changes nothing. */
export async function checkRecoveryKey(userId: string, typed: string): Promise<boolean> {
  try {
    await openBackup(userId, typed, false);
    return true;
  } catch (err) {
    if (err instanceof VaultCryptoError && (err.code === 'cannot_open' || err.code === 'recovery_key_typo')) return false;
    throw err;
  }
}

/** A new Recovery Key for the same keys; the old one is needed to open them. Nothing changes until commit(). */
export async function prepareNewRecoveryKey(userId: string, oldTyped: string): Promise<PreparedKeys> {
  const { me, identity } = await openBackup(userId, oldTyped, true);
  const recoveryKey = await newRecoveryKey();
  const backup = await sealIdentity(identity, recoveryKey, userId);
  return {
    recoveryKey,
    fingerprint: me.fingerprint,
    commit: async () => {
      await updateMyIdentityBackup(backup);
    },
  };
}

export async function forgetKeysOnThisDevice(userId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  await removeKept(userId).catch(() => undefined);
}

/** Test builds only, while nothing is encrypted: forgets the keys on the account and here. */
export async function deleteKeysEverywhere(userId: string): Promise<void> {
  await deleteMyIdentity();
  await forgetKeysOnThisDevice(userId);
}

/** Every failure said in words. */
export function keysErrorText(err: unknown): string {
  if (err instanceof VaultCryptoError) {
    switch (err.code) {
      case 'not_a_recovery_key': return 'A Recovery Key is 28 letters and numbers, in 7 groups of 4.';
      case 'recovery_key_typo': return 'One of the characters is wrong. Check the Recovery Key and try again.';
      case 'cannot_open': return "That Recovery Key doesn't open your keys. Check it and try again.";
      default: return 'Your keys could not be read. Please try again.';
    }
  }
  const e = err as { hint?: string; message?: string } | null;
  if (e?.hint === 'identity_exists') return 'Your keys are already set up. Unlock this device with your Recovery Key.';
  if (e?.hint === 'no_identity') return 'Your keys are not set up yet.';
  if (e?.hint === 'bad_keys') return "Those keys weren't accepted. Please try again.";
  if (e?.message && /fetch|network/i.test(e.message)) return "You're offline. Connect and try again.";
  return e?.message || "That didn't work. Please try again.";
}
