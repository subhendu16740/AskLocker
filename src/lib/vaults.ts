// Vaults (046): a person's personal vault — a family of one, for them alone,
// that nobody else can be invited to or join — the families they are in,
// and (051) businesses. All of them are rows in `families`: `is_personal`
// says which is personal, `kind` which is a business (absent before 051:
// a family). Every screen names them through here, so the personal vault is
// called "Personal vault" everywhere, whatever its row is named, and a
// business is never called a family.

import type { Database, FamilyWithMembership } from './database.types';

type FamilyRow = Database['public']['Tables']['families']['Row'];

export const PERSONAL_VAULT_NAME = 'Personal vault';

export type VaultKind = 'family' | 'business';

export function isPersonalVault(family: Pick<FamilyRow, 'is_personal'> | null | undefined): boolean {
  return family?.is_personal === true;
}

/** A business vault (051). Before 051 the row has no kind: a family. */
export function isBusinessVault(family: Partial<Pick<FamilyRow, 'kind'>> | null | undefined): boolean {
  return family?.kind === 'business';
}

/** "family" or "business": the word for a vault in a sentence ("Leave the business?"). */
export function vaultWord(family: Partial<Pick<FamilyRow, 'kind'>> | null | undefined): VaultKind {
  return isBusinessVault(family) ? 'business' : 'family';
}

/** "Personal vault", or the family's or business's own name. */
export function vaultName(family: Pick<FamilyRow, 'is_personal' | 'name'> | null | undefined): string {
  if (!family) return 'Family';
  return isPersonalVault(family) ? PERSONAL_VAULT_NAME : family.name;
}

/** The Feather icon for a vault: a lock for your own, a briefcase for a business, people for a family. */
export function vaultIcon(family: Partial<Pick<FamilyRow, 'is_personal' | 'kind'>> | null | undefined): 'lock' | 'briefcase' | 'users' {
  if (family?.is_personal === true) return 'lock';
  return isBusinessVault(family) ? 'briefcase' : 'users';
}

/** The person's personal vault, and the vaults they share with others (families and businesses), oldest membership first. */
export function splitVaults(vaults: FamilyWithMembership[]): {
  personal: FamilyWithMembership | null;
  families: FamilyWithMembership[];
} {
  return {
    personal: vaults.find((v) => isPersonalVault(v.families)) ?? null,
    families: vaults.filter((v) => !isPersonalVault(v.families)),
  };
}

/** Who sees what is in it, for the line under a vault's name. */
export function vaultSubtitle(v: FamilyWithMembership): string {
  if (isPersonalVault(v.families)) return 'Yours alone';
  const word = isBusinessVault(v.families) ? 'Business' : 'Family';
  return v.role === 'admin' ? `${word} · you're an admin` : word;
}

/** Whether this person may delete a document: whoever added it (047), or any admin in a business (051). */
export function canDeleteDocument(
  v: Pick<FamilyWithMembership, 'role' | 'families'> | null | undefined,
  uploadedBy: string | null | undefined,
  userId: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (uploadedBy === userId) return true;
  return !!v && isBusinessVault(v.families) && v.role === 'admin';
}
