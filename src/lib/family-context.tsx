import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth';
import { fetchUserFamilies, fetchFamilyMembers, ensurePersonalVault } from './api';
import { isPersonalVault } from './vaults';
import { storageGet, storageSet, accountKey } from './storage';
import type { Database, FamilyMemberWithUser, FamilyWithMembership } from './database.types';

type Family = Database['public']['Tables']['families']['Row'];

/**
 * Family or Business: the drawer's switch. It is the open vault's kind, so
 * nothing else can disagree with it; the personal vault is Family's.
 */
export type AppMode = 'family' | 'business';

export const modeOf = (family: Partial<Pick<Family, 'kind'>> | null | undefined): AppMode =>
  family?.kind === 'business' ? 'business' : 'family';

interface FamilyContextType {
  currentFamily: Family | null;
  /** Every vault this person is in: their personal vault (046) and their families, oldest first. */
  families: FamilyWithMembership[];
  membership: FamilyWithMembership | null;
  members: FamilyMemberWithUser[];
  loading: boolean;
  needsFamily: boolean;
  refreshFamilies: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  /** Show another of the user's families. Remembered on this device. */
  switchFamily: (familyId: string) => void;
  /** Family or Business: the open vault's kind. */
  mode: AppMode;
  /** The vaults of that mode: a business's in Business; the personal vault and families in Family. */
  modeVaults: FamilyWithMembership[];
  /** Open the vault last open in that mode, or its first. False when there is none (no business yet). */
  setMode: (mode: AppMode) => boolean;
}

const FamilyContext = createContext<FamilyContextType>({
  currentFamily: null,
  families: [],
  membership: null,
  members: [],
  loading: true,
  needsFamily: false,
  refreshFamilies: async () => {},
  refreshMembers: async () => {},
  switchFamily: () => {},
  mode: 'family',
  modeVaults: [],
  setMode: () => false,
});

const selectionKey = accountKey.family;

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState<FamilyWithMembership[]>([]);
  const [members, setMembers] = useState<FamilyMemberWithUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The family this person chose, while they still belong to it; otherwise
  // the one they have been in longest (fetchUserFamilies is oldest first).
  // Never "the newest": an admin can add anyone who has an account, and that
  // must not change which vault they see and upload into.
  const membership = families.find((f) => f.family_id === selectedId) ?? families[0] ?? null;
  const currentFamily = membership?.families ?? null;
  const needsFamily = fetched && !!user && families.length === 0;

  // The vault last open in each mode, so the switch goes back to it.
  const [lastByMode, setLastByMode] = useState<Partial<Record<AppMode, string>>>({});

  const switchFamily = useCallback((familyId: string) => {
    setSelectedId(familyId);
    if (!user) return;
    storageSet(selectionKey(user.id), familyId);
    const kind = families.find((f) => f.family_id === familyId)?.families;
    if (kind) {
      setLastByMode((prev) => {
        const next = { ...prev, [modeOf(kind)]: familyId };
        storageSet(accountKey.modeVaults(user.id), JSON.stringify(next));
        return next;
      });
    }
  }, [user?.id, families]);

  const mode = modeOf(currentFamily);
  const modeVaults = families.filter((f) => modeOf(f.families) === mode);

  const setMode = useCallback((next: AppMode): boolean => {
    if (next === mode) return true;
    const inMode = families.filter((f) => modeOf(f.families) === next);
    if (!inMode.length) return false;
    const remembered = inMode.find((f) => f.family_id === lastByMode[next]);
    // In Family mode, a family before the personal vault: it is what "family" means.
    const pick = remembered ?? inMode.find((f) => !isPersonalVault(f.families)) ?? inMode[0];
    switchFamily(pick.family_id);
    return true;
  }, [mode, families, lastByMode, switchFamily]);

  // Lazy fetch — only loads when explicitly called
  const refreshFamilies = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchUserFamilies(user.id);
      setFamilies(data);
    } catch (_) {
      // silently handle — family is optional
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [user]);

  const refreshMembers = useCallback(async () => {
    if (!currentFamily) return;
    try {
      const data = await fetchFamilyMembers(currentFamily.id);
      setMembers(data);
    } catch (_) {
      // silently handle
    }
  }, [currentFamily?.id]);

  // Auto-fetch families when user is available (silently, non-blocking)
  useEffect(() => {
    if (!user) {
      setFamilies([]);
      setMembers([]);
      setFetched(false);
      setSelectedId(null);
      return;
    }
    // Fetch silently on login — the remembered choice first, so screens never
    // load the default family only to switch a moment later.
    setLastByMode({});
    storageGet(accountKey.modeVaults(user.id))
      .then((raw) => { try { if (raw) setLastByMode(JSON.parse(raw)); } catch { /* a bad value: start again */ } })
      .catch(() => {});
    storageGet(selectionKey(user.id))
      .then((id) => setSelectedId(id))
      .then(() => fetchUserFamilies(user.id))
      .then((data) => setFamilies(data))
      .catch(() => {})
      .finally(() => setFetched(true));
  }, [user?.id]);

  // Every account has a personal vault (046): made the first time the app
  // sees someone without one, once a session. It is their newest membership,
  // so it never becomes the vault an existing family member sees by itself;
  // for someone in no family it is the only one. Where 046 is not applied
  // the call finds no function, and the app carries on with families only.
  const ensured = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !fetched || ensured.current === user.id) return;
    ensured.current = user.id;
    if (families.some((f) => isPersonalVault(f.families))) return;
    ensurePersonalVault()
      .then((id) => (id ? fetchUserFamilies(user.id).then(setFamilies) : undefined))
      .catch(() => {});
  }, [user?.id, fetched, families]);

  // Load members when current family changes
  useEffect(() => {
    if (!currentFamily) {
      setMembers([]);
      return;
    }

    fetchFamilyMembers(currentFamily.id)
      .then(setMembers)
      .catch(() => {});
  }, [currentFamily?.id]);

  return (
    <FamilyContext.Provider
      value={{
        currentFamily,
        families,
        membership,
        members,
        loading,
        needsFamily,
        refreshFamilies,
        refreshMembers,
        switchFamily,
        mode,
        modeVaults,
        setMode,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);
