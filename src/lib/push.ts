// Reminders on this device, in the phone app (migration 075): notifications
// through Google's Firebase Cloud Messaging, sent by our own push function
// straight to FCM with the project's Firebase service account. The phone
// gives an FCM token, which is saved for the signed-in person
// (save_fcm_token, from auth.uid()); push.web.ts is the web app's Web Push.
//
// Android only for now. An iPhone app would need Apple's push service (APNs)
// as well, which is not set up, so it says it can't show them. A build made
// without Firebase (no google-services.json) cannot get a token and says
// they aren't ready; every reminder is still under the bell.

import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';
import { isMissingMigration } from './api';
import type { PushResult, PushStatus, TestResult } from './push-types';

export type { PushResult, PushStatus, TestResult };

/** The channel every reminder goes to; the server names it too (_shared/fcm.ts). */
const CHANNEL = 'reminders';

const NOT_READY = "Reminders on this phone aren't available yet.";
const BLOCKED =
  'Notifications are off for AskLocker. Turn them on in your phone\'s Settings, under Apps, AskLocker, Notifications.';
const UNSUPPORTED = "This app can't show notifications here yet. They still show under the bell.";

/** Where a tap may go: the notification lists, nothing else. */
const TAP_PATHS = new Set(['/notifications', '/settings/notifications']);

// While AskLocker is open a notification still shows, as it would closed.
if (Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const supported = () => Platform.OS === 'android';

/** "AskLocker on Pixel 8": how this phone is named in the list of devices. */
function deviceLabel(): string {
  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ').trim();
  return `AskLocker on ${model || 'an Android phone'}`.slice(0, 80);
}

/** The reminders channel, made before asking: Android 13 asks only once one exists. */
async function ensureChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Reminders',
    description: 'Documents about to expire, birthdays and invitations',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** This phone's FCM token, or null where the build has no Firebase set-up. */
async function fcmToken(): Promise<string | null> {
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    return typeof token.data === 'string' && token.data ? token.data : null;
  } catch {
    return null;
  }
}

/**
 * The push function's own set-up (034's `key`): it leaves its address for
 * the hourly clock, which then calls it for every device, phones included.
 * 'not-ready' where the function or the migration is missing.
 */
async function serverReady(): Promise<boolean | 'not-ready'> {
  const { error } = await supabase.functions.invoke('push', { body: { action: 'key' } });
  if (!error) return true;
  const status = (error as { context?: Response })?.context?.status;
  if (status === 404 || status === 503) return 'not-ready';
  throw new Error("Couldn't reach AskLocker. Try again.");
}

export async function loadPushStatus(): Promise<PushStatus> {
  if (!supported()) return 'unsupported';
  const permission = await Notifications.getPermissionsAsync().catch(() => null);
  if (permission && permission.status === 'denied' && !permission.canAskAgain) return 'blocked';
  const token = await fcmToken();
  if (!token) return 'not-ready';
  if (!permission || permission.status !== 'granted') return 'off';
  // On for this account? Someone else may have turned it on on this phone.
  const { data, error } = await supabase.from('push_subscriptions').select('id').eq('endpoint', token).maybeSingle();
  if (error && isMissingMigration(error)) return 'not-ready';
  return !error && data ? 'on' : 'off';
}

export async function turnOnPush(): Promise<PushResult> {
  if (!supported()) return { ok: false, message: UNSUPPORTED };
  await ensureChannel();
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.status !== 'granted') {
    return {
      ok: false,
      message: asked.canAskAgain ? 'To get reminders, allow notifications when your phone asks.' : BLOCKED,
    };
  }

  const token = await fcmToken();
  if (!token) return { ok: false, message: NOT_READY };
  if ((await serverReady()) === 'not-ready') return { ok: false, message: NOT_READY };

  const { error } = await supabase.rpc('save_fcm_token', { p_token: token, p_label: deviceLabel() });
  if (error) {
    if (isMissingMigration(error)) return { ok: false, message: NOT_READY };
    if (error.code === '22023' || error.code === '23514') return { ok: false, message: error.message };
    throw new Error(error.message);
  }
  return { ok: true };
}

export async function turnOffPush(): Promise<void> {
  if (!supported()) return;
  const token = await fcmToken();
  if (!token) return;
  // The row first, while signed in; then the phone lets the token go, so it
  // can never be used again. A new one is made when turned on again.
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', token);
  await Notifications.unregisterForNotificationsAsync().catch(() => undefined);
  if (error && !isMissingMigration(error)) throw new Error(error.message);
}

/** On sign-out: this phone stops getting the account's notifications. Never stops the sign-out. */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    await turnOffPush();
  } catch {
    // Signing out goes ahead regardless.
  }
}

export async function sendTestPush(): Promise<TestResult> {
  const { data, error } = await supabase.functions.invoke('push', { body: { action: 'test' } });
  if (error) throw new Error("Couldn't send a test. Try again.");
  return { devices: data?.devices ?? 0, sent: data?.sent ?? 0 };
}

/**
 * A tap on a notification opens Notifications — also the tap that started
 * AskLocker, once `ready` (signed in, the screens mounted). Mounted once,
 * in the root layout.
 */
export function useNotificationTaps(ready: boolean): void {
  const [wanted, setWanted] = useState<string | null>(null);

  useEffect(() => {
    if (!supported()) return undefined;
    let seen: string | null = null;
    const take = (response: Notifications.NotificationResponse | null | undefined) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      if (seen === id) return;
      seen = id;
      const url = response.notification.request.content.data?.url;
      setWanted(typeof url === 'string' && TAP_PATHS.has(url) ? url : '/notifications');
    };
    Notifications.getLastNotificationResponseAsync().then(take).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(take);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready || !wanted) return;
    setWanted(null);
    router.push(wanted as any);
  }, [ready, wanted]);
}
