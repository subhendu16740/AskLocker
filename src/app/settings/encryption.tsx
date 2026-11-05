// Settings › Security › Encryption keys — test builds only (locked vaults;
// docs/end-to-end-encryption.md, "A person's keys"). The keys are made here
// without a screen; this shows the ways back to them on a new device: the
// phone's lock, another device, and an optional backup key.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { isProduction } from '../../lib/environment';
import { longDate } from '../../lib/dates';
import {
  addPhoneLock, approveDeviceRequest, checkRecoveryKey, deleteKeysEverywhere, ensureKeys, forgetKeysOnThisDevice,
  keysErrorText, makeNewKeys, pendingDeviceRequests, phoneLockSupported, prepareBackupKey, prepareNewRecoveryKey,
  removePhoneLock, startDeviceRequest, unlockWithPhoneLock, unlockWithRecoveryKey,
  type DeviceRequest, type KeysState, type PendingDevice, type PreparedKeys,
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

function downloadKey(recoveryKey: string) {
  const text = `AskLocker backup key\n\n${recoveryKey}\n\nKeep this safe. It opens your documents if you lose every phone.\n`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'AskLocker backup key.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printKey(recoveryKey: string) {
  const w = window.open('', '_blank', 'width=480,height=360');
  if (!w) return;
  w.document.write(`<!doctype html><title>AskLocker backup key</title><body style="font-family:system-ui;padding:32px">
<h2>AskLocker backup key</h2><p style="font:20px ui-monospace,monospace;letter-spacing:1px">${recoveryKey}</p>
<p>Keep this safe. It opens your documents if you lose every phone.</p></body>`);
  w.document.close();
  w.focus();
  w.print();
}

export default function EncryptionKeysScreen() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<KeysState | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [showing, setShowing] = useState<PreparedKeys | null>(null);
  const [typed, setTyped] = useState('');
  const [oldTyped, setOldTyped] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [lockOk, setLockOk] = useState(false);
  const [waiting, setWaiting] = useState<DeviceRequest | null>(null);
  const [pending, setPending] = useState<PendingDevice[]>([]);
  const waitingRef = useRef<DeviceRequest | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setState(await ensureKeys(userId));
    } catch (err) {
      setNote({ kind: 'error', text: keysErrorText(err) });
    }
  }, [userId]);

  useFocusEffect(useCallback(() => {
    refresh();
    phoneLockSupported().then(setLockOk);
  }, [refresh]));

  // New devices asking this one: looked for while the screen is open.
  useEffect(() => {
    if (state?.kind !== 'ready') return;
    let live = true;
    const look = () => pendingDeviceRequests().then((p) => live && setPending(p)).catch(() => undefined);
    look();
    const timer = setInterval(look, 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [state?.kind]);

  useEffect(() => () => { waitingRef.current?.cancel().catch(() => undefined); }, []);

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

  const copyKey = async () => {
    if (!showing) return;
    try {
      await navigator.clipboard.writeText(showing.recoveryKey);
      setNote({ kind: 'ok', text: 'Copied. Paste it into your password manager now.' });
    } catch {
      setNote({ kind: 'error', text: "Couldn't copy. Download or print it instead." });
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

  const askOtherDevice = () => run(async () => {
    if (!userId) return;
    const req = await startDeviceRequest(userId);
    waitingRef.current = req;
    setWaiting(req);
    req.done
      .then(async () => {
        setWaiting(null);
        waitingRef.current = null;
        setNote({ kind: 'ok', text: 'Approved. Your keys are on this device now.' });
        await refresh();
      })
      .catch((err) => {
        setWaiting(null);
        waitingRef.current = null;
        if ((err as { code?: string })?.code !== 'cancelled') setNote({ kind: 'error', text: keysErrorText(err) });
      });
  });

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Encryption keys" fallback="/settings/security" />
      <ScrollView contentContainerStyle={screenStyles.body} keyboardShouldPersistTaps="handled">
        <Muted>Test builds only. Only vaults you lock use these keys.</Muted>
        {note && <Status kind={note.kind}>{note.text}</Status>}

        {state === null && <Card><Muted>Checking your keys…</Muted></Card>}
        {state?.kind === 'unsupported' && <Card><Body>{state.reason}</Body></Card>}
        {state?.kind === 'unavailable' && <Card><Body>Encryption keys aren't switched on yet.</Body></Card>}

        {/* A backup key, shown once */}
        {showing && (
          <Card>
            <CardTitle icon="key">Your backup key</CardTitle>
            <View style={styles.keyBox}>
              <Text selectable style={styles.keyText} accessibilityLabel={`Backup key: ${showing.recoveryKey.split('').join(' ')}`}>
                {showing.recoveryKey}
              </Text>
            </View>
            <Body>Keep it somewhere safe. Nobody at AskLocker can see it or give it back.</Body>
            <View style={styles.row}>
              <SecondaryButton label="Copy" icon="copy" onPress={copyKey} />
              <SecondaryButton label="Download" icon="download" onPress={() => downloadKey(showing.recoveryKey)} />
              <SecondaryButton label="Print" icon="printer" onPress={() => printKey(showing.recoveryKey)} />
            </View>
            <PrimaryButton
              label="I've saved it"
              icon="check"
              busy={busy}
              onPress={() => run(async () => {
                await showing.commit();
                setShowing(null);
                setOldTyped('');
                setNote({ kind: 'ok', text: 'Your backup key is saved.' });
                await refresh();
              })}
            />
            <SecondaryButton label="Cancel" onPress={() => setShowing(null)} />
          </Card>
        )}

        {/* Keys on the account, not on this device */}
        {!showing && state?.kind === 'locked' && userId && (
          <>
            <Card>
              <CardTitle icon="unlock">Unlock this device</CardTitle>
              {waiting ? (
                <>
                  <Body>On a phone or computer where you're signed in, open Settings › Security › Encryption keys and approve this code:</Body>
                  <Text style={styles.code}>{waiting.code}</Text>
                  <Muted>Waiting for approval…</Muted>
                  <SecondaryButton label="Stop" onPress={() => { waiting.cancel(); setWaiting(null); }} />
                </>
              ) : (
                <>
                  {state.ways.phoneLock && lockOk && (
                    <PrimaryButton label="Use your phone's lock" icon="aperture" busy={busy}
                      onPress={() => run(async () => {
                        await unlockWithPhoneLock(userId);
                        setNote({ kind: 'ok', text: 'Your keys are on this device now.' });
                        await refresh();
                      })} />
                  )}
                  <SecondaryButton label="Approve from another device" icon="smartphone" disabled={busy} onPress={askOtherDevice} />
                </>
              )}
            </Card>

            {state.ways.backupKey && !waiting && (
              <Card>
                <CardTitle icon="key">Use your backup key</CardTitle>
                <Field label="Backup key" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false}
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" />
                <PrimaryButton label="Unlock" icon="unlock" disabled={!typed.trim()} busy={busy}
                  onPress={() => run(async () => {
                    await unlockWithRecoveryKey(userId, typed);
                    setTyped('');
                    setNote({ kind: 'ok', text: 'Your keys are on this device now.' });
                    await refresh();
                  })} />
              </Card>
            )}

            {!waiting && (
              <Card>
                <CardTitle icon="alert-circle">Lost every way back?</CardTitle>
                <Body>Make new keys. Your family vaults come back once an admin lets you in. Your personal vault's locked documents can't be opened again.</Body>
                {confirmNew ? (
                  <>
                    <DangerButton label="Yes, make new keys" icon="refresh-cw" busy={busy}
                      onPress={() => run(async () => {
                        await makeNewKeys(userId);
                        setConfirmNew(false);
                        setNote({ kind: 'ok', text: 'New keys made. Your vaults’ admins have been asked to let you back in.' });
                        await refresh();
                      })} />
                    <SecondaryButton label="Cancel" onPress={() => setConfirmNew(false)} />
                  </>
                ) : (
                  <SecondaryButton label="Make new keys" onPress={() => setConfirmNew(true)} />
                )}
              </Card>
            )}
          </>
        )}

        {!showing && state?.kind === 'mismatch' && userId && (
          <Card>
            <CardTitle icon="alert-triangle">These keys don't match</CardTitle>
            <Body>This device holds other keys than your account's. Forget them here, then unlock again.</Body>
            <DangerButton label="Forget keys on this device" icon="x-circle" busy={busy}
              onPress={() => run(async () => { await forgetKeysOnThisDevice(userId); await refresh(); })} />
          </Card>
        )}

        {!showing && state?.kind === 'ready' && userId && (
          <>
            <Card>
              <CardTitle icon="check-circle">Your keys are on this device</CardTitle>
              <Muted>Key ID {groups(state.server.fingerprint)}</Muted>
              <Muted>Set up {longDate(new Date(state.server.createdAt))}</Muted>
            </Card>

            {pending.map((p) => (
              <Card key={p.id}>
                <CardTitle icon="smartphone">{p.label ?? 'A new device'} wants your keys</CardTitle>
                <Body>Approve only if the new device shows this code:</Body>
                <Text style={styles.code}>{p.code}</Text>
                <PrimaryButton label="Approve" icon="check" busy={busy} disabled={!state.canHandOn}
                  onPress={() => run(async () => {
                    await approveDeviceRequest(userId, p.id);
                    setPending((list) => list.filter((x) => x.id !== p.id));
                    setNote({ kind: 'ok', text: 'Approved.' });
                  })} />
                {!state.canHandOn && <Muted>This device keeps your keys the old way. Forget them here and unlock again first.</Muted>}
              </Card>
            ))}

            <Card>
              <CardTitle icon="aperture">Your phone's lock</CardTitle>
              {state.phoneLocks.filter((l) => l.current).length ? (
                <>
                  <Body>Your next phone opens your documents with its fingerprint, face or PIN.</Body>
                  {state.phoneLocks.filter((l) => l.current).map((l) => (
                    <View key={l.id} style={styles.lockRow}>
                      <Muted>{l.label ?? 'A device'} · {longDate(new Date(l.createdAt))}</Muted>
                      <SecondaryButton label="Remove" disabled={busy}
                        onPress={() => run(async () => { await removePhoneLock(l.id); await refresh(); })} />
                    </View>
                  ))}
                </>
              ) : (
                <Body>Use your screen lock, so your next phone opens your documents without a key to type.</Body>
              )}
              {lockOk ? (
                <SecondaryButton label="Use this device's screen lock" icon="aperture" disabled={busy || !state.canHandOn}
                  onPress={() => run(async () => {
                    await addPhoneLock(userId, user?.email ?? 'AskLocker');
                    setNote({ kind: 'ok', text: 'Done. Your screen lock now keeps your keys.' });
                    await refresh();
                  })} />
              ) : (
                <Muted>This browser can't use a screen lock for this.</Muted>
              )}
            </Card>

            <Card>
              <CardTitle icon="key">Backup key</CardTitle>
              {state.server.hasBackup ? (
                <>
                  <Body>Saved. Check it still works, or make a new one.</Body>
                  <Field label="Backup key" value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} />
                  <SecondaryButton label="Check" disabled={!typed.trim() || busy}
                    onPress={() => run(async () => {
                      const ok = await checkRecoveryKey(userId, typed);
                      setNote(ok ? { kind: 'ok', text: 'That backup key works.' } : { kind: 'error', text: "That backup key doesn't open your keys." });
                    })} />
                </>
              ) : (
                <Body>Optional. A key to keep somewhere safe, in case you lose every phone.</Body>
              )}
              {state.canHandOn ? (
                <SecondaryButton label={state.server.hasBackup ? 'Make a new one' : 'Make a backup key'} disabled={busy}
                  onPress={() => run(async () => setShowing(await prepareBackupKey(userId)))} />
              ) : state.server.hasBackup ? (
                <>
                  <Field label="Current backup key" value={oldTyped} onChangeText={setOldTyped} autoCapitalize="characters" autoCorrect={false} />
                  <SecondaryButton label="Make a new one" disabled={!oldTyped.trim() || busy}
                    onPress={() => run(async () => setShowing(await prepareNewRecoveryKey(userId, oldTyped)))} />
                </>
              ) : null}
            </Card>

            <Card>
              <CardTitle icon="smartphone">This device</CardTitle>
              <Body>Forget the keys here. Your phone's lock, another device or your backup key brings them back.</Body>
              <SecondaryButton label="Forget keys on this device" disabled={busy}
                onPress={() => run(async () => { await forgetKeysOnThisDevice(userId); await refresh(); })} />
            </Card>
          </>
        )}

        {!showing && userId && state && (state.kind === 'ready' || state.kind === 'locked' || state.kind === 'mismatch') && (
          <Card>
            <CardTitle icon="trash-2">Delete my keys</CardTitle>
            <Body>For testing. Deletes your keys from your account and this device. Not possible once they open a locked vault.</Body>
            {confirmDelete ? (
              <>
                <DangerButton label="Yes, delete my keys" icon="trash-2" busy={busy}
                  onPress={() => run(async () => {
                    await deleteKeysEverywhere(userId);
                    setConfirmDelete(false);
                    setNote({ kind: 'ok', text: 'Your keys are deleted.' });
                    await refresh();
                  })} />
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
  code: {
    ...type.title,
    fontFamily: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: 'monospace' }),
    letterSpacing: 4,
    textAlign: 'center',
    paddingVertical: space.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  lockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
});
