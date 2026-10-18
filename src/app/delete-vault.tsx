// Settings › Your vaults › Delete. A vault, family or business, is deleted
// only by its owner: its creator while an admin of it, else its
// longest-standing admin (057), and another admin is told who that is. A
// personal vault is never deleted here: it goes only with its account. Every
// document and file in the vault goes, for everyone in it, so the screen
// says who loses it and asks for the vault's name. Confirmation is on screen,
// never Alert.alert, which does nothing on the web.

import { useCallback, useState } from 'react';
import { ScrollView, View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '../lib/family-context';
import {
  previewBusinessDeletion, deleteBusiness, previewFamilyDeletion, deleteFamilyVault, AccountDeletionError,
  type BusinessDeletion, type FamilyDeletion,
} from '../lib/api';
import { isBusinessVault, isPersonalVault } from '../lib/vaults';
import { vaultTheme } from '../lib/vault-theme';
import { ScreenHeader } from '../components/screen-header';
import { Card, CardTitle, Body, Muted, Field, PrimaryButton, SecondaryButton, DangerButton, Status, screenStyles } from '../components/settings-ui';
import { space, type } from '../constants/design';
import { track } from '../lib/analytics';

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function DeleteVaultScreen() {
  const { family } = useLocalSearchParams<{ family?: string }>();
  const { families, currentFamily, refreshFamilies, switchFamily } = useFamily();
  const familyId = typeof family === 'string' && family ? family : null;
  const vault = families.find((f) => f.family_id === familyId) ?? null;
  // What went stays on screen after the vault has left the list.
  const [done, setDone] = useState<{ name: string; business: boolean } | null>(null);
  const business = done ? done.business : isBusinessVault(vault?.families);
  const theme = vaultTheme(vault?.families);
  const things = (n: number) => (business ? count(n, 'record', 'records') : count(n, 'document', 'documents'));
  const word = business ? 'business' : 'family';

  const [plan, setPlan] = useState<BusinessDeletion | FamilyDeletion | null>(null);
  const [problem, setProblem] = useState<{ unavailable: boolean; text: string } | null>(null);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setProblem(null);
    setPlan(null);
    if (!familyId || !vault) {
      setProblem({ unavailable: true, text: 'Pick a vault in Settings › Your vaults first.' });
      return;
    }
    if (isPersonalVault(vault.families)) {
      setProblem({ unavailable: true, text: 'Your personal vault goes only with your account.' });
      return;
    }
    (business ? previewBusinessDeletion(familyId) : previewFamilyDeletion(familyId))
      .then((p) => { if (!cancelled) setPlan(p); })
      .catch((err) => {
        if (cancelled) return;
        setProblem({
          unavailable: err instanceof AccountDeletionError && err.status === 'unavailable',
          text: err?.message || "Couldn't check what would be deleted.",
        });
      });
    return () => { cancelled = true; };
  }, [familyId, vault?.family_id, business]);

  useFocusEffect(useCallback(() => {
    if (done) return;
    return load();
  }, [load, done]));

  const allowed = !!plan && plan.canDelete !== false;
  const confirmed = allowed && typed.trim().toLowerCase() === plan!.name.trim().toLowerCase();

  const remove = async () => {
    if (!plan || !confirmed) return;
    setDeleting(true);
    setFailed(null);
    try {
      if (business) {
        await deleteBusiness(plan.familyId, typed);
        track('business_deleted', {});
      } else {
        await deleteFamilyVault(plan.familyId, typed);
        track('family_deleted', {});
      }
      setDone({ name: plan.name, business });
      // Open another vault of the same kind if there is one, so no screen is
      // left showing the one that went, and the mode stays.
      if (currentFamily?.id === plan.familyId) {
        const others = families.filter((f) => f.family_id !== plan.familyId);
        const next = others.find((f) => isBusinessVault(f.families) === business) ?? others[0];
        if (next) switchFamily(next.family_id);
      }
      refreshFamilies().catch(() => undefined);
    } catch (err: any) {
      setFailed(err?.message || `Couldn't delete the ${word}. Please try again.`);
    } finally {
      setDeleting(false);
    }
  };

  const title = business ? 'Delete business' : 'Delete family';

  if (done) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title={title} fallback="/settings/vaults" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Card>
            <CardTitle icon="check-circle">{done.name} has been deleted</CardTitle>
            <Body>Its {business ? 'records' : 'documents'} and files are gone, for everyone who was in it.</Body>
            <PrimaryButton label="Done" onPress={() => router.replace('/settings/vaults' as any)} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title={title} fallback="/settings/vaults" />
      <ScrollView contentContainerStyle={screenStyles.body} keyboardShouldPersistTaps="handled">
        {plan === null && !problem ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
            <Muted>Checking what would be deleted…</Muted>
          </View>
        ) : problem ? (
          <>
            <Status kind="error">{problem.text}</Status>
            {!problem.unavailable && <SecondaryButton label="Try again" icon="refresh-cw" onPress={load} />}
          </>
        ) : plan && !allowed ? (
          <Card>
            <CardTitle icon="lock">Only its owner can delete it</CardTitle>
            <Body>
              {plan.ownerName ? `${plan.ownerName} owns ${plan.name}` : `${plan.name} has an owner`}, so only they can delete it. You can
              leave it in {business ? 'Manage team' : 'Manage Family'}.
            </Body>
          </Card>
        ) : plan && (
          <>
            <Card>
              <CardTitle icon="alert-triangle">This cannot be undone</CardTitle>
              <Body>{plan.name} and all {things(plan.documentCount)} in it are deleted right away, for everyone.</Body>
              <Muted>Copies in our providers' backups and logs expire on their own.</Muted>
            </Card>

            {plan.otherMembers.length > 0 && (
              <Card>
                <CardTitle icon="users">They lose it too</CardTitle>
                {plan.otherMembers.map((name, i) => (
                  <Text key={`${name}-${i}`} style={styles.person}>{name}</Text>
                ))}
                <Muted>
                  {business
                    ? 'To keep the business going without you, make one of them an admin, then leave.'
                    : 'To keep the family going without you, make one of them an admin, then leave.'}
                </Muted>
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
                label={business ? 'Delete this business' : 'Delete this family'}
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
