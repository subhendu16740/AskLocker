// What the Encryption keys screen knows about a person's keys (end-to-end
// encryption; docs/end-to-end-encryption.md). Shared by the web file
// (vault-keys.web.ts) and the phone app's stand-in (vault-keys.ts).

/** What the server holds of a person's keys: public parts only. */
export interface ServerIdentity {
  fingerprint: string;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
  /** A backup key was saved (it is optional since 071). */
  hasBackup: boolean;
}

/** One way this person's phone lock (a passkey) unlocks their keys. */
export interface PhoneLockEntry {
  id: string;
  label: string | null;
  createdAt: string;
  /** Made for the keys they have now (new keys make old ones useless). */
  current: boolean;
}

/** The ways a new device can get the keys. */
export interface UnlockWays {
  phoneLock: boolean;
  backupKey: boolean;
}

export type KeysState =
  /** This device cannot keep keys (the phone app before its update, an old browser). */
  | { kind: 'unsupported'; reason: string }
  /** The server has no place for keys yet (migration 070 not applied). */
  | { kind: 'unavailable' }
  /** No keys set up for this account yet: the app makes them, no screen needed. */
  | { kind: 'none' }
  /** Set up, but not on this device: the phone lock, another device or the backup key brings them here. */
  | { kind: 'locked'; server: ServerIdentity; ways: UnlockWays }
  /** Set up, and kept on this device. */
  | { kind: 'ready'; server: ServerIdentity; phoneLocks: PhoneLockEntry[]; canHandOn: boolean }
  /** This device keeps other keys than the account's. */
  | { kind: 'mismatch'; server: ServerIdentity; deviceFingerprint: string };

/** A backup key made on the device, shown to the person before anything is saved. */
export interface PreparedKeys {
  /** "XXXX-XXXX-…", 7 groups of 4. Shown once; never sent anywhere. */
  recoveryKey: string;
  fingerprint: string;
  /** Saves it: the keys locked with it go to the account. */
  commit: () => Promise<void>;
}

/** A new device waiting for another one to approve it. */
export interface DeviceRequest {
  /** Six digits, "123 456", the same on both screens. */
  code: string;
  /** Resolves once approved and the keys are kept here; rejects when it ends. */
  done: Promise<void>;
  cancel: () => Promise<void>;
}

/** A new device asking this one for the keys. */
export interface PendingDevice {
  id: string;
  code: string;
  label: string | null;
  createdAt: string;
}
