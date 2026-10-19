// What Home's three counts (Documents | Members | Categories) and the three
// tabs of All documents count, in one place so the two always agree (the
// owner's ask, 18 October 2026: each count opens the same screen, at its tab).
//
// Documents and categories are the open mode's vaults together. People are
// one vault's members: the open vault when it is shared, else the mode's
// first shared vault (a family, or a business), else the open one (a
// personal vault: only you).

import { isPersonalVault } from './vaults';
import type { FamilyDocumentRow, FamilyWithMembership } from './database.types';

/** The tabs of All documents, and what each Home count opens. */
export type DocumentsTab = 'documents' | 'people' | 'categories';

export function isDocumentsTab(value: unknown): value is DocumentsTab {
  return value === 'documents' || value === 'people' || value === 'categories';
}

/** The vault whose people Home counts and the Family (or Team) tab lists. */
export function peopleVault(
  open: { id: string } | null | undefined,
  modeVaults: FamilyWithMembership[],
): FamilyWithMembership | null {
  const current = modeVaults.find((v) => v.family_id === open?.id) ?? null;
  if (current && !isPersonalVault(current.families)) return current;
  return modeVaults.find((v) => !isPersonalVault(v.families)) ?? current ?? modeVaults[0] ?? null;
}

export const NO_CATEGORY = 'none';

/** A document's category, as a key: its id (its name if it has no id), or NO_CATEGORY. */
export function categoryKey(doc: Pick<FamilyDocumentRow, 'category_id' | 'category_name'>): string {
  if (doc.category_id) return String(doc.category_id);
  return doc.category_name ? `name:${doc.category_name}` : NO_CATEGORY;
}

export interface CategoryGroup {
  key: string;
  name: string;
  count: number;
}

/** Each category among the documents, with how many: most first, uncategorised last. */
export function categoryGroups(docs: Pick<FamilyDocumentRow, 'category_id' | 'category_name'>[]): CategoryGroup[] {
  const groups = new Map<string, CategoryGroup>();
  for (const d of docs) {
    const key = categoryKey(d);
    const group = groups.get(key) ?? { key, name: key === NO_CATEGORY ? 'No category' : d.category_name || 'Other', count: 0 };
    group.count++;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) =>
    (a.key === NO_CATEGORY ? 1 : 0) - (b.key === NO_CATEGORY ? 1 : 0) || b.count - a.count || a.name.localeCompare(b.name));
}

/** How many categories the documents are filed under (uncategorised is not one). */
export function categoryCount(docs: Pick<FamilyDocumentRow, 'category_id' | 'category_name'>[]): number {
  return new Set(docs.map(categoryKey).filter((k) => k !== NO_CATEGORY)).size;
}
