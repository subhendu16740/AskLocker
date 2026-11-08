// Encryption keys — the phone app's stand-in. The phone app needs a
// WebCrypto library and a secure key store in its native build (an EAS build,
// which does not exist yet); the web app's are in vault-keys.web.ts. Locked
// vaults are test builds on the web only (docs/end-to-end-encryption.md).

import type { Identity } from '../../supabase/functions/_shared/vault-crypto';
import type {
  DeviceRequest, KeysState, PendingDevice, PhoneLockEntry, PreparedKeys, ServerIdentity, UnlockWays,
} from './vault-keys-types';

export type { DeviceRequest, KeysState, PendingDevice, PhoneLockEntry, PreparedKeys, ServerIdentity, UnlockWays };

const NOT_HERE = 'Encryption keys need the next version of the phone app. Use the web app for now.';

export class VaultKeysError extends Error {
  code = 'not_here';
}

export async function loadKeysState(_userId: string): Promise<KeysState> {
  return { kind: 'unsupported', reason: NOT_HERE };
}
export async function ensureKeys(_userId: string): Promise<KeysState> {
  return { kind: 'unsupported', reason: NOT_HERE };
}
export async function myDeviceIdentity(_userId: string): Promise<Identity | null> {
  return null;
}
export async function setUpKeys(_userId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function prepareBackupKey(_userId: string): Promise<PreparedKeys> {
  throw new Error(NOT_HERE);
}
export async function unlockWithRecoveryKey(_userId: string, _typed: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function checkRecoveryKey(_userId: string, _typed: string): Promise<boolean> {
  throw new Error(NOT_HERE);
}
export async function prepareNewRecoveryKey(_userId: string, _oldTyped: string): Promise<PreparedKeys> {
  throw new Error(NOT_HERE);
}
export async function phoneLockSupported(): Promise<boolean> {
  return false;
}
export async function addPhoneLock(_userId: string, _accountName: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function unlockWithPhoneLock(_userId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function removePhoneLock(_id: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function startDeviceRequest(_userId: string): Promise<DeviceRequest> {
  throw new Error(NOT_HERE);
}
export async function pendingDeviceRequests(): Promise<PendingDevice[]> {
  return [];
}
export async function approveDeviceRequest(_userId: string, _requestId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function makeNewKeys(_userId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function forgetKeysOnThisDevice(_userId: string): Promise<void> {}
export async function deleteKeysEverywhere(_userId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export function keysErrorText(err: unknown): string {
  return (err as Error)?.message || "That didn't work. Please try again.";
}
