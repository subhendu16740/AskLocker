// Encryption keys — the phone app's stand-in. The phone app needs a
// WebCrypto library and a secure key store in its native build (an EAS build,
// which does not exist yet); the web app's are in vault-keys.web.ts. Nothing
// is encrypted yet (docs/end-to-end-encryption.md), so nothing is lost here.

import type { KeysState, PreparedKeys, ServerIdentity } from './vault-keys-types';

export type { KeysState, PreparedKeys, ServerIdentity };

const NOT_HERE = 'Encryption keys need the next version of the phone app. Use the web app for now.';

export async function loadKeysState(_userId: string): Promise<KeysState> {
  return { kind: 'unsupported', reason: NOT_HERE };
}

export async function prepareKeys(_userId: string): Promise<PreparedKeys> {
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

export async function forgetKeysOnThisDevice(_userId: string): Promise<void> {}

export async function deleteKeysEverywhere(_userId: string): Promise<void> {
  throw new Error(NOT_HERE);
}

export function keysErrorText(err: unknown): string {
  return (err as Error)?.message || "That didn't work. Please try again.";
}
