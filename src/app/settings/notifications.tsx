// Settings › Notifications — whether you see notifications at all, and
// whether this device shows them as notifications on the phone or computer
// (Web Push, migration 034), even when AskLocker is closed. The reminders
// themselves are made on the server either way, for every member: 90, 30
// and 7 days before a document expires, and on the day.
//
// Off hides the bell's count and the list, and sends nothing to devices;
// nothing is deleted, so switching back on shows them again.
//
// Birthdays (035) is its own switch: on the morning of a birthday in the
// family tree, the server reminds everyone who has it on.

import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, View, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferences } from '../../lib/preferences';
import { loadPushStatus, turnOnPush, turnOffPush, sendTestPush, type PushStatus } from '../../lib/push';
import { ScreenHeader } from '../../components/screen-header';
import {
  Card, CardTitle, Body, Muted, OnOff, PrimaryButton, SecondaryButton, Status, screenStyles,
} from '../../components/settings-ui';
import { color, space } from '../../constants/design';
import { useVaultTheme } from '../../lib/vault-theme';
import { plusName } from '../../lib/plans';
import { usePaidPlan } from '../../lib/family-plan';
import { PlusTag } from '../../components/screen-header';

const DEVICE_TEXT: Record<Exclude<PushStatus, 'on' | 'off'>, string> = {
  unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.",
  'needs-home-screen':
    'On iPhone or iPad, tap Share, then Add to Home Screen. Open AskLocker from there and turn this on.',
  blocked: 'Your browser blocks these. Allow them in its site settings.',
  'not-ready': 'Not ready yet. Alerts still show under the bell.',
};

export default function NotificationSettingsScreen() {
  // Settings follows the mode, Family or Business (the drawer's switch).
  const theme = useVaultTheme();
  const { notificationsEnabled, setNotificationsEnabled, birthdayReminders, setBirthdayReminders, birthdaysAvailable } = usePreferences();
  // On Free there are no birthday reminders (064); unknown shows the switch.
  const paid = usePaidPlan();
  const onWeb = Platform.OS === 'web';
  const [device, setDevice] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null);
  const [news, setNews] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useFocusEffect(useCallback(() => {
    if (!onWeb) return undefined;
    let cancelled = false;
    loadPushStatus()
      .then((s) => { if (!cancelled) setDevice(s); })
      .catch(() => { if (!cancelled) setDevice('off'); });
    return () => { cancelled = true; };
  }, [onWeb]));

  const act = async (kind: 'on' | 'off' | 'test', work: () => Promise<void>) => {
    setBusy(kind);
    setNews(null);
    try {
      await work();
    } catch (err: any) {
      setNews({ kind: 'error', text: err?.message || 'Something went wrong. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const turnOn = () => act('on', async () => {
    const result = await turnOnPush();
    if (result.ok) {
      setDevice('on');
      setNews({ kind: 'ok', text: 'On for this device. Send a test to see one.' });
    } else {
      setNews({ kind: 'error', text: result.message });
      setDevice(await loadPushStatus().catch(() => 'off' as const));
    }
  });

  const turnOff = () => act('off', async () => {
    await turnOffPush();
    setDevice('off');
    setNews({ kind: 'ok', text: "Off for this device. You'll still see them under the bell." });
  });

  const test = () => act('test', async () => {
    const result = await sendTestPush();
    setNews(result.sent > 0
      ? { kind: 'ok', text: result.sent === 1 ? 'Sent. It should arrive in a few seconds.' : `Sent to your ${result.sent} devices. It should arrive in a few seconds.` }
      : { kind: 'error', text: "Couldn't reach this device. Turn it off and on, then send another test." });
  });

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Notifications" fallback="/settings" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        <Card>
          <CardTitle icon="bell">Show notifications</CardTitle>
          <OnOff value={notificationsEnabled} onChange={setNotificationsEnabled} label="Show notifications" />
          <Body>
            {notificationsEnabled
              ? 'New alerts show under the bell on Home.'
              : 'Nothing shows and nothing is sent.'}
          </Body>
        </Card>

        {onWeb && (
          <Card>
            <CardTitle icon="smartphone">On this device</CardTitle>
            {device === null ? (
              <ActivityIndicator color={theme.primary} />
            ) : device === 'on' ? (
              <>
                <Body>This device gets alerts, even when AskLocker is closed.</Body>
                {!notificationsEnabled && <Muted>Turned off above, so nothing is sent.</Muted>}
                <View style={styles.buttons}>
                  <SecondaryButton label="Send a test" icon="send" onPress={test} disabled={busy !== null} />
                  <SecondaryButton label="Turn off" icon="bell-off" onPress={turnOff} disabled={busy !== null} />
                </View>
              </>
            ) : device === 'off' ? (
              <>
                <Body>Get alerts here, even when AskLocker is closed.</Body>
                <PrimaryButton label="Turn on" icon="bell" onPress={turnOn} busy={busy === 'on'} disabled={busy !== null} />
              </>
            ) : (
              <Body>{DEVICE_TEXT[device]}</Body>
            )}
            {!!news && <Status kind={news.kind}>{news.text}</Status>}
          </Card>
        )}

        <Card>
          <CardTitle icon="gift">Birthdays</CardTitle>
          {paid === false ? (
            // Birthday reminders are part of Family Plus and Pro (064).
            <>
              <PlusTag link />
              <Body>A reminder on each birthday in your family tree comes with {plusName(theme.business)}.</Body>
            </>
          ) : birthdaysAvailable ? (
            <>
              <OnOff value={birthdayReminders} onChange={setBirthdayReminders} label="Birthday reminders" />
              <Body>
                {birthdayReminders
                  ? 'A reminder on each birthday in your family tree.'
                  : 'No birthday reminders.'}
              </Body>
              <Muted>If someone has passed away, an admin can remove their birth date.</Muted>
            </>
          ) : (
            <Muted>Birthday reminders aren't ready yet.</Muted>
          )}
        </Card>

        <Card>
          <CardTitle icon="info">What you get</CardTitle>
          <Body>• {theme.business ? 'Records' : 'Documents'} about to expire (★ {plusName(theme.business)})</Body>
          <Body>• Birthdays (★ {plusName(theme.business)})</Body>
          <Body>• Invitations</Body>
          <Muted>Between 8 am and 10 pm, India time.</Muted>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: space.sm },
});
