// Settings › Security › Encryption keys — test builds only (end-to-end
// encryption, Phase 1; docs/end-to-end-encryption.md). Nothing is encrypted
// yet: this sets up the keys that later phases lock documents with, shows
// the Recovery Key once, and unlocks a new device with it.

import { useCallback, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { isProduction } from '../../lib/environment';
import { longDate } from '../../lib/dates';
import {
  checkRecoveryKey, deleteKeysEverywhere, forgetKeysOnThisDevice, keysErrorText, loadKeysState,
  prepareKeys, prepareNewRecoveryKey, unlockWithRecoveryKey,
  type KeysState, type PreparedKeys,
} from '../../lib/vault-keys';
import { ScreenHeader } from '../../components/screen-header';
import {
  Card, CardTitle, Body, Muted, Field, PrimaryButton, SecondaryButton, DangerButton, Status, screenStyles,
} from '../../components/settings-ui';
import { radius, space, type } from '../../constants/design';

type Note = { kind: 'ok' | 'error'; text: string } | null;

/** "abcd…" in groups of four, so a key's id can be compared by eye. */
function groups(text: string, count = 3): string {
  return (text.match(/.{1,4}/g) ?? []).slice(0, count).join(' ');
}

export default function EncryptionKeysScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<KeysState | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  // A Recovery Key being shown, waiting for "I've saved it".
  const [showing, setShowing] = useState<{ keys: PreparedKeys; isNew: boolean } | null>(null);
  const [confirmTail, setConfirmTail] = useState('');
  const [typed, setTyped] = useState('');
  const [oldTyped, setOldTyped] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setState(await loadKeysState(userId));
    } catch (err) {
      setNote({ kind: 'error', text: keysErrorText(err) });
    }
  }, [userId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await action();
    } catch (err) {
      setNote({ kind: 'error', text: keysErrorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const tail = showing ? showing.keys.recoveryKey.slice(-4) : '';
  const tailMatches = confirmTail.trim().toUpperCase() === tail;

  const copyKey = async () => {
    if (!showing) return;
    try {
      await navigator.clipboard.writeText(showing.keys.recoveryKey);
      setNote({ kind: 'ok', text: 'Copied. Paste it into your password manager now.' });
    } catch {
      setNote({ kind: 'error', text: "Couldn't copy. Write it down instead." });
    }
  };

  if (isProduction || Platform.OS !== 'web') {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="Encryption keys" fallback="/settings/security" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Card><Body>Not available here yet.</Body></Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Encryption keys" fallback="/settings/security" />
      <ScrollView contentContainerStyle={screenStyles.body} keyboardShouldPersistTaps="handled">
        <Muted>Test builds only. Nothing is encrypted yet.</Muted>
        {note && <Status kind={note.kind}>{note.text}</Status>}

        {state === null && <Card><Muted>Checking your keys…</Muted></Card>}

        {state?.kind === 'unsupported' && <Card><Body>{state.reason}</Body></Card>}
        {state?.kind === 'unavailable' && <Card><Body>Encryption keys aren't switched on yet.</Body></Card>}

        {/* A Recovery Key, shown once */}
        {showing && (
          <Card>
            <CardTitle icon="key">Your Recovery Key</CardTitle>
            <View style={styles.keyBox}>
              <Text selectable style={styles.keyText} accessibilityLabel={`Recovery Key: ${showing.keys.recoveryKey.split('').join(' ')}`}>
                {showing.keys.recoveryKey}
              </Text>
            </View>
            <Body>Save it in your password manager or write it down. Nobody at AskLocker can see it or give it back.</Body>
            <SecondaryButton label="Copy" icon="copy" onPress={copyKey} />
            <Field
              label="Type its last 4 characters"
              value={confirmTail}
              onChangeText={setConfirmTail}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={4}
            />
            <PrimaryButton
              label="I've saved it"
              icon="check"
              disabled={!tailMatches}
              busy={busy}
              onPress={() => run(async () => {
                await showing.keys.commit();
                setNote({ kind: 'ok', text: showing.isNew ? 'Your new Recovery Key is saved. The old one no longer works.' : 'Your keys are set up on this device.' });
                setShowing(null);
                setConfirmTail('');
                setOldTyped('');
                await refresh();
              })}
            />
            <SecondaryButton label="Cancel" onPress={() => { setShowing(null); setConfirmTail(''); }} />
          </Card>
        )}

        {!showing && state?.kind === 'none' && userId && (
          <Card>
            <CardTitle icon="lock">Set up your keys</CardTitle>
            <Body>Your keys will lock your documents on your devices. You'll get a Recovery Key to save.</Body>
            <PrimaryButton
              label="Set up keys"
              icon="key"
              busy={busy}
              onPress={() => run(async () => setShowing({ keys: await prepareKeys(userId), isNew: false }))}
            />
          </Card>
        )}

        {!showing && state?.kind === 'locked' && userId && (
          <Card>
            <CardTitle icon="unlock">Unlock this device</CardTitle>
            <Body>Your keys are set up. Type your Recovery Key to use them here.</Body>
            <Field
              label="Recovery Key"
              value={typed}
              onChangeText={setTyped}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            />
            <PrimaryButton
              label="Unlock"
              icon="unlock"
              disabled={!typed.trim()}
              busy={busy}
              onPress={() => run(async () => {
                await unlockWithRecoveryKey(userId, typed);
                setTyped('');
                setNote({ kind: 'ok', text: 'Your keys are on this device now.' });
                await refresh();
              })}
            />
          </Card>
        )}

        {!showing && state?.kind === 'mismatch' && userId && (
          <Card>
            <CardTitle icon="alert-triangle">These keys don't match</CardTitle>
            <Body>This device holds other keys than your account's. Forget them here, then unlock with your Recovery Key.</Body>
            <DangerButton
              label="Forget keys on this device"
              icon="x-circle"
              busy={busy}
              onPress={() => run(async () => { await forgetKeysOnThisDevice(userId); await refresh(); })}
            />
          </Card>
        )}

        {!showing && state?.kind === 'ready' && userId && (
          <>
            <Card>
              <CardTitle icon="check-circle">Keys ready on this device</CardTitle>
              <Muted>Key ID {groups(state.server.fingerprint)}</Muted>
              <Muted>Set up {longDate(new Date(state.server.createdAt))}</Muted>
            </Card>

            <Card>
              <CardTitle icon="key">Check your Recovery Key</CardTitle>
              <Body>Make sure the one you saved still works.</Body>
              <Field
                label="Recovery Key"
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <SecondaryButton
                label="Check"
                disabled={!typed.trim() || busy}
                onPress={() => run(async () => {
                  const ok = await checkRecoveryKey(userId, typed);
                  setNote(ok
                    ? { kind: 'ok', text: 'That Recovery Key works.' }
                    : { kind: 'error', text: "That Recovery Key doesn't open your keys." });
                })}
              />
            </Card>

            <Card>
              <CardTitle icon="refresh-cw">New Recovery Key</CardTitle>
              <Body>Type your current one. The new one replaces it.</Body>
              <Field
                label="Current Recovery Key"
                value={oldTyped}
                onChangeText={setOldTyped}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <SecondaryButton
                label="Make a new one"
                disabled={!oldTyped.trim() || busy}
                onPress={() => run(async () => setShowing({ keys: await prepareNewRecoveryKey(userId, oldTyped), isNew: true }))}
              />
            </Card>

            <Card>
              <CardTitle icon="smartphone">This device</CardTitle>
              <Body>Forget the keys here. Your Recovery Key brings them back.</Body>
              <SecondaryButton
                label="Forget keys on this device"
                disabled={busy}
                onPress={() => run(async () => { await forgetKeysOnThisDevice(userId); await refresh(); })}
              />
            </Card>
          </>
        )}

        {!showing && userId && state && (state.kind === 'ready' || state.kind === 'locked' || state.kind === 'mismatch') && (
          <Card>
            <CardTitle icon="trash-2">Delete my keys</CardTitle>
            <Body>For testing. Deletes your keys from your account and this device.</Body>
            {confirmDelete ? (
              <>
                <DangerButton
                  label="Yes, delete my keys"
                  icon="trash-2"
                  busy={busy}
                  onPress={() => run(async () => {
                    await deleteKeysEverywhere(userId);
                    setConfirmDelete(false);
                    setNote({ kind: 'ok', text: 'Your keys are deleted.' });
                    await refresh();
                  })}
                />
                <SecondaryButton label="Cancel" onPress={() => setConfirmDelete(false)} />
              </>
            ) : (
              <DangerButton label="Delete my keys" icon="trash-2" onPress={() => setConfirmDelete(true)} />
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyBox: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: radius.control,
    padding: space.md,
    backgroundColor: '#F3F4F6',
  },
  keyText: {
    ...type.label,
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: 'monospace' }),
    letterSpacing: 1,
    textAlign: 'center',
  },
});
