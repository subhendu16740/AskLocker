import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth';
import { fetchUserFamilies, fetchFamilyMembers, ensurePersonalVault, fetchUseFor, saveUses, type UseFor } from './api';
import { isBusinessVault, isPersonalVault } from './vaults';
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

export const otherMode = (mode: AppMode): AppMode => (mode === 'family' ? 'business' : 'family');

/**
 * Family or Business first, and whether the other one too: what a person
 * answers after signing up (welcome.tsx) and can change in Settings › Your
 * vaults. AskLocker opens in the first; the drawer has the Family | Business
 * switch only with both (the owner's ask, 19 October 2026).
 */
export type Uses = { primary: AppMode; both: boolean };

/** The choice as the sign-in account's metadata keeps it (saveUses()), or null before one is made. */
export const usesOf = (meta: Record<string, unknown> | null | undefined): Uses | null => {
  const primary = meta?.primary_mode;
  return primary === 'family' || primary === 'business' ? { primary, both: meta?.both_modes === true } : null;
};

/** This device's copy, as setUses() writes it: { primary, both }. */
const parseUses = (raw: string | null): Uses | null => {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return v?.primary === 'family' || v?.primary === 'business' ? { primary: v.primary, both: v.both === true } : null;
  } catch {
    return null;
  }
};

/** The vault a mode opens at: the one last open there, else (in Family) a family before the personal vault. */
function pickInMode(list: FamilyWithMembership[], mode: AppMode, last: Partial<Record<AppMode, string>>) {
  const inMode = list.filter((f) => modeOf(f.families) === mode);
  return inMode.find((f) => f.family_id === last[mode]) ?? inMode.find((f) => !isPersonalVault(f.families)) ?? inMode[0] ?? null;
}

// Right after signing up, an account is new for this long: the welcome
// questions are asked at once, before its vaults are known.
const NEW_ACCOUNT_MS = 15 * 60 * 1000;

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
  /** The vaults of the other mode: nothing of theirs is shown in this one (notifications, documents). */
  otherModeVaultIds: string[];
  /**
   * Family or Business first, and the other too: what the person chose, or,
   * for someone who never did, what their vaults and Home's older question
   * (users.use_for, 051) suggest.
   */
  uses: Uses;
  /** Whether the person chose (the welcome questions, Settings › Your vaults). */
  usesChosen: boolean;
  /** A new account that has not answered the welcome questions yet: the app asks them first. */
  needsWelcome: boolean;
  /** The drawer's Family | Business switch: with both on, or while in the other mode, to get back. */
  showModeSwitch: boolean;
  /** Keep a new choice, on the account and on this device; turning the other mode off leaves it. */
  setUses: (uses: Uses) => Promise<void>;
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
  otherModeVaultIds: [],
  uses: { primary: 'family', both: false },
  usesChosen: false,
  needsWelcome: false,
  showModeSwitch: false,
  setUses: async () => {},
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

  // Family or Business first: chosen just now, else the account's (every
  // device has it at sign-in), else this device's copy of a choice the
  // account has not taken yet (made offline). Home's older answer (051) only
  // for someone who never chose.
  const [chosen, setChosen] = useState<Uses | null>(null);
  const [deviceUses, setDeviceUses] = useState<Uses | null>(null);
  const [olderAnswer, setOlderAnswer] = useState<UseFor | 'skipped' | null | undefined>(undefined);
  const explicitUses = chosen ?? usesOf(user?.user_metadata) ?? deviceUses;

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
  const otherModeVaultIds = families.filter((f) => modeOf(f.families) !== mode).map((f) => f.family_id);

  const setMode = useCallback((next: AppMode): boolean => {
    if (next === mode) return true;
    const pick = pickInMode(families, next, lastByMode);
    if (!pick) return false;
    switchFamily(pick.family_id);
    return true;
  }, [mode, families, lastByMode, switchFamily]);

  // Someone who never chose: their older answer, else their vaults, say it.
  const inBusiness = families.some((f) => isBusinessVault(f.families));
  const inFamily = families.some((f) => !isBusinessVault(f.families) && !isPersonalVault(f.families));
  const uses: Uses = explicitUses ?? (
    olderAnswer === 'both' ? { primary: 'family', both: true }
      : olderAnswer === 'business' ? { primary: 'business', both: inFamily }
        : olderAnswer === 'family' ? { primary: 'family', both: inBusiness }
          : { primary: inBusiness && !inFamily ? 'business' : 'family', both: inBusiness && inFamily });
  const showModeSwitch = uses.both || mode !== uses.primary;

  // A new account (046 gave it a personal vault and nothing else) that has
  // not answered the welcome questions. Right after signing up that is known
  // at once, from when the account was made; for an older one, once its
  // vaults and Home's older answer are in.
  const onlyPersonal = families.every((f) => isPersonalVault(f.families));
  const madeJustNow = !!user && Date.now() - Date.parse(user.created_at) < NEW_ACCOUNT_MS;
  const needsWelcome = !!user && !explicitUses && onlyPersonal
    && (madeJustNow || (fetched && (olderAnswer === null || olderAnswer === 'skipped')));

  const setUses = useCallback(async (next: Uses) => {
    if (!user) return;
    setChosen(next);
    storageSet(accountKey.uses(user.id), JSON.stringify(next));
    // The other mode turned off while in it: back to the first.
    if (!next.both && mode !== next.primary) setMode(next.primary);
    await saveUses(user.id, next.primary, next.both);
  }, [user?.id, mode, setMode]);

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
    const accountUses = usesOf(user.user_metadata);
    setChosen(null);
    setOlderAnswer(undefined);
    setDeviceUses(null);
    // A choice this device kept because the account could not take it then
    // (offline): offered to the account again.
    storageGet(accountKey.uses(user.id))
      .then((raw) => {
        const here = parseUses(raw);
        setDeviceUses(here);
        if (here && !accountUses) saveUses(user.id, here.primary, here.both).catch(() => {});
      })
      .catch(() => {});
    if (!accountUses) fetchUseFor(user.id).then(setOlderAnswer).catch(() => setOlderAnswer(null));
    // The remembered vault and families together, so screens never load the
    // default family only to switch a moment later. AskLocker opens in the
    // person's first mode (the welcome questions), at the vault last open
    // there; without one, where they last were.
    setLastByMode({});
    Promise.all([storageGet(selectionKey(user.id)), storageGet(accountKey.modeVaults(user.id))])
      .then(async ([remembered, rawLast]) => {
        let last: Partial<Record<AppMode, string>> = {};
        try { if (rawLast) last = JSON.parse(rawLast); } catch { /* a bad value: start again */ }
        setLastByMode(last);
        const data = await fetchUserFamilies(user.id);
        const primary = accountUses?.primary;
        const there = data.find((f) => f.family_id === remembered);
        const landing = !primary || (there && modeOf(there.families) === primary)
          ? remembered
          : pickInMode(data, primary, last)?.family_id ?? remembered;
        setFamilies(data);
        setSelectedId(landing);
      })
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
        otherModeVaultIds,
        uses,
        usesChosen: !!explicitUses,
        needsWelcome,
        showModeSwitch,
        setUses,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export const useFamily = () => useContext(FamilyContext);
