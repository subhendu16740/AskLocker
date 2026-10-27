// ─── Is the family on Family Plus? ──────────────────────────────
//
// Starred features (★, <PlusTag />) are for Family Plus families: today
// expiry reminders and the Reminders page (048), Import from Gmail,
// questions after each person's 20 a month (a family's 250 a month since
// 067), more members, and share links that last 30 days (049); reading
// documents in Indian languages (Plus and up since 067). Voice is on every
// plan, in any language (066). For a free family, tapping
// one opens /plus, which shows Free and Plus side by side, and the screens
// themselves send a free family there too (after a refresh, or from a link).
// Storage beyond the free 100 MB a person is kept by the server (038, 048,
// 067), the server makes one expiry reminder a document on Free and every
// stage for everyone only on Plus or Pro (067), birthdays only on a paid plan,
// and Gmail import refuses a free family on the server as well.
//
// A business (051) has its own plans, Plus, Pro and Enterprise, never Family Plus. Its ★
// features open the same /plus page, which shows a business its plans. Its
// plan ending closes adding (`closed`) instead of removing anything.
//
// The plan comes from family_storage_status() (038, 039), kept for a minute
// per family. When it cannot be read (before 038, or offline) nothing is
// gated here: the app never locks a family out because it could not ask.
// ────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth';
import { useFamily } from './family-context';
import { fetchPaymentsStatus, fetchQuestionStatus, fetchStorageStatus, type PaymentsStatus } from './api';
import { plansHaveIndianLanguages, type PlanName } from './plans';

/** What a starred feature is called in /plus?feature=… */
export type PlusFeature = 'reminders' | 'gmail' | 'storage' | 'voice' | 'questions' | 'members' | 'links' | 'birthdays' | 'languages';
/** What only a business's paid plans bring (056): the overview's lists, money in and out, reminders on notes. */
export type BusinessFeature = 'overview' | 'money' | 'notes';

interface KnownPlan {
  plan: PlanName | null;
  paidUntil: string | null;
  /** Plus has ended and the family is above the free limit: when the newest documents above it go (040). */
  removalAt: string | null;
  /** A business whose paid plan ended: it keeps every record and adds nothing until renewed (051). */
  closed: boolean;
  /** The plan running now was switched on for a demo (051). */
  trial: boolean;
  at: number;
}

const FRESH_MS = 60_000;
const known = new Map<string, KnownPlan>();

async function readPlan(familyId: string, force: boolean): Promise<KnownPlan> {
  const hit = known.get(familyId);
  if (hit && !force && Date.now() - hit.at < FRESH_MS) return hit;
  try {
    const status = await fetchStorageStatus(familyId);
    const fresh = {
      plan: status?.plan ?? null,
      paidUntil: status?.paidUntil ?? null,
      removalAt: status?.removalAt ?? null,
      closed: status?.closed === true,
      trial: status?.trial === true,
      at: Date.now(),
    };
    known.set(familyId, fresh);
    return fresh;
  } catch {
    return hit ?? { plan: null, paidUntil: null, removalAt: null, closed: false, trial: false, at: 0 };
  }
}

/**
 * Whether Family Plus can be bought here (044): the payments function's
 * answer, asked once per session. Null until it answers.
 */
export function usePaymentsStatus(): PaymentsStatus | null {
  const [status, setStatus] = useState<PaymentsStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPaymentsStatus().then((s) => { if (!cancelled) setStatus(s); });
    return () => { cancelled = true; };
  }, []);
  return status;
}

/** The page a free family sees instead of a starred feature. */
export function plusPage(feature?: PlusFeature | BusinessFeature): string {
  return feature ? `/plus?feature=${feature}` : '/plus';
}

/** The current family's plan; `isFree` only once it is known to be Free. */
export function useFamilyPlan() {
  const { currentFamily } = useFamily();
  const familyId = currentFamily?.id ?? null;
  const [plan, setPlan] = useState<KnownPlan | null>(() => (familyId ? known.get(familyId) ?? null : null));
  const [loading, setLoading] = useState(!plan && !!familyId);

  useEffect(() => {
    let cancelled = false;
    if (!familyId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    const hit = known.get(familyId) ?? null;
    setPlan(hit);
    setLoading(!hit);
    readPlan(familyId, false).then((fresh) => {
      if (!cancelled) { setPlan(fresh); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [familyId]);

  /** Asks again (force) or uses what is fresh, and returns the answer. */
  const refresh = useCallback(async (force = true): Promise<KnownPlan | null> => {
    if (!familyId) return null;
    const fresh = await readPlan(familyId, force);
    setPlan(fresh);
    setLoading(false);
    return fresh;
  }, [familyId]);

  /**
   * Where a tap on a starred feature should go: the feature, or /plus for a
   * free family. Waits for the plan if it is not known yet.
   */
  const routeFor = useCallback(async (feature: PlusFeature, route: string): Promise<string> => {
    const now = await refresh(false);
    return now?.plan === 'free' ? plusPage(feature) : route;
  }, [refresh]);

  return {
    plan: plan?.plan ?? null,
    paidUntil: plan?.paidUntil ?? null,
    removalAt: plan?.removalAt ?? null,
    closed: plan?.closed === true,
    trial: plan?.trial === true,
    isFree: plan?.plan === 'free',
    loading,
    refresh,
    routeFor,
  };
}

// ─── Am I on Family Plus? ───────────────────────────────────────
//
// A person is on Plus when any vault they are in is (049's person_on_plus()),
// and a ★ goes before their own name wherever the app shows it. Read from
// question_status(), which counts nothing, kept a minute and shared by every
// screen. Unknown (before 049, offline) shows no star. Only your own: whether
// another member is on Plus through some other family is not theirs to see.

let mine: { userId: string; plus: boolean; plans: string[] | null; at: number } | null = null;
const listeners = new Set<() => void>();

let asking: Promise<boolean | null> | null = null;

/** On a paid plan in any vault; null while the server cannot say (before 049, offline). */
async function readOnPlus(userId: string, force: boolean): Promise<boolean | null> {
  if (mine && mine.userId === userId && !force && Date.now() - mine.at < FRESH_MS) return mine.plus;
  // Every screen showing a name asks at once; one question answers them all.
  asking ??= (async () => {
    const status = await fetchQuestionStatus().catch(() => null);
    if (!status) return mine?.userId === userId ? mine.plus : null;
    mine = { userId, plus: status.plus, plans: status.plans ?? null, at: Date.now() };
    return status.plus;
  })().finally(() => { asking = null; });
  return asking;
}

/** Ask again everywhere: after a payment, or when the plan may have changed. */
export function forgetOnPlus() {
  mine = null;
  listeners.forEach((l) => l());
}

// ─── Am I on a paid plan here? ──────────────────────────────────
//
// The ★ after your own name follows the mode (the owner's ask, 18 October
// 2026): in Family mode, a family or personal vault of yours on Family Plus;
// in Business mode, a business of yours on a paid plan. A family's Family Plus
// never stars you in a business, nor a business plan in your family. Read
// from each of the mode's vaults' plans (kept a minute, shared with
// useFamilyPlan()); unknown shows no star.

const paidUp = (p: KnownPlan | null | undefined) => !!p?.plan && p.plan !== 'free' && !p.closed;

/** Is any vault of the open mode on a paid plan? False until known. */
export function useModeOnPlus(): boolean {
  const { modeVaults } = useFamily();
  const ids = modeVaults.map((v) => v.family_id).join(',');
  const [plus, setPlus] = useState(() => modeVaults.some((v) => paidUp(known.get(v.family_id))));

  useEffect(() => {
    const list = ids ? ids.split(',') : [];
    let cancelled = false;
    const read = (force: boolean) => {
      Promise.all(list.map((id) => readPlan(id, force))).then((plans) => { if (!cancelled) setPlus(plans.some(paidUp)); });
    };
    setPlus(list.some((id) => paidUp(known.get(id))));
    read(false);
    // After a payment (forgetOnPlus), ask again.
    const onForget = () => read(true);
    listeners.add(onForget);
    return () => { cancelled = true; listeners.delete(onForget); };
  }, [ids]);

  return plus;
}

/** Is the signed-in person on Family Plus, in any vault? False until known. */
export function useOnPlus(): boolean {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [plus, setPlus] = useState(() => !!userId && mine?.userId === userId && mine.plus);

  useEffect(() => {
    if (!userId) {
      setPlus(false);
      return;
    }
    let cancelled = false;
    const read = (force: boolean) => {
      readOnPlus(userId, force).then((p) => { if (!cancelled) setPlus(p === true); });
    };
    read(false);
    const onForget = () => read(true);
    listeners.add(onForget);
    return () => { cancelled = true; listeners.delete(onForget); };
  }, [userId]);

  return plus;
}

/**
 * Is the signed-in person on a paid plan in any vault: Family Plus, Family
 * Pro or a business plan? Null until known, and while the server cannot say
 * (before 049, offline), which gates nothing. Birthday reminders on Settings
 * follow it (064).
 */
export function usePaidPlan(): boolean | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [paid, setPaid] = useState<boolean | null>(() => (userId && mine?.userId === userId ? mine.plus : null));

  useEffect(() => {
    if (!userId) {
      setPaid(null);
      return;
    }
    let cancelled = false;
    const read = (force: boolean) => {
      readOnPlus(userId, force).then((p) => { if (!cancelled) setPaid(p); });
    };
    read(false);
    const onForget = () => read(true);
    listeners.add(onForget);
    return () => { cancelled = true; listeners.delete(onForget); };
  }, [userId]);

  return paid;
}

/**
 * May the signed-in person read documents in Indian languages (066)? Only on
 * Family Pro, or a business's Pro or Enterprise: question_status() lists the
 * person's plans. Before 066 it does not, and 064's rule holds (any paid
 * plan). Null until known, and while the server cannot say, which gates
 * nothing. Reading happens on the device, so this is the app's rule. Voice
 * is in any language on every plan.
 */
export function useIndianLanguages(): boolean | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const decide = () => {
    if (!userId || mine?.userId !== userId) return null;
    return mine.plans ? plansHaveIndianLanguages(mine.plans) : mine.plus;
  };
  const [allowed, setAllowed] = useState<boolean | null>(decide);

  useEffect(() => {
    if (!userId) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    const read = (force: boolean) => {
      readOnPlus(userId, force).then((p) => {
        if (cancelled) return;
        if (p == null) setAllowed(null);
        else setAllowed(mine?.userId === userId && mine.plans ? plansHaveIndianLanguages(mine.plans) : p);
      });
    };
    read(false);
    const onForget = () => read(true);
    listeners.add(onForget);
    return () => { cancelled = true; listeners.delete(onForget); };
  }, [userId]);

  return allowed;
}
