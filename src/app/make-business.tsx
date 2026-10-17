// Manage Family › Make this a business vault (054). A small business may
// start in a family vault and move when it grows, keeping every document,
// member and link. One way only. The server decides, and says why not in its
// own words (Family Plus still paid up, more than a free business keeps).
// The screen says what stays, what changes and what goes before the admin
// says yes. Confirmation is on screen, never Alert.alert, which does nothing
// on the web.

import { useCallback, useState } from 'react';
import { ScrollView, View, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '../lib/family-context';
import { previewBusinessVault, makeBusinessVault, BusinessVaultUnavailable, type BusinessVaultPreview } from '../lib/api';
import { vaultName } from '../lib/vaults';
import { ScreenHeader } from '../components/screen-header';
import { Card, CardTitle, Body, Muted, PrimaryButton, SecondaryButton, Status, screenStyles } from '../components/settings-ui';
import { biz, color, space } from '../constants/design';
import { track } from '../lib/analytics';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function MakeBusinessScreen() {
  const { family } = useLocalSearchParams<{ family?: string }>();
  const { currentFamily, families, refreshFamilies } = useFamily();
  const familyId = typeof family === 'string' && family ? family : currentFamily?.id ?? null;
  const row = families.find((f) => f.family_id === familyId)?.families ?? (currentFamily?.id === familyId ? currentFamily : null);
  const name = row ? vaultName(row) : 'This vault';
  const [preview, setPreview] = useState<BusinessVaultPreview | null>(null);
  const [problem, setProblem] = useState<{ unavailable: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setProblem(null);
    setPreview(null);
    if (!familyId) {
      setProblem({ unavailable: true, text: 'Open the family in Manage Family first.' });
      return;
    }
    previewBusinessVault(familyId)
      .then((p) => { if (!cancelled) setPreview(p); })
      .catch((err) => {
        if (cancelled) return;
        setProblem({
          unavailable: err instanceof BusinessVaultUnavailable,
          text: err?.message || "Couldn't check this vault. Try again.",
        });
      });
    return () => { cancelled = true; };
  }, [familyId]);

  useFocusEffect(useCallback(() => {
    if (done) return;
    return load();
  }, [load, done]));

  const confirm = async () => {
    if (!familyId || !preview?.allowed) return;
    setSaving(true);
    setFailed(null);
    try {
      await makeBusinessVault(familyId);
      track('vault_made_business', {});
      setDone(true);
      refreshFamilies().catch(() => undefined);
    } catch (err: any) {
      setFailed(err?.message || "Couldn't make it a business vault. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="Business vault" fallback="/family" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Card>
            <CardTitle icon="check-circle">{name} is now a business vault</CardTitle>
            <Body>Everyone in it has been told. To move to a business plan, ask us in Settings › Feedback.</Body>
            <PrimaryButton label="Done" onPress={() => router.replace('/family' as any)} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const goes = preview
    ? [
        preview.cards ? count(preview.cards, 'emergency card', 'emergency cards') : null,
        preview.people ? count(preview.people, 'person in the family tree who doesn\'t sign in', 'people in the family tree who don\'t sign in') : null,
        'Birth dates and nicknames',
      ].filter(Boolean) as string[]
    : [];

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Make it a business" fallback="/family" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        {preview === null && !problem ? (
          <View style={styles.center}>
            <ActivityIndicator color={biz.primary} />
            <Muted>Checking {name}…</Muted>
          </View>
        ) : problem ? (
          <>
            <Status kind="error">{problem.text}</Status>
            {!problem.unavailable && <SecondaryButton label="Try again" icon="refresh-cw" onPress={load} />}
          </>
        ) : preview && !preview.allowed ? (
          <Card>
            <CardTitle icon="info">Not yet</CardTitle>
            <Body>{preview.message ?? "This vault can't become a business vault."}</Body>
            {(preview.reason === 'plan_active' || preview.reason === 'storage_over') && (
              <SecondaryButton label="Ask us" icon="message-circle" onPress={() => router.push('/settings/feedback' as any)} />
            )}
          </Card>
        ) : preview && (
          <>
            <Card>
              <CardTitle icon="briefcase">Running a business in {name}?</CardTitle>
              <Body>Make it a business vault. All {count(preview.documents, 'document', 'documents')}, {count(preview.members, 'person', 'people')}, share links and saved chats stay.</Body>
            </Card>

            <Card>
              <CardTitle icon="shield">What changes</CardTitle>
              <Body>An admin can delete anyone's record.</Body>
              <Body>It always keeps an admin, and never goes with anyone's account.</Body>
              <Body>Nothing is removed if a paid plan ends.</Body>
              <Body>Business plans give more people, space and questions.</Body>
              {preview.members > preview.freeMembers && (
                <Muted>
                  It has {preview.members} people. A free business adds new people once it has fewer than {preview.freeMembers}.
                </Muted>
              )}
            </Card>

            <Card>
              <CardTitle icon="minus-circle">What goes</CardTitle>
              <Body>The family tree, emergency cards and birthday reminders.</Body>
              {goes.map((line) => <Muted key={line}>{line}</Muted>)}
            </Card>

            <Card>
              <CardTitle icon="alert-triangle">This can't be undone</CardTitle>
              <Body>A business vault can't become a family vault again.</Body>
              {failed && <Status kind="error">{failed}</Status>}
              <PrimaryButton label="Make it a business vault" icon="briefcase" onPress={confirm} busy={saving} />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: 40 },
});
