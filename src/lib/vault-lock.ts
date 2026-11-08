// Locked vaults — the phone app's stand-in. Locked vaults are on the web app
// only until EAS builds exist (vault-lock.web.ts): here nothing is locked,
// lists show rows as they are, and every action says to use the web app.

import type { VaultKeyMember } from './e2e-api';
import type { FamilyDocumentRow } from './database.types';
import type { RankedPassage } from './local-search';

export type { RankedPassage };

const NOT_HERE = 'Locked vaults need the web app for now.';

export class LockedVaultError extends Error {
  code = 'not_here';
}

export interface VaultTending {
  waitingForMe: boolean;
  needsApproval: VaultKeyMember[];
  admin: boolean;
}

export interface DocumentDetails {
  v: 1;
  name: string;
  fileType: string;
  mime: string;
  size: number;
  meta: { key: string; value: string }[];
  expiryDate: string | null;
  addedAt: string;
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

export interface ClientPassage {
  family_id: string;
  document_id: string;
  document_name: string;
  chunk_index: number;
  content: string;
  score: number;
}

export type LockProgress = (stage: 'reading' | 'searching' | 'locking', done: number, total: number) => void;

export async function lockedVaults(_force = false): Promise<Set<string>> {
  return new Set();
}
export function knownLocked(_familyId: string): boolean {
  return false;
}
export async function isLockedVault(_familyId: string): Promise<boolean> {
  return false;
}
export async function vaultKeys(_familyId: string, _force = false): Promise<Map<number, CryptoKey>> {
  throw new Error(NOT_HERE);
}
export async function lockVault(_familyId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function tendVault(_familyId: string): Promise<VaultTending | null> {
  return null;
}
export async function approveMember(_familyId: string, _memberId: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function sealedDetails(_familyId: string, _force = false): Promise<Map<string, DocumentDetails>> {
  return new Map();
}
export async function overlaySealed<T>(_familyId: string, rows: T[]): Promise<T[]> {
  return rows;
}
export async function documentDetails(_familyId: string, _documentId: string): Promise<DocumentDetails | null> {
  return null;
}
export async function openDocumentFile(_familyId: string, _documentId: string, _storagePath: string): Promise<{ blob: Blob; name: string; mime: string }> {
  throw new Error(NOT_HERE);
}
export async function documentFileKeyText(_familyId: string, _documentId: string): Promise<string> {
  throw new Error(NOT_HERE);
}
export async function openSharedFile(
  _signedUrl: string, _vaultId: string, _documentId: string, _keyText: string,
): Promise<{ blob: Blob; name: string; mime: string; fileType: string }> {
  throw new Error(NOT_HERE);
}
export async function renameLockedDocument(_familyId: string, _documentId: string, _name: string): Promise<void> {
  throw new Error(NOT_HERE);
}
export async function readOnDevice(
  _file: { bytes: Uint8Array; fileType: string; name: string; uri?: string }, _languages?: string[], _onProgress?: LockProgress,
): Promise<string> {
  throw new Error(NOT_HERE);
}
export async function sealDocument(_p: {
  familyId: string; storageNamespace: string; documentId?: string; fileName: string; fileType: string;
  mime: string; bytes: Uint8Array; text: string; onProgress?: LockProgress;
}): Promise<SealedNewDocument> {
  throw new Error(NOT_HERE);
}
export async function forgetLockedDocument(_familyId: string, _documentId: string): Promise<void> {}
export function forgetVaultIndex(_familyId: string): void {}
export async function searchLockedVaults(_familyIds: string[], _question: string, _limit = 15): Promise<ClientPassage[]> {
  return [];
}
export async function lockedExpiries(_familyId: string): Promise<{ documentId: string; name: string; expiryDate: string }[]> {
  return [];
}
export function mimeOf(_fileType: string): string {
  return 'application/octet-stream';
}
export async function moveOlderDocuments(
  _familyId: string, _storageNamespace: string, _languages: string[] | undefined,
  _onProgress?: (done: number, total: number, name: string) => void,
): Promise<{ moved: number; failed: { name: string; reason: string }[]; left: number }> {
  throw new Error(NOT_HERE);
}

export interface SealedChatEnvelope {
  role: 'sealed';
  text: '';
  rid: string;
  sealed: string;
  sources: { family_id: string }[];
}
export function isSealedChat(messages: unknown): messages is [SealedChatEnvelope] {
  return Array.isArray(messages) && (messages[0] as SealedChatEnvelope | undefined)?.role === 'sealed';
}
export async function sealChat<M>(_title: string, _messages: M[], _vaultIds: string[]): Promise<[SealedChatEnvelope]> {
  throw new Error(NOT_HERE);
}
export async function openChat<M>(_envelope: SealedChatEnvelope): Promise<{ title: string; messages: M[] }> {
  throw new Error(NOT_HERE);
}

// ─── A locked vault's name, tree, cards and notes (073) ──────────
// Nothing is locked in the phone app: names, trees, cards and notes are read
// and written as they are, and the sealing functions say to use the web app.

export const LOCKED_VAULT_NAME = 'Locked vault';
export const LOCKED_PERSON_NAME = 'Person';

export interface SealedPerson {
  v: 1;
  name: string;
  gender: 'female' | 'male' | null;
  birthDate: string | null;
  nickname: string | null;
}

export type SealedCard = Record<string, unknown> & { contacts?: unknown[] };

export function forgetVaultRecords(_familyId: string): void {}
export async function lockedVaultName(_familyId: string): Promise<string | null> {
  return null;
}
export async function overlayVaultNames<T extends { id: string; name: string }>(vaults: T[]): Promise<T[]> {
  return vaults;
}
export async function sealVaultName(_familyId: string, _name: string): Promise<void> {
  throw new LockedVaultError(NOT_HERE);
}
export async function openLockedTree<P>(_familyId: string, people: P[], links: import('../../supabase/functions/_shared/kinship').KinLink[]) {
  return { people, links };
}
export async function sealPerson(_familyId: string, _personId: string, _details: Omit<SealedPerson, 'v'>): Promise<void> {
  throw new LockedVaultError(NOT_HERE);
}
export async function addSealedPerson(_familyId: string, _details: Omit<SealedPerson, 'v'>): Promise<string> {
  throw new LockedVaultError(NOT_HERE);
}
export async function sealTreeLinks(_familyId: string, _links: unknown[]): Promise<void> {
  throw new LockedVaultError(NOT_HERE);
}
export async function lockedCards(_familyId: string): Promise<Map<string, SealedCard>> {
  return new Map();
}
export async function sealCard(_familyId: string, _personId: string, _card: SealedCard | null): Promise<void> {
  throw new LockedVaultError(NOT_HERE);
}
export function isSealedNote(body: string): boolean {
  return /^n1\./.test(body);
}
export async function sealNoteBody(_familyId: string, _text: string): Promise<string> {
  throw new LockedVaultError(NOT_HERE);
}
export async function openNoteBody(_familyId: string, body: string): Promise<string> {
  return isSealedNote(body) ? 'This note can be opened in the web app.' : body;
}
export async function moveVaultDetails(_familyId: string, _admin: boolean, _force = false): Promise<void> {}
export async function lockedOverview(
  _familyId: string,
  tier: 'free' | 'plus' | 'pro',
  _docs: Pick<FamilyDocumentRow, 'id' | 'file_name' | 'category_name' | 'created_at'>[],
): Promise<Record<string, unknown>> {
  return { tier, counts: {}, renewals: null, bills: null, money: null };
}
