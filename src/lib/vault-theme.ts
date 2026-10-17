// Which colours a vault wears (Family or Business mode). A business has its
// own (design.ts's biz), so the app looks different in Business mode — the
// top bar, the drawer, buttons, the Ask button — and a business vault looks
// like one wherever it is listed, whichever mode is open.

import { useFamily } from './family-context';
import { isBusinessVault } from './vaults';
import { biz, color } from '../constants/design';
import type { Database } from './database.types';

type FamilyRow = Database['public']['Tables']['families']['Row'];

export interface VaultTheme {
  business: boolean;
  primary: string;
  secondary: string;
  tint: string;
  /** For a gradient: dark to light. */
  gradient: readonly [string, string];
}

export const FAMILY_THEME: VaultTheme = {
  business: false,
  primary: color.primary,
  secondary: color.secondary,
  tint: color.tint,
  gradient: [color.primary, color.secondary],
};

export const BUSINESS_THEME: VaultTheme = {
  business: true,
  primary: biz.primary,
  secondary: biz.secondary,
  tint: biz.tint,
  gradient: [biz.primary, biz.secondary],
};

/** A vault's colours: a business's, or the family's (a personal vault too). */
export function vaultTheme(family: Partial<Pick<FamilyRow, 'kind'>> | null | undefined): VaultTheme {
  return isBusinessVault(family) ? BUSINESS_THEME : FAMILY_THEME;
}

/** The colours of the mode the app is in: the open vault's. */
export function useVaultTheme(): VaultTheme {
  const { currentFamily } = useFamily();
  return vaultTheme(currentFamily);
}
