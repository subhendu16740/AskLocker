// ─── Vault crypto: end-to-end encryption, on members' devices only ──────
//
// docs/end-to-end-encryption.md. The app's locked vaults (test builds) use it,
// and QA's self-test pins it.
//
// RUNS ONLY ON MEMBERS' DEVICES (and in QA's self-test). No Edge Function may
// import this file. A server that can unlock a vault key is exactly the
// "middle" the design removes: the server stores what these functions seal,
// and never holds a key that opens it.
//
// Standard pieces only, all WebCrypto (browsers, Node 22, Deno), nothing
// home-made:
//   • AES-256-GCM with a fresh random 96-bit nonce for every seal, and a
//     context string as associated data. A sealed item opens only in the
//     place it was sealed for (this vault, this document, this kind of data),
//     so a server cannot move a file into another document or vault, or swap
//     two files, without the phone noticing.
//   • ECDH P-256 + HKDF-SHA-256 to lock a vault key for one member's public
//     key (a fresh ephemeral key for every grant).
//   • ECDSA P-256 with SHA-256 to sign invitations and grants.
//   • A Recovery Key: 128 random bits, shown as 28 characters in 7 groups,
//     the last two a checksum that catches a mistyped character.
//
// The layers (envelope encryption, as in Google Workspace's client-side
// encryption, Proton Drive and Apple's Advanced Data Protection):
//   file key (one per document)  — seals the file, its name, its passages
//     ↑ locked by
//   vault key (one per vault)    — also seals the vault's name, tree, cards,
//     ↑ locked for each member      saved chats and notes
//   member's identity key        — kept on their devices, brought to a new
//     ↑ by                          one by the phone's lock (a passkey's
//   PRF key, another device, or the backup (Recovery) Key.
// ────────────────────────────────────────────────────────────────

const subtle = globalThis.crypto.subtle;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Sealed text: "e1." + base64url(nonce ‖ ciphertext ‖ tag). */
export const SEAL_PREFIX = 'e1.';
/** Sealed bytes (a file): these three bytes, then nonce ‖ ciphertext ‖ tag. */
export const BINARY_MAGIC = new Uint8Array([0x41, 0x4c, 0x01]); // "AL", version 1
/** A vault key locked for one member: "g1." + epk + "." + salt + "." + sealed. */
export const GRANT_PREFIX = 'g1.';
/** An identity locked by a Recovery Key: "r1." + salt + "." + sealed. */
export const BACKUP_PREFIX = 'r1.';
/** Anything locked for one public key: "l1." + epk + "." + salt + "." + sealed. */
export const LOCK_PREFIX = 'l1.';

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const SALT_BYTES = 16;
const RECOVERY_BYTES = 16;

export class VaultCryptoError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'VaultCryptoError';
    this.code = code;
  }
}

// ─── Bytes ──────────────────────────────────────────────────────

/** A copy backed by a plain ArrayBuffer, as WebCrypto's types want. */
function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new VaultCryptoError('bad_encoding', 'This is not base64url.');
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

// ─── Where a sealed item belongs (the associated data) ───────────

const ID = /^[A-Za-z0-9_-]{1,64}$/;
function id(value: string, what: string): string {
  if (!ID.test(value)) throw new VaultCryptoError('bad_id', `${what} must be letters, digits, - or _.`);
  return value;
}
function version(value: number): string {
  if (!Number.isInteger(value) || value < 1) throw new VaultCryptoError('bad_version', 'A key version is a whole number from 1.');
  return String(value);
}

/** What one document holds, each sealed with its file key. */
export type DocumentPart = 'file' | 'name' | 'passages' | 'details';
/** What a vault holds outside its documents, each sealed with the vault key. */
export type VaultRecord = 'vault-name' | 'tree-links' | 'person' | 'emergency-card' | 'saved-chat' | 'note';

/**
 * The context every sealed item is bound to. Change one and it no longer
 * opens: that is what stops a server from moving or swapping items.
 */
export const context = {
  document: (vaultId: string, documentId: string, part: DocumentPart) =>
    `asklocker/v1/document/${part}/${id(vaultId, 'vaultId')}/${id(documentId, 'documentId')}`,
  fileKey: (vaultId: string, documentId: string, vaultKeyVersion: number) =>
    `asklocker/v1/file-key/${id(vaultId, 'vaultId')}/${id(documentId, 'documentId')}/${version(vaultKeyVersion)}`,
  record: (vaultId: string, kind: VaultRecord, recordId: string) =>
    `asklocker/v1/${kind}/${id(vaultId, 'vaultId')}/${id(recordId, 'recordId')}`,
  vaultKey: (vaultId: string, userId: string, vaultKeyVersion: number) =>
    `asklocker/v1/vault-key/${id(vaultId, 'vaultId')}/${id(userId, 'userId')}/${version(vaultKeyVersion)}`,
  identityBackup: (userId: string) => `asklocker/v1/identity-backup/${id(userId, 'userId')}`,
  /** An identity locked for a new device's one-time key, after "Approve". */
  deviceRequest: (userId: string, requestId: string) =>
    `asklocker/v1/device-request/${id(userId, 'userId')}/${id(requestId, 'requestId')}`,
  /** An identity sealed with the key a passkey gives (WebAuthn PRF). */
  passkeyUnlock: (userId: string) => `asklocker/v1/passkey-unlock/${id(userId, 'userId')}`,
  /** An identity sealed with this device's own key, to lock it for others later. */
  deviceKeep: (userId: string) => `asklocker/v1/device-keep/${id(userId, 'userId')}`,
  /** A person's own record outside any vault, locked for their own public key. */
  personal: (userId: string, kind: 'saved-chat', recordId: string) =>
    `asklocker/v1/personal/${kind}/${id(userId, 'userId')}/${id(recordId, 'recordId')}`,
};

// ─── Sealing ────────────────────────────────────────────────────

async function sealRaw(key: CryptoKey, data: Uint8Array, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  const nonce = randomBytes(NONCE_BYTES);
  const sealed = new Uint8Array(await subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(ctx) }, key, own(data)));
  const out = new Uint8Array(NONCE_BYTES + sealed.length);
  out.set(nonce);
  out.set(sealed, NONCE_BYTES);
  return out;
}

async function openRaw(key: CryptoKey, bytes: Uint8Array, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  if (bytes.length < NONCE_BYTES + TAG_BYTES) throw new VaultCryptoError('too_short', 'This sealed item is cut short.');
  try {
    return new Uint8Array(await subtle.decrypt(
      { name: 'AES-GCM', iv: own(bytes.subarray(0, NONCE_BYTES)), additionalData: encoder.encode(ctx) },
      key, own(bytes.subarray(NONCE_BYTES))));
  } catch {
    throw new VaultCryptoError('cannot_open', 'This could not be unlocked: the wrong key, the wrong place, or it was changed.');
  }
}

/** Seal bytes as text, for a database column. */
export async function seal(key: CryptoKey, data: Uint8Array, ctx: string): Promise<string> {
  return SEAL_PREFIX + toBase64Url(await sealRaw(key, data, ctx));
}

export async function open(key: CryptoKey, sealed: string, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!sealed.startsWith(SEAL_PREFIX)) throw new VaultCryptoError('unknown_format', 'This is not a sealed item AskLocker knows.');
  return openRaw(key, fromBase64Url(sealed.slice(SEAL_PREFIX.length)), ctx);
}

export async function sealText(key: CryptoKey, text: string, ctx: string): Promise<string> {
  return seal(key, encoder.encode(text), ctx);
}

export async function openText(key: CryptoKey, sealed: string, ctx: string): Promise<string> {
  return decoder.decode(await open(key, sealed, ctx));
}

export async function sealJson(key: CryptoKey, value: unknown, ctx: string): Promise<string> {
  return sealText(key, JSON.stringify(value), ctx);
}

export async function openJson<T = unknown>(key: CryptoKey, sealed: string, ctx: string): Promise<T> {
  return JSON.parse(await openText(key, sealed, ctx)) as T;
}

/** Seal a file's bytes as bytes (no base64), for Storage. */
export async function sealFile(key: CryptoKey, data: Uint8Array, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  const body = await sealRaw(key, data, ctx);
  const out = new Uint8Array(BINARY_MAGIC.length + body.length);
  out.set(BINARY_MAGIC);
  out.set(body, BINARY_MAGIC.length);
  return out;
}

export async function openFile(key: CryptoKey, sealed: Uint8Array, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  if (sealed.length < BINARY_MAGIC.length || BINARY_MAGIC.some((b, i) => sealed[i] !== b)) {
    throw new VaultCryptoError('unknown_format', 'This is not a sealed file AskLocker knows.');
  }
  return openRaw(key, sealed.subarray(BINARY_MAGIC.length), ctx);
}

// ─── Secret keys (vault keys and file keys) ─────────────────────

/** A new AES-256-GCM key. Extractable, so it can be locked for others. */
export async function newSecretKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** A file key as text: what a share link carries after its "#". */
export async function exportSecretKey(key: CryptoKey): Promise<string> {
  return toBase64Url(new Uint8Array(await subtle.exportKey('raw', key)));
}

export async function importSecretKey(text: string, extractable = false): Promise<CryptoKey> {
  const raw = fromBase64Url(text);
  if (raw.length !== 32) throw new VaultCryptoError('bad_key', 'A key is 32 bytes.');
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

/** Lock one secret key with another (a file key with the vault key). */
export async function wrapSecretKey(key: CryptoKey, wrappingKey: CryptoKey, ctx: string): Promise<string> {
  return seal(wrappingKey, new Uint8Array(await subtle.exportKey('raw', key)), ctx);
}

export async function unwrapSecretKey(sealed: string, wrappingKey: CryptoKey, ctx: string, extractable = false): Promise<CryptoKey> {
  const raw = await open(wrappingKey, sealed, ctx);
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

// ─── A member's identity ────────────────────────────────────────

const ECDH = { name: 'ECDH', namedCurve: 'P-256' } as const;
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' } as const;

export interface Identity {
  encrypt: CryptoKeyPair; // ECDH: vault keys are locked to its public half
  sign: CryptoKeyPair;    // ECDSA: invitations and grants are signed with it
}

/** What the server keeps and shows others: the two public keys, as SPKI. */
export interface PublicIdentity {
  encrypt: string;
  sign: string;
}

export async function newIdentity(): Promise<Identity> {
  const [encrypt, sign] = await Promise.all([
    subtle.generateKey(ECDH, true, ['deriveBits']),
    subtle.generateKey(ECDSA, true, ['sign', 'verify']),
  ]);
  return { encrypt, sign };
}

/**
 * The same identity with private halves that cannot be read out, for a
 * device to keep (IndexedDB stores a CryptoKey as it is). The extractable
 * one from newIdentity() is needed only once, to seal the Recovery Key
 * backup, and is then let go.
 */
export async function deviceCopy(identity: Identity): Promise<Identity> {
  const [ep, sp] = await Promise.all([
    subtle.exportKey('pkcs8', identity.encrypt.privateKey),
    subtle.exportKey('pkcs8', identity.sign.privateKey),
  ]);
  const [encryptPrivate, signPrivate] = await Promise.all([
    subtle.importKey('pkcs8', ep, ECDH, false, ['deriveBits']),
    subtle.importKey('pkcs8', sp, ECDSA, false, ['sign']),
  ]);
  return {
    encrypt: { privateKey: encryptPrivate, publicKey: identity.encrypt.publicKey },
    sign: { privateKey: signPrivate, publicKey: identity.sign.publicKey },
  };
}

export async function publicIdentity(identity: Identity): Promise<PublicIdentity> {
  const [encrypt, sign] = await Promise.all([
    subtle.exportKey('spki', identity.encrypt.publicKey),
    subtle.exportKey('spki', identity.sign.publicKey),
  ]);
  return { encrypt: toBase64Url(new Uint8Array(encrypt)), sign: toBase64Url(new Uint8Array(sign)) };
}

/**
 * A short fingerprint of a public identity. The app compares it in the
 * background (a member's own app checks the key the server lists for them is
 * theirs); nobody is asked to read it aloud.
 */
export async function identityFingerprint(pub: PublicIdentity): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', encoder.encode(`${pub.encrypt}.${pub.sign}`)));
  return toBase64Url(digest.subarray(0, 15));
}

// ─── Signatures ─────────────────────────────────────────────────

export async function signText(identity: Identity, text: string): Promise<string> {
  const signature = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.sign.privateKey, encoder.encode(text));
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyText(signPublic: string, text: string, signature: string): Promise<boolean> {
  try {
    const key = await subtle.importKey('spki', fromBase64Url(signPublic), ECDSA, false, ['verify']);
    return await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromBase64Url(signature), encoder.encode(text));
  } catch {
    return false;
  }
}

// ─── Locking a vault key for one member ─────────────────────────

async function grantKey(shared: ArrayBuffer, salt: Uint8Array<ArrayBuffer>, ctx: string): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode(ctx) },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/**
 * The vault key, locked so only `recipient` opens it: a fresh ephemeral ECDH
 * key with theirs, through HKDF bound to the vault, the member and the key's
 * version.
 */
export async function grantVaultKey(
  vaultKey: CryptoKey,
  recipient: PublicIdentity,
  where: { vaultId: string; userId: string; keyVersion: number },
): Promise<string> {
  const ctx = context.vaultKey(where.vaultId, where.userId, where.keyVersion);
  const theirs = await subtle.importKey('spki', fromBase64Url(recipient.encrypt), ECDH, false, []);
  // Not extractable: its public half exports anyway, its private half never
  // needs to leave this function.
  const ephemeral = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: theirs }, ephemeral.privateKey, 256);
  const salt = randomBytes(SALT_BYTES);
  const sealed = await seal(await grantKey(shared, salt, ctx), new Uint8Array(await subtle.exportKey('raw', vaultKey)), ctx);
  const epk = new Uint8Array(await subtle.exportKey('spki', ephemeral.publicKey));
  return `${GRANT_PREFIX}${toBase64Url(epk)}.${toBase64Url(salt)}.${sealed}`;
}

export async function openVaultKeyGrant(
  grant: string,
  me: Identity,
  where: { vaultId: string; userId: string; keyVersion: number },
  extractable = true,
): Promise<CryptoKey> {
  if (!grant.startsWith(GRANT_PREFIX)) throw new VaultCryptoError('unknown_format', 'This is not a vault key grant AskLocker knows.');
  const [epk, salt, ...rest] = grant.slice(GRANT_PREFIX.length).split('.');
  const sealed = rest.join('.');
  if (!epk || !salt || !sealed) throw new VaultCryptoError('unknown_format', 'This vault key grant is cut short.');
  const ctx = context.vaultKey(where.vaultId, where.userId, where.keyVersion);
  let shared: ArrayBuffer;
  try {
    const theirs = await subtle.importKey('spki', fromBase64Url(epk), ECDH, false, []);
    shared = await subtle.deriveBits({ name: 'ECDH', public: theirs }, me.encrypt.privateKey, 256);
  } catch {
    throw new VaultCryptoError('cannot_open', 'This vault key grant could not be unlocked.');
  }
  const raw = await open(await grantKey(shared, fromBase64Url(salt), ctx), sealed, ctx);
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

// ─── The Recovery Key ───────────────────────────────────────────

// Crockford's base32: no I, L, O or U, so nothing reads as something else.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

async function recoveryChecksum(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', own(bytes)));
  return CROCKFORD[digest[0] >>> 3] + CROCKFORD[digest[1] >>> 3];
}

/** A new Recovery Key: 128 random bits as "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX". */
export async function newRecoveryKey(): Promise<string> {
  return formatRecoveryKey(randomBytes(RECOVERY_BYTES));
}

export async function formatRecoveryKey(bytes: Uint8Array): Promise<string> {
  if (bytes.length !== RECOVERY_BYTES) throw new VaultCryptoError('bad_key', 'A Recovery Key holds 16 bytes.');
  const chars = base32(bytes) + (await recoveryChecksum(bytes));
  return chars.match(/.{4}/g)!.join('-');
}

/**
 * The 16 bytes behind a Recovery Key as someone typed it: any case, spaces or
 * dashes anywhere, O for 0 and I or L for 1. A mistyped character is caught
 * by the checksum and said in words.
 */
export async function parseRecoveryKey(typed: string): Promise<Uint8Array<ArrayBuffer>> {
  const chars = typed.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (chars.length !== 28 || [...chars].some((c) => !CROCKFORD.includes(c))) {
    throw new VaultCryptoError('not_a_recovery_key', 'A Recovery Key is 28 letters and numbers, in 7 groups of 4.');
  }
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of chars.slice(0, 26)) {
    value = (value << 5) | CROCKFORD.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const out = new Uint8Array(bytes);
  if (bits > 0 && (value & ((1 << bits) - 1)) !== 0) {
    throw new VaultCryptoError('recovery_key_typo', 'One of the characters is wrong. Check the Recovery Key and try again.');
  }
  if ((await recoveryChecksum(out)) !== chars.slice(26)) {
    throw new VaultCryptoError('recovery_key_typo', 'One of the characters is wrong. Check the Recovery Key and try again.');
  }
  return out;
}

async function recoveryWrappingKey(typed: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  // 128 random bits need no slow password hash: HKDF is the right tool.
  const base = await subtle.importKey('raw', await parseRecoveryKey(typed), 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('asklocker/v1/recovery-key') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

interface IdentityPayload {
  v: 1;
  encryptPrivate: string; // PKCS#8
  encryptPublic: string;  // SPKI
  signPrivate: string;    // PKCS#8
  signPublic: string;     // SPKI
}

/**
 * The identity as text, private halves included. Only ever sealed straight
 * away (a backup, a passkey, a new device, this device's own copy); the
 * private halves must be extractable.
 */
export async function exportIdentity(identity: Identity): Promise<string> {
  const [ep, epub, sp, spub] = await Promise.all([
    subtle.exportKey('pkcs8', identity.encrypt.privateKey),
    subtle.exportKey('spki', identity.encrypt.publicKey),
    subtle.exportKey('pkcs8', identity.sign.privateKey),
    subtle.exportKey('spki', identity.sign.publicKey),
  ]);
  const payload: IdentityPayload = {
    v: 1,
    encryptPrivate: toBase64Url(new Uint8Array(ep)),
    encryptPublic: toBase64Url(new Uint8Array(epub)),
    signPrivate: toBase64Url(new Uint8Array(sp)),
    signPublic: toBase64Url(new Uint8Array(spub)),
  };
  return JSON.stringify(payload);
}

/** The identity back from exportIdentity(). Private halves extractable only if asked. */
export async function importIdentity(text: string, extractable = false): Promise<Identity> {
  let p: IdentityPayload;
  try {
    p = JSON.parse(text) as IdentityPayload;
  } catch {
    throw new VaultCryptoError('unknown_format', 'These keys could not be read.');
  }
  if (p?.v !== 1) throw new VaultCryptoError('unknown_format', 'These keys are from a newer AskLocker.');
  const [encryptPrivate, encryptPublic, signPrivate, signPublic] = await Promise.all([
    subtle.importKey('pkcs8', fromBase64Url(p.encryptPrivate), ECDH, extractable, ['deriveBits']),
    subtle.importKey('spki', fromBase64Url(p.encryptPublic), ECDH, true, []),
    subtle.importKey('pkcs8', fromBase64Url(p.signPrivate), ECDSA, extractable, ['sign']),
    subtle.importKey('spki', fromBase64Url(p.signPublic), ECDSA, true, ['verify']),
  ]);
  return {
    encrypt: { privateKey: encryptPrivate, publicKey: encryptPublic },
    sign: { privateKey: signPrivate, publicKey: signPublic },
  };
}

/** The identity sealed with a secret key (a passkey's, this device's own). */
export async function sealIdentityWithKey(identity: Identity, key: CryptoKey, ctx: string): Promise<string> {
  return sealText(key, await exportIdentity(identity), ctx);
}

export async function openIdentityWithKey(sealed: string, key: CryptoKey, ctx: string, extractable = false): Promise<Identity> {
  return importIdentity(await openText(key, sealed, ctx), extractable);
}

/**
 * The identity, locked with the Recovery Key, for the server to keep. Bound
 * to the account it belongs to, so one person's backup cannot be served to
 * another.
 */
export async function sealIdentity(identity: Identity, recoveryKey: string, userId: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await recoveryWrappingKey(recoveryKey, salt);
  return `${BACKUP_PREFIX}${toBase64Url(salt)}.${await sealIdentityWithKey(identity, key, context.identityBackup(userId))}`;
}

/**
 * The identity back from its backup and the Recovery Key. Private keys come
 * back non-extractable unless asked: a device keeps them, never hands them on.
 */
export async function openIdentity(backup: string, recoveryKey: string, userId: string, extractable = false): Promise<Identity> {
  if (!backup.startsWith(BACKUP_PREFIX)) throw new VaultCryptoError('unknown_format', 'This is not an identity backup AskLocker knows.');
  const [salt, ...rest] = backup.slice(BACKUP_PREFIX.length).split('.');
  const sealed = rest.join('.');
  if (!salt || !sealed) throw new VaultCryptoError('unknown_format', 'This identity backup is cut short.');
  const key = await recoveryWrappingKey(recoveryKey, fromBase64Url(salt));
  return openIdentityWithKey(sealed, key, context.identityBackup(userId), extractable);
}

// ─── Locking for one public key (a new device, a person's own records) ──

/** A fresh ECDH key pair whose private half cannot be read out: a new device's one-time key. */
export async function newRequestKeyPair(): Promise<CryptoKeyPair> {
  return subtle.generateKey(ECDH, false, ['deriveBits']);
}

/** A public key as text (SPKI, base64url), as the server keeps it. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  return toBase64Url(new Uint8Array(await subtle.exportKey('spki', key)));
}

/**
 * Bytes locked so that only the holder of `recipientPublic`'s private half
 * opens them: a fresh ephemeral ECDH key, HKDF bound to `ctx`.
 */
export async function lockForPublicKey(recipientPublic: string, data: Uint8Array, ctx: string): Promise<string> {
  const theirs = await subtle.importKey('spki', fromBase64Url(recipientPublic), ECDH, false, []);
  const ephemeral = await subtle.generateKey(ECDH, false, ['deriveBits']);
  const shared = await subtle.deriveBits({ name: 'ECDH', public: theirs }, ephemeral.privateKey, 256);
  const salt = randomBytes(SALT_BYTES);
  const sealed = await seal(await grantKey(shared, salt, ctx), data, ctx);
  const epk = new Uint8Array(await subtle.exportKey('spki', ephemeral.publicKey));
  return `${LOCK_PREFIX}${toBase64Url(epk)}.${toBase64Url(salt)}.${sealed}`;
}

export async function unlockWithPrivateKey(locked: string, privateKey: CryptoKey, ctx: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!locked.startsWith(LOCK_PREFIX)) throw new VaultCryptoError('unknown_format', 'This is not something AskLocker locked.');
  const [epk, salt, ...rest] = locked.slice(LOCK_PREFIX.length).split('.');
  const sealed = rest.join('.');
  if (!epk || !salt || !sealed) throw new VaultCryptoError('unknown_format', 'This is cut short.');
  let shared: ArrayBuffer;
  try {
    const theirs = await subtle.importKey('spki', fromBase64Url(epk), ECDH, false, []);
    shared = await subtle.deriveBits({ name: 'ECDH', public: theirs }, privateKey, 256);
  } catch {
    throw new VaultCryptoError('cannot_open', 'This could not be unlocked.');
  }
  return open(await grantKey(shared, fromBase64Url(salt), ctx), sealed, ctx);
}

export async function lockTextForPublicKey(recipientPublic: string, text: string, ctx: string): Promise<string> {
  return lockForPublicKey(recipientPublic, encoder.encode(text), ctx);
}

export async function unlockTextWithPrivateKey(locked: string, privateKey: CryptoKey, ctx: string): Promise<string> {
  return decoder.decode(await unlockWithPrivateKey(locked, privateKey, ctx));
}

/**
 * Six digits from a public key, "123 456", shown on both devices when one
 * approves the other. A server that swapped the key would change them.
 */
export async function pairingCode(publicKey: string): Promise<string> {
  const digest = new Uint8Array(await subtle.digest('SHA-256', encoder.encode(`asklocker/v1/pairing/${publicKey}`)));
  const n = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const code = String(n % 1_000_000).padStart(6, '0');
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

// ─── Keys from the phone's lock, and this device's own ──────────

/**
 * The key a passkey gives (WebAuthn PRF: 32 bytes the authenticator derives
 * from its secret and our salt), through HKDF, to seal the identity. The
 * output itself never leaves the device.
 */
export async function keyFromPasskey(prfOutput: ArrayBuffer | Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const bytes = prfOutput instanceof Uint8Array ? own(prfOutput) : new Uint8Array(prfOutput);
  if (bytes.length < 32) throw new VaultCryptoError('bad_key', 'The phone gave too short a key.');
  const base = await subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: own(salt), info: encoder.encode('asklocker/v1/passkey-unlock') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Random bytes for a passkey's PRF input, or anything else. */
export function newSalt(bytes = 32): Uint8Array<ArrayBuffer> {
  return randomBytes(bytes);
}

/** A key that never leaves this device (IndexedDB keeps it as it is). */
export async function newDeviceKey(): Promise<CryptoKey> {
  return subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
