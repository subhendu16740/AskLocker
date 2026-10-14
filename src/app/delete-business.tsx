// Manage team › Delete this business (051). A business never goes with
// anyone's account, so this is the one way it goes: an admin, on purpose,
// typing its name. Every record and file in it is deleted, for everyone in
// it. The screen says who loses it first. Confirmation is on screen, never
// Alert.alert, which does nothing on the web.

import { useCallback, useState } from 'react';
import { ScrollView, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '../lib/family-context';
import { previewBusinessDeletion, deleteBusiness, AccountDeletionError, type BusinessDeletion } from '../lib/api';
import { ScreenHeader } from '../components/screen-header';
import { Card, CardTitle, Body, Muted, Field, PrimaryButton, SecondaryButton, DangerButton, Status, screenStyles } from '../components/settings-ui';
import { color, space, type } from '../constants/design';
import { track } from '../lib/analytics';

const records = (n: number) => `${n} ${n === 1 ? 'record' : 'records'}`;

export default function DeleteBusinessScreen() {
  const { family } = useLocalSearchParams<{ family?: string }>();
  const { currentFamily, refreshFamilies, switchFamily, families } = useFamily();
  const familyId = typeof family === 'string' && family ? family : currentFamily?.id ?? null;
  const [plan, setPlan] = useState<BusinessDeletion | null>(null);
  const [problem, setProblem] = useState<{ unavailable: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setProblem(null);
    setPlan(null);
    if (!familyId) {
      setProblem({ unavailable: true, text: 'Open the business in Manage team first.' });
      return;
    }
    previewBusinessDeletion(familyId)
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch((err) => {
        if (cancelled) return;
        setProblem({
          unavailable: err instanceof AccountDeletionError && err.status === 'unavailable',
          text: err?.message || "Couldn't check what would be deleted.",
        });
      });
    return () => { cancelled = true; };
  }, [familyId]);

  useFocusEffect(useCallback(() => {
    if (done) return;
    return load();
  }, [load, done]));

  const confirmed = !!plan && typed.trim().toLowerCase() === plan.name.trim().toLowerCase();

  const remove = async () => {
    if (!plan || !confirmed) return;
    setDeleting(true);
    setFailed(null);
    try {
      await deleteBusiness(plan.familyId, typed);
      track('business_deleted', {});
      setDone(plan.name);
      // Open another vault, so no screen is left showing the one that went.
      const next = families.find((f) => f.family_id !== plan.familyId);
      if (next) switchFamily(next.family_id);
      refreshFamilies().catch(() => undefined);
    } catch (err: any) {
      setFailed(err?.message || "Couldn't delete the business. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="Delete business" fallback="/home" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Card>
            <CardTitle icon="check-circle">{done} has been deleted</CardTitle>
            <Body>Its records and files are gone, for everyone who was in it.</Body>
            <PrimaryButton label="Done" onPress={() => router.replace('/home' as any)} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Delete business" fallback="/family" />
      <ScrollView contentContainerStyle={screenStyles.body} keyboardShouldPersistTaps="handled">
        {plan === null && !problem ? (
          <View style={styles.center}>
            <ActivityIndicator color={color.primary} />
            <Muted>Checking what would be deleted…</Muted>
          </View>
        ) : problem ? (
          <>
            <Status kind="error">{problem.text}</Status>
            {!problem.unavailable && <SecondaryButton label="Try again" icon="refresh-cw" onPress={load} />}
          </>
        ) : plan && (
          <>
            <Card>
              <CardTitle icon="alert-triangle">This cannot be undone</CardTitle>
              <Body>{plan.name} and all {records(plan.documentCount)} in it are deleted right away, for everyone.</Body>
              <Muted>Copies in our providers' backups and logs expire on their own.</Muted>
            </Card>

            {plan.otherMembers.length > 0 && (
              <Card>
                <CardTitle icon="users">They lose it too</CardTitle>
                {plan.otherMembers.map((name, i) => (
                  <Text key={`${name}-${i}`} style={styles.person}>{name}</Text>
                ))}
                <Muted>To keep the business going without you, make one of them an admin, then leave.</Muted>
              </Card>
            )}

            <Card>
              <CardTitle icon="trash-2">Delete {plan.name}</CardTitle>
              <Field
                label={`Type ${plan.name} to confirm`}
                value={typed}
                onChangeText={(t) => { setTyped(t); setFailed(null); }}
                autoCorrect={false}
                autoComplete="off"
              />
              {failed && <Status kind="error">{failed}</Status>}
              <DangerButton
                label="Delete this business"
                icon="trash-2"
                onPress={remove}
                disabled={!confirmed}
                busy={deleting}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: 40 },
  person: type.label,
});
