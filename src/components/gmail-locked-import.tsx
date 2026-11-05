// Import from Gmail into a locked vault (071; test builds): in this browser,
// end to end. See src/lib/gmail-device.web.ts.

import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useFamily } from '../lib/family-context';
import { usePreferences } from '../lib/preferences';
import { vaultName } from '../lib/vaults';
import { uploadDocument } from '../lib/api';
import { connectGmailHere, fetchAttachmentHere, gmailInBrowserAvailable, scanGmailHere, type FoundHere } from '../lib/gmail-device';
import { ScreenHeader } from './screen-header';
import { Body, Card, CardTitle, Muted, PrimaryButton, Status, screenStyles } from './settings-ui';
import { color, space, type } from '../constants/design';

export function GmailLockedImport() {
  const { user } = useAuth();
  const { currentFamily } = useFamily();
  const { documentLanguages } = usePreferences();
  const [token, setToken] = useState<string | null>(null);
  const [found, setFound] = useState<FoundHere[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const run = (label: string, action: () => Promise<void>) => async () => {
    if (busy) return;
    setBusy(label);
    setNote(null);
    try {
      await action();
    } catch (err) {
      setNote({ kind: 'error', text: (err as Error)?.message ?? "That didn't work. Try again." });
    } finally {
      setBusy(null);
    }
  };

  const importTicked = run('Importing…', async () => {
    if (!token || !found || !currentFamily || !user) return;
    const list = found.filter((f) => ticked.has(f.key) && !done.has(f.key));
    let n = 0;
    for (const item of list) {
      setBusy(`Importing ${++n} of ${list.length}…`);
      const { bytes, kind } = await fetchAttachmentHere(token, item);
      await uploadDocument({
        familyId: currentFamily.id,
        storageNamespace: currentFamily.storage_namespace,
        userId: user.id,
        fileName: item.fileName,
        fileType: kind,
        fileBlob: new Blob([bytes.slice()]),
        fileSizeBytes: bytes.length,
        languages: documentLanguages,
      });
      setDone((d) => new Set(d).add(item.key));
    }
    setNote({ kind: 'ok', text: `${list.length} imported and locked on this device.` });
  });

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="From Gmail" fallback="/upload" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        <Muted>Test builds only. {currentFamily ? vaultName(currentFamily) : 'This vault'} is locked, so Gmail is read in this browser, not by AskLocker.</Muted>
        {note && <Status kind={note.kind}>{note.text}</Status>}
        {!gmailInBrowserAvailable() && <Card><Body>Gmail import for locked vaults isn't set up here yet.</Body></Card>}
        {gmailInBrowserAvailable() && !token && (
          <Card>
            <CardTitle icon="mail">Connect Gmail</CardTitle>
            <Body>Google lets this page read your Gmail for an hour. It isn't stored anywhere.</Body>
            <PrimaryButton label="Connect Gmail" icon="mail" busy={busy !== null}
              onPress={run('Connecting…', async () => setToken(await connectGmailHere()))} />
          </Card>
        )}
        {token && !found && (
          <Card>
            <CardTitle icon="search">Look for documents</CardTitle>
            <Body>Your newest emails with attachments are checked here.</Body>
            <PrimaryButton label={busy ?? 'Look for documents'} icon="search" busy={busy !== null}
              onPress={run('Looking…', async () => {
                const items = await scanGmailHere(token, 75, (d) => setBusy(`Looking… ${d} emails`));
                setFound(items);
                setTicked(new Set(items.filter((i) => i.suggestion === 'suggested').map((i) => i.key)));
              })} />
          </Card>
        )}
        {found && (
          <>
            {found.length === 0 && <Card><Body>No documents found in your newest emails.</Body></Card>}
            {found.map((f) => {
              const on = ticked.has(f.key);
              const imported = done.has(f.key);
              return (
                <TouchableOpacity key={f.key} disabled={imported}
                  onPress={() => setTicked((t) => { const n = new Set(t); if (n.has(f.key)) n.delete(f.key); else n.add(f.key); return n; })}
                  accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                  <View style={styles.row}>
                    <Feather name={imported ? 'check-circle' : on ? 'check-square' : 'square'} size={20} color={imported ? '#16A34A' : color.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{f.fileName}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{f.reason} · {f.subject || f.from}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {found.length > 0 && (
              <PrimaryButton label={busy ?? `Import ${[...ticked].filter((k) => !done.has(k)).length}`} icon="download"
                busy={busy !== null} disabled={![...ticked].some((k) => !done.has(k))} onPress={importTicked} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { ...type.label },
  sub: { ...type.caption },
});
