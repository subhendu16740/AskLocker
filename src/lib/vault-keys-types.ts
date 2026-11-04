// What the Encryption keys screen knows about a person's keys (end-to-end
// encryption, Phase 1; docs/end-to-end-encryption.md). Shared by the web
// file (vault-keys.web.ts) and the phone app's stand-in (vault-keys.ts).

/** What the server holds of a person's keys: public parts only, never the Recovery Key. */
export interface ServerIdentity {
  fingerprint: string;
  keyVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type KeysState =
  /** This device cannot keep keys (the phone app before its update, an old browser). */
  | { kind: 'unsupported'; reason: string }
  /** The server has no place for keys yet (migration 070 not applied). */
  | { kind: 'unavailable' }
  /** No keys set up for this account. */
  | { kind: 'none' }
  /** Set up, but not on this device: the Recovery Key unlocks them here. */
  | { kind: 'locked'; server: ServerIdentity }
  /** Set up, and kept on this device. */
  | { kind: 'ready'; server: ServerIdentity }
  /** This device keeps other keys than the account's. */
  | { kind: 'mismatch'; server: ServerIdentity; deviceFingerprint: string };

/** New keys made on the device, shown to the person before anything is saved. */
export interface PreparedKeys {
  /** "XXXX-XXXX-…", 7 groups of 4. Shown once; never sent anywhere. */
  recoveryKey: string;
  fingerprint: string;
  /** Saves them: the public parts and the locked backup to the account, the keys to this device. */
  commit: () => Promise<void>;
}
