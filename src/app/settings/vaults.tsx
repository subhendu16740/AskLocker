// Settings › Your vaults: every vault this person is in, family vaults and
// business vaults apart (the owner's ask, 18 October 2026), so Manage Family
// only manages the people in one. Tapping a vault opens it. An admin's
// actions sit under its row: Make it a business (054) and Delete — by the
// vault's owner only, family or business (057; the screen tells another
// admin who that is), a personal vault never, since it goes with the account.

import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useFamily } from '../../lib/family-context';
import { fetchUseFor, type UseFor } from '../../lib/api';
import { isBusinessVault, isPersonalVault, vaultIcon, vaultName, vaultSubtitle } from '../../lib/vaults';
import { BUSINESS_THEME, FAMILY_THEME, type VaultTheme } from '../../lib/vault-theme';
import { ScreenHeader } from '../../components/screen-header';
import { Muted, screenStyles } from '../../components/settings-ui';
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

export default function VaultsScreen() {
  const { user } = useAuth();
  const { families, currentFamily, switchFamily, refreshFamilies } = useFamily();
  // What the person said they use AskLocker for puts that kind first (051).
  const [useFor, setUseFor] = useState<UseFor | 'skipped' | null>(null);
  useEffect(() => {
    if (user) fetchUseFor(user.id).then(setUseFor).catch(() => {});
  }, [user?.id]);
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
        <Text style={styles.intro}>Tap a vault to open it.</Text>
        {useFor === 'business' ? sections.reverse() : sections}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: space.lg, paddingBottom: 40 },
  intro: { ...type.caption, paddingHorizontal: space.lg + space.xs, marginBottom: space.md },
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
});
