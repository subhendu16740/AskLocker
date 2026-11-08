// Lock a vault — test builds only (071; docs/end-to-end-encryption.md). The
// vault's owner locks it once: its key is made on this device, every new
// document is read and sealed on the phone, and its older documents are
// moved into the lock here ("Locking your documents… 3 of 12").

import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '../lib/family-context';
import { usePreferences } from '../lib/preferences';
import { isProduction } from '../lib/environment';
import { vaultName } from '../lib/vaults';
import { fetchLockingAllowed, fetchVaultKeyStatus } from '../lib/e2e-api';
import { lockVault, lockedVaults, moveOlderDocuments } from '../lib/vault-lock';
import { keysErrorText } from '../lib/vault-keys';
import { ScreenHeader } from '../components/screen-header';
import { Body, Card, CardTitle, Muted, PrimaryButton, SecondaryButton, Status, screenStyles } from '../components/settings-ui';

type Note = { kind: 'ok' | 'error'; text: string } | null;

export default function LockVaultScreen() {
  const { family: familyId } = useLocalSearchParams<{ family: string }>();
  const { families } = useFamily();
  const { documentLanguages } = usePreferences();
  const vault = families.find((f) => f.family_id === familyId)?.families;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  const [moved, setMoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [failed, setFailed] = useState<{ name: string; reason: string }[]>([]);

  const refresh = useCallback(async () => {
    if (!familyId) return;
    setAllowed(await fetchLockingAllowed());
    const status = await fetchVaultKeyStatus(familyId).catch(() => 'unavailable' as const);
    if (status !== 'unavailable') {
      setLocked(status.locked);
      setMoved(Boolean(status.movedAt));
    }
  }, [familyId]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const move = async () => {
    if (!familyId || !vault) return;
    const result = await moveOlderDocuments(familyId, vault.storage_namespace, documentLanguages, (done, total, name) =>
      setProgress(total ? `Locking your documents… ${Math.min(done + 1, total)} of ${total}${name ? ` (${name})` : ''}` : null));
    setProgress(null);
    setFailed(result.failed);
    setMoved(result.left === 0);
    setNote(result.left === 0
      ? { kind: 'ok', text: result.moved ? `Done. ${result.moved} document${result.moved === 1 ? '' : 's'} locked.` : 'Done. Every document is locked.' }
      : { kind: 'error', text: `${result.left} document${result.left === 1 ? '' : 's'} could not be locked yet. Try again.` });
  };

  const run = (action: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      await action();
    } catch (err) {
      setNote({ kind: 'error', text: keysErrorText(err) });
    } finally {
      setBusy(false);
      setProgress(null);
      await refresh();
    }
  };

  if (isProduction) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="Lock this vault" fallback="/settings/vaults" />
        <ScrollView contentContainerStyle={screenStyles.body}><Card><Body>Not available here yet.</Body></Card></ScrollView>
      </SafeAreaView>
    );
  }

  const name = vault ? vaultName(vault) : 'This vault';

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title={locked ? `${name} is locked` : `Lock ${name}`} fallback="/settings/vaults" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        <Muted>Test builds only.</Muted>
        {note && <Status kind={note.kind}>{note.text}</Status>}
        {progress && <Status kind="ok">{progress}</Status>}

        {allowed === false && !locked && (
          <Card><Body>Locked vaults aren't switched on for this project.</Body></Card>
        )}

        {!locked && allowed && (
          <Card>
            <CardTitle icon="lock">Only the people in this vault can open it</CardTitle>
            <Body>Its documents are read and locked on your devices. Nobody at AskLocker can open them.</Body>
            <Muted>Adding a document takes a little longer, and searching runs on your phone. Gmail import is not available for it yet.</Muted>
            <PrimaryButton label="Lock this vault" icon="lock" busy={busy}
              onPress={run(async () => {
                await lockVault(familyId!);
                setLocked(true);
                await lockedVaults(true);
                await move();
              })} />
          </Card>
        )}

        {locked && !moved && (
          <Card>
            <CardTitle icon="refresh-cw">Older documents</CardTitle>
            <Body>Some documents were added before the vault was locked. Lock them now, on this device.</Body>
            <PrimaryButton label="Lock the older documents" icon="lock" busy={busy} onPress={run(move)} />
          </Card>
        )}

        {locked && moved && (
          <Card>
            <CardTitle icon="check-circle">Every document is locked</CardTitle>
            <Body>New documents are locked on your phone as you add them.</Body>
            <SecondaryButton label="Done" onPress={() => router.back()} />
          </Card>
        )}

        {failed.map((f) => (
          <Card key={f.name}><Muted>{f.name}: {f.reason}</Muted></Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
