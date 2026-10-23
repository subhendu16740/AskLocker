// The agreement (062) on this device, before anyone has signed in. The
// fourth step of the intro (onboarding.tsx) asks for it, and the login screen
// sends anyone back there until this device has agreed to the current
// version. A tick before signing in belongs to nobody yet, so it waits here,
// "pending", and the first account to sign in within the hour records it as
// theirs (agreement-screen.tsx). Anyone else signing in later sees the card
// after sign-in instead, so nobody's agreement is recorded from someone
// else's tick.

import { deviceKey, storageGet, storageSet } from './storage';
import { AGREEMENT_VERSION } from '../../supabase/functions/_shared/agreement';

export type DeviceAgreement = { version: string; at: string; pending: boolean };

/** How long a tick before signing in waits for an account to record it. */
const PENDING_FOR_MS = 60 * 60 * 1000;

export async function readDeviceAgreement(): Promise<DeviceAgreement | null> {
  try {
    const kept = JSON.parse((await storageGet(deviceKey.agreement)) ?? 'null');
    return kept && typeof kept.version === 'string' ? kept : null;
  } catch {
    return null;
  }
}

/** This device has agreed to the current version: pending, before signing in; not, after. */
export async function agreeOnThisDevice(pending: boolean, at = new Date().toISOString()): Promise<void> {
  await storageSet(deviceKey.agreement, JSON.stringify({ version: AGREEMENT_VERSION, at, pending }));
}

/** Has anyone agreed to the current version on this device? The login screen asks. */
export async function deviceAgreedToCurrent(): Promise<boolean> {
  return (await readDeviceAgreement())?.version === AGREEMENT_VERSION;
}

/** The tick before signing in, while the account signing in may still take it as theirs. */
export function pendingTick(kept: DeviceAgreement | null): DeviceAgreement | null {
  if (!kept?.pending || kept.version !== AGREEMENT_VERSION) return null;
  const age = Date.now() - Date.parse(kept.at);
  return age >= 0 && age < PENDING_FOR_MS ? kept : null;
}
