// Settings › Storage — one table, a row for each vault: what it holds, the
// space it has, and its plan, a ★ marking a paid one (the owner's ask, 18
// October 2026: the screen had read as too wordy). Every plan has a limit
// (038) and the server refuses new documents once a vault is at it, so a
// vault nearly full or full says so on its row. Each vault wears its own
// colours, a business's teal and a family's navy, whichever mode is open;
// the mode's own vaults come first. Before 038 a vault's space is the free
// limit, from its documents' own sizes (see src/lib/plans.ts). On Free each
// person also has their own number across their free vaults (060), the
// table's first row.

import { useCallback, useState } from 'react';
import { ScrollView, View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../lib/auth';
import { useFamily } from '../../lib/family-context';
import { isBusinessVault, isPersonalVault, vaultIcon, vaultName } from '../../lib/vaults';
import { fetchPersonStorage, fetchPlanLimits, fetchStorageStatus, fetchStorageUsage, type FamilyPlanStatus } from '../../lib/api';
import {
  DEFAULT_PLAN_LIMITS, businessPlanName, formatBytes, isBusinessPlan, storageLevel, type PersonRoom, type PlanLimits, type StorageLevel,
} from '../../lib/plans';
import { longDate } from '../../lib/dates';
import { plusPage } from '../../lib/family-plan';
import { ScreenHeader } from '../../components/screen-header';
import { Muted, Status, screenStyles } from '../../components/settings-ui';
import { biz, color, radius, shadow, size, space, type } from '../../constants/design';
import { useVaultTheme, vaultTheme } from '../../lib/vault-theme';
import type { FamilyWithMembership } from '../../lib/database.types';

// Nearly full in amber, full in red; otherwise the vault's own colour.
const LEVEL: Record<Exclude<StorageLevel, 'ok'>, string> = { nearly: '#B45309', full: color.danger };

interface Row {
  vault: FamilyWithMembership;
  status: FamilyPlanStatus | null;
  used: number;
  limit: number;
}

function planName(status: FamilyPlanStatus | null): string {
  if (isBusinessPlan(status?.plan)) return `${businessPlanName(status.plan)}${status.trial ? ', trial' : ''}`;
  if (status?.plan === 'plus') return `Family Plus${status.trial ? ', trial' : ''}`;
  // A business whose paid plan ended (051): every record stays, nothing can be added.
  return status?.closed ? 'Plan ended' : 'Free';
}

const paid = (status: FamilyPlanStatus | null) => !!status && status.plan !== 'free' && !status.closed;

export default function StorageScreen() {
  const { user } = useAuth();
  const { families, mode } = useFamily();
  // The screen follows the mode, Family or Business (the drawer's switch).
  const theme = useVaultTheme();
  const business = mode === 'business';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [person, setPerson] = useState<PersonRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const familyKey = families.map((f) => f.family_id).join(',');

  useFocusEffect(useCallback(() => {
    if (!user) return;
    let cancelled = false;
    setError(null);
    // The mode's own vaults first; within a kind, the personal vault first.
    const rank = (v: FamilyWithMembership) =>
      (isBusinessVault(v.families) === business ? 0 : 2) + (isPersonalVault(v.families) ? 0 : 1);
    const vaults = [...families].sort((a, b) => rank(a) - rank(b));
    Promise.all([
      Promise.all(vaults.map((v) => fetchStorageStatus(v.family_id).catch(() => null))),
      fetchPlanLimits().catch((): PlanLimits => DEFAULT_PLAN_LIMITS),
      fetchPersonStorage().catch(() => null),
    ])
      .then(async ([statuses, limits, mine]) => {
        // Before 038 there is no status: add up the documents' own sizes instead.
        const unknown = vaults.filter((_, i) => !statuses[i]);
        const sizes = unknown.length
          ? await fetchStorageUsage(unknown.map((v) => ({ id: v.family_id, name: vaultName(v.families) })), user.id)
          : [];
        if (cancelled) return;
        // Only someone in a free vault has a number of their own to show.
        setPerson(statuses.some((s) => s?.plan === 'free' && !s.closed) ? mine : null);
        setRows(vaults.map((vault, i) => {
          const status = statuses[i];
          const used = status ? status.usedBytes : sizes.find((s) => s.familyId === vault.family_id)?.bytes ?? 0;
          const limit = status ? status.limitBytes
            : isPersonalVault(vault.families) ? limits.freePersonal
              : isBusinessVault(vault.families) ? limits.freeBusiness : limits.free;
          return { vault, status, used, limit };
        }));
      })
      .catch((err) => { if (!cancelled) { setRows([]); setError(err?.message ?? "Couldn't add up your storage."); } });
    return () => { cancelled = true; };
  }, [user?.id, familyKey, business]));

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Storage" fallback="/settings" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        {rows === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
            <Muted>Adding up your vaults…</Muted>
          </View>
        ) : (
          <>
            {error && <Status kind="error">{error}</Status>}

            <View style={styles.table} accessibilityRole="list">
              <View style={styles.headRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={[styles.head, styles.vaultCol]}>Vault</Text>
                <Text style={[styles.head, styles.usedCol]}>Used</Text>
                <Text style={[styles.head, styles.spaceCol]}>Space</Text>
              </View>
              {person && <PersonRow person={person} last={rows.length === 0} />}
              {rows.length === 0 && <View style={styles.empty}><Muted>No vaults yet.</Muted></View>}
              {rows.map((r, i) => <VaultRow key={r.vault.family_id} row={r} last={i === rows.length - 1} />)}
            </View>

            <View style={styles.key}>
              <Text style={styles.keyText}>
                <Text style={{ color: business ? biz.accent : color.accent }}>★</Text> Paid plan. Documents and saved chats share a vault's space.
              </Text>
            </View>

            <TouchableOpacity style={styles.compare} onPress={() => router.push('/plus' as any)} accessibilityRole="link">
              <Text style={[styles.compareText, { color: theme.primary }]}>
                {business ? 'Compare Free and the business plans' : 'Compare Free and Family Plus'}
              </Text>
              <Feather name="chevron-right" size={16} color={theme.primary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// What this person has added across their free vaults, against their own
// number on Free (060). Files in a vault on a paid plan do not count.
function PersonRow({ person, last }: { person: PersonRoom; last: boolean }) {
  const theme = useVaultTheme();
  const { usedBytes: used, limitBytes: limit } = person;
  const level = storageLevel(used, limit);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const note = level === 'full' ? 'Full. Delete something you added to add more.' : level === 'nearly' ? 'Nearly full.' : null;
  return (
    <View
      style={[styles.row, last && styles.lastRow]}
      accessible
      accessibilityLabel={`You, on Free: ${formatBytes(used)} of ${formatBytes(limit)} added across your free vaults${note ? `. ${note}` : ''}`}
    >
      <View style={styles.rowMain}>
        <View style={[styles.vaultCol, styles.vaultCell]}>
          <View style={[styles.icon, { backgroundColor: theme.tint }]}>
            <Feather name="user" size={16} color={theme.primary} />
          </View>
          <View style={styles.vaultText}>
            <Text style={styles.name} numberOfLines={1}>You</Text>
            <Text style={styles.plan} numberOfLines={1}>On Free</Text>
          </View>
        </View>
        <Text style={[styles.num, styles.usedCol, level !== 'ok' && { color: LEVEL[level] }]} numberOfLines={1}>{formatBytes(used)}</Text>
        <Text style={[styles.num, styles.spaceCol, styles.space, { color: theme.primary }]} numberOfLines={1}>{formatBytes(limit)}</Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${used > 0 ? Math.max(2, percent) : 0}%`, backgroundColor: level === 'ok' ? theme.secondary : LEVEL[level] },
          ]}
        />
      </View>
      {note && (
        <View style={styles.noteRow}>
          <Text style={[styles.note, { color: LEVEL[level as Exclude<StorageLevel, 'ok'>] }]}>{note}</Text>
        </View>
      )}
    </View>
  );
}

function VaultRow({ row, last }: { row: Row; last: boolean }) {
  const { vault, status, used, limit } = row;
  const name = vaultName(vault.families);
  const theme = vaultTheme(vault.families);
  const business = isBusinessVault(vault.families);
  const star = business ? biz.accent : color.accent;
  const isPaid = paid(status);
  const level = status?.closed ? 'full' : storageLevel(used, limit);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const plan = planName(status);
  // One short line, only when something needs doing.
  const note = status?.closed
    ? 'Plan ended. You can’t add records until it’s renewed.'
    : status?.removalAt
      ? `Plus has ended. On ${longDate(new Date(status.removalAt))}, the newest documents above ${formatBytes(limit)} are removed.`
      : level === 'full'
        ? 'Full. Delete something to add more.'
        : level === 'nearly'
          ? 'Nearly full.'
          : null;
  // A free vault, or a business below Enterprise, can move up a plan.
  const canMoveUp = !isPaid || (business && status?.plan !== 'business_enterprise');

  return (
    <View
      style={[styles.row, last && styles.lastRow]}
      accessible
      accessibilityLabel={`${name}, ${isPaid ? `${plan}, paid plan` : plan}: ${formatBytes(used)} of ${formatBytes(limit)} used${note ? `. ${note}` : ''}`}
    >
      <View style={styles.rowMain}>
        <View style={[styles.vaultCol, styles.vaultCell]}>
          <View style={[styles.icon, { backgroundColor: theme.tint }]}>
            <Feather name={vaultIcon(vault.families)} size={16} color={theme.primary} />
          </View>
          <View style={styles.vaultText}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Text style={styles.plan} numberOfLines={1}>
              {isPaid && <Text style={{ color: star }}>★ </Text>}
              {plan}
            </Text>
          </View>
        </View>
        <Text style={[styles.num, styles.usedCol, level !== 'ok' && { color: LEVEL[level] }]} numberOfLines={1}>{formatBytes(used)}</Text>
        <Text style={[styles.num, styles.spaceCol, styles.space, { color: theme.primary }]} numberOfLines={1}>
          {isPaid && <Text style={{ color: star }}>★ </Text>}
          {formatBytes(limit)}
        </Text>
      </View>
      <View style={styles.bar}>
        <View
          style={[
            styles.barFill,
            { width: `${used > 0 ? Math.max(2, percent) : 0}%`, backgroundColor: level === 'ok' ? theme.secondary : LEVEL[level] },
          ]}
        />
      </View>
      {note && (
        <View style={styles.noteRow}>
          <Text style={[styles.note, { color: level === 'ok' ? color.textBody : LEVEL[level] }]}>{note}</Text>
          {canMoveUp && (level !== 'ok' || status?.removalAt) && (
            <TouchableOpacity onPress={() => router.push(plusPage('storage') as any)} accessibilityRole="link" hitSlop={8}>
              <Text style={[styles.noteLink, { color: theme.primary }]}>{business ? 'Plans' : 'Family Plus'} ›</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.sm, paddingVertical: 40 },
  table: { backgroundColor: color.surface, borderRadius: radius.card, ...shadow.card, overflow: 'hidden' },
  headRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.divider,
  },
  head: { ...type.overline },
  vaultCol: { flex: 1, minWidth: 0 },
  usedCol: { width: 64, textAlign: 'right' },
  spaceCol: { width: 88, textAlign: 'right' },
  row: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderBottomColor: color.divider },
  lastRow: { borderBottomWidth: 0 },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  vaultCell: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { width: size.iconBox, height: size.iconBox, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  vaultText: { flex: 1, minWidth: 0 },
  name: type.label,
  plan: type.caption,
  num: { ...type.label, color: color.text },
  space: { fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EEF2F8', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  note: { ...type.caption, flex: 1 },
  noteLink: { ...type.caption, fontWeight: '600' },
  empty: { padding: space.lg },
  key: { paddingHorizontal: space.xs },
  keyText: type.caption,
  compare: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: size.control, paddingHorizontal: space.lg,
    backgroundColor: color.surface, borderRadius: radius.control, ...shadow.card,
  },
  compareText: { ...type.label, fontWeight: '600' },
});
