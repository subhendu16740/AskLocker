// Locked vaults (071): the database calls, nothing else. What is sealed and
// opened is done on the device (vault-keys.web.ts, vault-lock.web.ts); these
// only carry what the server is allowed to hold. docs/end-to-end-encryption.md.
//
// Every call that needs 071 answers 'unavailable' (or nothing) where it is
// not applied, as the app does for every migration (CLAUDE.md, Order of
// operations).

import { supabase } from './supabase';

/** 071 not applied: the table or function is not there. (api.ts has the same; not imported, to keep this module free of it.) */
function isMissingMigration(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return !!e && (e.code === '42P01' || e.code === '42883' || e.code === 'PGRST202' || e.code === 'PGRST205' || e.code === 'PGRST204'
    || /does not exist|could not find the (table|function)|schema cache/i.test(e.message ?? ''));
}

// ─── The switch ──────────────────────────────────────────────────

/** May vaults be locked on this project (e2e_config, 071)? False where 071 is missing. */
export async function fetchLockingAllowed(): Promise<boolean> {
  const { data, error } = await (supabase as any).from('e2e_config').select('locking_allowed').maybeSingle();
  if (error) return false;
  return Boolean(data?.locking_allowed);
}

// ─── A vault's keys ──────────────────────────────────────────────

export interface VaultKeyMember {
  userId: string;
  name: string;
  role: string;
  encryptPublic: string | null;
  signPublic: string | null;
  fingerprint: string | null;
  identityVersion: number | null;
  /** The key versions they hold, locked for their current keys. */
  versions: number[];
  /** Their keys changed since an earlier grant here: only an admin lets them back in. */
  needsApproval: boolean;
}

export interface VaultKeyStatus {
  locked: boolean;
  allowed: boolean;
  lockedAt: string | null;
  movedAt: string | null;
  latestVersion: number;
  /** Someone who left still holds the latest key: a new version is due. */
  needsNewKey: boolean;
  members: VaultKeyMember[];
}

export async function fetchVaultKeyStatus(familyId: string): Promise<VaultKeyStatus | 'unavailable'> {
  const { data, error } = await (supabase as any).rpc('vault_key_status', { p_family_id: familyId });
  if (error) {
    if (isMissingMigration(error)) return 'unavailable';
    throw error;
  }
  const d = data as Record<string, any>;
  return {
    locked: Boolean(d?.locked),
    allowed: Boolean(d?.allowed),
    lockedAt: d?.locked_at ?? null,
    movedAt: d?.moved_at ?? null,
    latestVersion: Number(d?.latest_version ?? 0),
    needsNewKey: Boolean(d?.needs_new_key),
    members: (Array.isArray(d?.members) ? d.members : []).map((m: Record<string, any>) => ({
      userId: m.user_id,
      name: m.name ?? 'Someone',
      role: m.role ?? 'viewer',
      encryptPublic: m.encrypt_public ?? null,
      signPublic: m.sign_public ?? null,
      fingerprint: m.fingerprint ?? null,
      identityVersion: m.identity_version ?? null,
      versions: Array.isArray(m.versions) ? m.versions.map(Number) : [],
      needsApproval: Boolean(m.needs_approval),
    })),
  };
}

/** The ids of the locked vaults the signed-in person is in. Empty where 071 is missing. */
export async function fetchLockedVaultIds(): Promise<string[]> {
  const { data, error } = await (supabase as any).from('locked_vaults').select('family_id');
  if (error) return [];
  return (data ?? []).map((r: { family_id: string }) => r.family_id);
}

export interface MyGrant {
  version: number;
  identityVersion: number;
  grant: string;
}

/** The caller's own locked copies of a vault's keys, one a version. */
export async function fetchMyGrants(familyId: string): Promise<MyGrant[]> {
  const { data, error } = await (supabase as any)
    .from('vault_key_grants')
    .select('version, identity_version, key_grant')
    .eq('family_id', familyId);
  if (error) {
    if (isMissingMigration(error)) return [];
    throw error;
  }
  return (data ?? []).map((r: any) => ({ version: r.version, identityVersion: r.identity_version, grant: r.key_grant }));
}

export async function lockVaultRpc(familyId: string, grant: string): Promise<void> {
  const { error } = await (supabase as any).rpc('lock_vault', { p_family_id: familyId, p_grant: grant });
  if (error) throw error;
}

export async function addVaultKeyVersionRpc(familyId: string, version: number, grant: string): Promise<void> {
  const { error } = await (supabase as any).rpc('add_vault_key_version', { p_family_id: familyId, p_version: version, p_grant: grant });
  if (error) throw error;
}

export async function grantVaultKeyRpc(
  familyId: string, version: number, member: string, identityVersion: number, grant: string,
): Promise<void> {
  const { error } = await (supabase as any).rpc('grant_vault_key', {
    p_family_id: familyId,
    p_version: version,
    p_member: member,
    p_identity_version: identityVersion,
    p_grant: grant,
  });
  if (error) throw error;
}

// ─── Sealed documents ────────────────────────────────────────────

export interface SealedDocumentRow {
  family_id: string;
  document_id: string;
  key_version: number;
  file_key: string;
  details: string;
  passages?: string | null;
  passage_count: number;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

const SEALED_LIGHT = 'family_id, document_id, key_version, file_key, details, passage_count, added_by, created_at, updated_at';

/** A vault's sealed documents: names and details, and the passages too when asked. */
export async function fetchSealedDocuments(
  familyId: string, opts: { withPassages?: boolean; documentIds?: string[] } = {},
): Promise<SealedDocumentRow[]> {
  const all: SealedDocumentRow[] = [];
  const PAGE = opts.withPassages ? 40 : 500;
  for (let from = 0; from < 20000; from += PAGE) {
    let q = (supabase as any)
      .from('sealed_documents')
      .select(opts.withPassages ? `${SEALED_LIGHT}, passages` : SEALED_LIGHT)
      .eq('family_id', familyId)
      .order('document_id')
      .range(from, from + PAGE - 1);
    if (opts.documentIds?.length) q = q.in('document_id', opts.documentIds);
    const { data, error } = await q;
    if (error) {
      if (isMissingMigration(error)) return [];
      throw error;
    }
    all.push(...((data ?? []) as SealedDocumentRow[]));
    if ((data ?? []).length < PAGE) break;
  }
  return all;
}

export interface InsertSealed {
  familyId: string;
  documentId: string;
  fileType: string;
  fileSizeBytes: number;
  storagePath: string;
  categoryId?: string | null;
  belongsToMember?: string | null;
  keyVersion: number;
  fileKey: string;
  details: string;
  passages: string | null;
  passageCount: number;
}

export async function insertSealedDocument(p: InsertSealed): Promise<string> {
  const { data, error } = await (supabase as any).rpc('insert_sealed_document', {
    p_family_id: p.familyId,
    p_document_id: p.documentId,
    p_file_type: p.fileType,
    p_file_size_bytes: p.fileSizeBytes,
    p_storage_path: p.storagePath,
    p_category_id: p.categoryId ?? null,
    p_belongs_to_member: p.belongsToMember ?? null,
    p_key_version: p.keyVersion,
    p_file_key: p.fileKey,
    p_details: p.details,
    p_passages: p.passages,
    p_passage_count: p.passageCount,
  });
  if (error) throw error;
  return data as string;
}

export async function sealExistingDocumentRpc(p: {
  familyId: string; documentId: string; storagePath: string; keyVersion: number;
  fileKey: string; details: string; passages: string | null; passageCount: number;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('seal_existing_document', {
    p_family_id: p.familyId,
    p_document_id: p.documentId,
    p_storage_path: p.storagePath,
    p_key_version: p.keyVersion,
    p_file_key: p.fileKey,
    p_details: p.details,
    p_passages: p.passages,
    p_passage_count: p.passageCount,
  });
  if (error) throw error;
  return data as string;
}

export async function updateSealedDetailsRpc(familyId: string, documentId: string, details: string): Promise<void> {
  const { error } = await (supabase as any).rpc('update_sealed_details', {
    p_family_id: familyId, p_document_id: documentId, p_details: details,
  });
  if (error) throw error;
}

export async function finishVaultMove(familyId: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc('finish_vault_move', { p_family_id: familyId });
  if (error) throw error;
  return Number(data ?? 0);
}

/** Sealed parts whose document is gone go too. Best effort. */
export async function sweepSealedDocuments(familyId: string): Promise<void> {
  await (supabase as any).rpc('sealed_documents_sweep', { p_family_id: familyId });
}

// ─── A person's keys: the phone lock, new devices, new keys ──────

export interface KeyUnlockRow {
  id: string;
  credentialId: string;
  prfSalt: string;
  sealedIdentity: string;
  identityVersion: number;
  label: string | null;
  createdAt: string;
}

export async function fetchKeyUnlocks(): Promise<KeyUnlockRow[]> {
  const { data, error } = await (supabase as any)
    .from('key_unlocks')
    .select('id, credential_id, prf_salt, sealed_identity, identity_version, label, created_at')
    .order('created_at');
  if (error) {
    if (isMissingMigration(error)) return [];
    throw error;
  }
  return (data ?? []).map((r: any) => ({
    id: r.id, credentialId: r.credential_id, prfSalt: r.prf_salt, sealedIdentity: r.sealed_identity,
    identityVersion: r.identity_version, label: r.label, createdAt: r.created_at,
  }));
}

export async function addKeyUnlockRpc(credentialId: string, prfSalt: string, sealedIdentity: string, label: string): Promise<void> {
  const { error } = await (supabase as any).rpc('add_key_unlock', {
    p_credential_id: credentialId, p_prf_salt: prfSalt, p_sealed_identity: sealedIdentity, p_label: label,
  });
  if (error) throw error;
}

export async function removeKeyUnlockRpc(id: string): Promise<void> {
  const { error } = await (supabase as any).rpc('remove_key_unlock', { p_id: id });
  if (error) throw error;
}

export interface DeviceRequestRow {
  id: string;
  requestKey: string;
  label: string | null;
  createdAt: string;
  expiresAt: string;
  answered: boolean;
}

export async function fetchMyDeviceRequests(): Promise<DeviceRequestRow[]> {
  const { data, error } = await (supabase as any)
    .from('key_device_requests')
    .select('id, request_key, label, created_at, expires_at, answered_at')
    .order('created_at');
  if (error) {
    if (isMissingMigration(error)) return [];
    throw error;
  }
  return (data ?? []).map((r: any) => ({
    id: r.id, requestKey: r.request_key, label: r.label, createdAt: r.created_at,
    expiresAt: r.expires_at, answered: Boolean(r.answered_at),
  }));
}

export async function requestDeviceKeysRpc(requestKey: string, label: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('request_device_keys', { p_request_key: requestKey, p_label: label });
  if (error) throw error;
  return data as string;
}

export async function answerDeviceRequestRpc(id: string, answer: string): Promise<void> {
  const { error } = await (supabase as any).rpc('answer_device_request', { p_id: id, p_answer: answer });
  if (error) throw error;
}

export async function takeDeviceAnswerRpc(id: string): Promise<string | null> {
  const { data, error } = await (supabase as any).rpc('take_device_answer', { p_id: id });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function cancelDeviceRequestRpc(id: string): Promise<void> {
  await (supabase as any).rpc('cancel_device_request', { p_id: id });
}

export async function replaceMyIdentityRpc(encryptPublic: string, signPublic: string, fingerprint: string): Promise<number> {
  const { data, error } = await (supabase as any).rpc('replace_my_identity', {
    p_encrypt_public: encryptPublic, p_sign_public: signPublic, p_fingerprint: fingerprint, p_backup: null,
  });
  if (error) throw error;
  return Number(data);
}
