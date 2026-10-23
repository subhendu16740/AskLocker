// Settings › Your vaults: every vault this person is in, family vaults and
// business vaults apart (the owner's ask, 18 October 2026), so Manage Family
// only manages the people in one. Tapping a vault opens it. An admin's
// actions sit under its row: Make it a business (054) and Delete — by the
// vault's owner only, family or business (057; the screen tells another
// admin who that is), a personal vault never, since it goes with the account.
//
// Above them, what the welcome question asked (welcome.tsx): which one
// AskLocker opens in, and the other too, which puts the Family | Business
// switch in the menu (the owner's ask, 19 October 2026).

import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily, otherMode, type Uses } from '../../lib/family-context';
import { isBusinessVault, isPersonalVault, vaultIcon, vaultName, vaultSubtitle } from '../../lib/vaults';
import { BUSINESS_THEME, FAMILY_THEME, type VaultTheme } from '../../lib/vault-theme';
import { track } from '../../lib/analytics';
import { ScreenHeader } from '../../components/screen-header';
import { Muted, OnOff, Status, screenStyles } from '../../components/settings-ui';
import { color, radius, shadow, size, space, type } from '../../constants/design';
import type { FamilyWithMembership } from '../../lib/database.types';

type Action = { label: string; icon: string; onPress: () => void; danger?: boolean };

function VaultRow({ vault, open, theme, first, onOpen, actions }: {
  vault: FamilyWithMembership; open: boolean; theme: VaultTheme; first: boolean;
  onOpen: () => void; actions: Action[];
}) {
  const name = vaultName(vault.families);
  return (
    <View style={[!first && styles.rowBorder]}>
      <TouchableOpacity
        style={styles.row}
        onPress={onOpen}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${vaultSubtitle(vault)}${open ? ', open now' : ''}. Open`}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
          <Feather name={vaultIcon(vault.families)} size={16} color={theme.primary} />
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.sub} numberOfLines={1}>{vaultSubtitle(vault)}</Text>
        </View>
        {open
          ? <Text style={[styles.openTag, { color: theme.primary }]}>Open</Text>
          : <Feather name="chevron-right" size={16} color="#9CA3AF" />}
      </TouchableOpacity>
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.action}
              onPress={a.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${a.label}: ${name}`}
              hitSlop={6}
            >
              <Feather name={a.icon as any} size={14} color={a.danger ? color.danger : theme.primary} />
              <Text style={[styles.actionText, { color: a.danger ? color.danger : theme.primary }]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function CreateRow({ kind, theme }: { kind: 'family' | 'business'; theme: VaultTheme }) {
  return (
    <TouchableOpacity
      style={[styles.row, styles.rowBorder]}
      onPress={() => router.push(`/setup-family?kind=${kind}` as any)}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
        <Feather name="plus" size={16} color={theme.primary} />
      </View>
      <Text style={[styles.createText, { color: theme.primary }]}>
        {kind === 'business' ? 'Create a business' : 'Create a family'}
      </Text>
    </TouchableOpacity>
  );
}

const LABEL = { family: 'Family', business: 'Business' } as const;

// Which one AskLocker opens in, and the other too (the drawer's switch).
function UsesCard() {
  const { uses, setUses } = useFamily();
  const [problem, setProblem] = useState(false);
  const other = otherMode(uses.primary);
  const change = (next: Uses) => {
    if (next.primary === uses.primary && next.both === uses.both) return;
    setProblem(false);
    track('uses_chosen', { primary: next.primary, both: next.both, where: 'settings' });
    setUses(next).catch(() => setProblem(true));
  };
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>How you use AskLocker</Text>
      <View style={[styles.groupCard, styles.usesCard]}>
        <Text style={styles.usesLabel}>Opens in</Text>
        <View style={styles.kinds} accessibilityRole="radiogroup" accessibilityLabel="Opens in">
          {(['family', 'business'] as const).map((m) => {
            const theme = m === 'business' ? BUSINESS_THEME : FAMILY_THEME;
            const on = uses.primary === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => change({ primary: m, both: uses.both })}
                style={[styles.kind, on && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                aria-checked={on}
              >
                <Feather name={m === 'business' ? 'briefcase' : 'users'} size={16} color={on ? '#FFFFFF' : theme.primary} />
                <Text style={[styles.kindText, { color: on ? '#FFFFFF' : theme.primary }]}>{LABEL[m]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.usesLabel, styles.usesLabelNext]}>{LABEL[other]} too</Text>
        <OnOff value={uses.both} onChange={(on) => change({ primary: uses.primary, both: on })} label={`${LABEL[other]} too`} />
        <Muted>Adds a Family | Business switch to the menu.</Muted>
        {problem && <Status kind="error">Saved on this device. AskLocker saves it to your account next time it opens.</Status>}
      </View>
    </View>
  );
}

export default function VaultsScreen() {
  const { families, currentFamily, switchFamily, refreshFamilies, uses } = useFamily();
  useFocusEffect(useCallback(() => { refreshFamilies().catch(() => {}); }, [refreshFamilies]));

  const familyVaults = [
    ...families.filter((f) => isPersonalVault(f.families)),
    ...families.filter((f) => !isPersonalVault(f.families) && !isBusinessVault(f.families)),
  ];
  const businessVaults = families.filter((f) => isBusinessVault(f.families));

  const open = (id: string) => {
    switchFamily(id);
    router.replace('/home' as any);
  };

  const actionsFor = (v: FamilyWithMembership): Action[] => {
    if (isPersonalVault(v.families) || v.role !== 'admin') return [];
    const remove: Action = {
      label: 'Delete', icon: 'trash-2', danger: true,
      onPress: () => router.push({ pathname: '/delete-vault', params: { family: v.family_id } } as any),
    };
    if (isBusinessVault(v.families)) return [remove];
    return [
      {
        label: 'Make it a business', icon: 'briefcase',
        onPress: () => router.push({ pathname: '/make-business', params: { family: v.family_id } } as any),
      },
      remove,
    ];
  };

  const section = (title: string, list: FamilyWithMembership[], kind: 'family' | 'business') => {
    const theme = kind === 'business' ? BUSINESS_THEME : FAMILY_THEME;
    return (
      <View key={kind} style={styles.group}>
        <Text style={[styles.groupTitle, { color: theme.primary }]}>{title}</Text>
        <View style={styles.groupCard}>
          {list.length === 0 && (
            <View style={styles.empty}>
              <Muted>{kind === 'business' ? 'No business vault yet.' : 'No family vault yet.'}</Muted>
            </View>
          )}
          {list.map((v, i) => (
            <VaultRow
              key={v.family_id}
              vault={v}
              first={i === 0}
              open={v.family_id === currentFamily?.id}
              theme={theme}
              onOpen={() => open(v.family_id)}
              actions={actionsFor(v)}
            />
          ))}
          <CreateRow kind={kind} theme={theme} />
        </View>
      </View>
    );
  };

  const sections = [
    section('Family vaults', familyVaults, 'family'),
    section('Business vaults', businessVaults, 'business'),
  ];

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Your vaults" fallback="/settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <UsesCard />
        {uses.primary === 'business' ? sections.reverse() : sections}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: space.lg, paddingBottom: 40 },
  group: { paddingHorizontal: space.lg, marginBottom: space.lg },
  groupTitle: { ...type.overline, marginBottom: space.sm, marginLeft: space.xs },
  groupCard: { backgroundColor: color.surface, borderRadius: radius.card, ...shadow.card },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: 10, minHeight: size.row,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: color.divider },
  iconWrap: { width: size.iconBox, height: size.iconBox, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0 },
  name: type.label,
  sub: type.caption,
  openTag: { ...type.caption, fontWeight: '600' },
  actions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: space.lg,
    paddingLeft: space.lg + size.iconBox + space.md, paddingRight: space.lg, paddingBottom: space.md, marginTop: -space.xs,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 },
  actionText: { ...type.caption, fontWeight: '600' },
  createText: { ...type.label, fontWeight: '600' },
  empty: { paddingHorizontal: space.lg, paddingVertical: space.md },
  usesCard: { padding: space.lg, gap: space.sm },
  usesLabel: type.label,
  usesLabelNext: { marginTop: space.sm },
  kinds: { flexDirection: 'row', gap: space.sm },
  kind: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    minHeight: 40, borderRadius: radius.control, borderWidth: 1, borderColor: color.inputBorder, backgroundColor: color.surface,
  },
  kindText: type.label,
});
