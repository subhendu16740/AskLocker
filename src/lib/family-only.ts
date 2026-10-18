// Screens that belong to a family (051): the family tree, a person's page
// and emergency cards. A business has none of them; opened there anyway (a
// link, a refresh, a vault switched underneath), the screen goes to Manage
// team instead.

import { useEffect } from 'react';
import { router } from 'expo-router';
import { useFamily } from './family-context';
import { isBusinessVault } from './vaults';

/** Sends a business away from a family-only screen. True while it does. */
export function useFamilyOnly(): boolean {
  const { currentFamily } = useFamily();
  const business = isBusinessVault(currentFamily);
  useEffect(() => {
    if (business) router.replace('/family' as any);
  }, [business]);
  return business;
}
