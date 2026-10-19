// All documents: three tabs, which Home's three counts open (the owner's
// ask, 18 October 2026) — Documents, Family (Team in a business) and
// Categories. Documents is every document in the mode's vaults (046), newest
// first, with a vault filter — and Delete, one at a time or several with
// Select, for the documents they added. Family lists the people of one vault
// (document-groups.ts's peopleVault) and Categories what the documents are
// filed under; tapping one shows its documents. Only the person who added a
// document can delete it, admins included: the server keeps the same rule
// (delete_family_document, 047), and deleteDocument() then removes the file
// from Storage, so the vault's space is freed (038).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView, ActivityIndicator, Modal, Pressable, StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useFamily } from '../lib/family-context';
import { deleteDocument, fetchAllDocuments, fetchFamilyMembers } from '../lib/api';
import { canDeleteDocument, isBusinessVault, isPersonalVault, vaultIcon, vaultName } from '../lib/vaults';
import { categoryGroups, categoryKey, isDocumentsTab, peopleVault, type DocumentsTab } from '../lib/document-groups';
import { useVaultTheme } from '../lib/vault-theme';
import type { FamilyDocumentRow, FamilyMemberWithUser } from '../lib/database.types';
import { HeaderButton, ScreenHeader } from '../components/screen-header';
import { VaultDropdown, type VaultChoice } from '../components/vault-sheet';
import { color, radius, shadow, size, space, type } from '../constants/design';

/** A document in the list, with its vault and whether this person may delete it. */
interface ListedDoc extends FamilyDocumentRow {
  familyId: string;
  vault: string;
  personalVault: boolean;
  /** The vault's icon: a lock, a briefcase (051) or people. */
  vaultIcon: 'lock' | 'briefcase' | 'users';
  canDelete: boolean;
}

const ALL = 'all';

/** What the Documents tab is narrowed to, from the Family or Categories tab. */
type Narrow =
  | { kind: 'category'; key: string; label: string }
  | { kind: 'person'; familyId: string; id: string; userId: string; label: string };
const keyOf = (d: ListedDoc) => `${d.familyId}:${d.id}`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function fileSize(bytes: number | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function addedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function docIcon(fileType: string): 'file-text' | 'image' | 'file' {
  if (fileType === 'pdf') return 'file-text';
  if (['jpg', 'jpeg', 'png', 'heic'].includes(fileType)) return 'image';
  return 'file';
}

/** Why a delete did not go through, in words a person can act on. */
function deleteProblem(err: unknown): string {
  const message = String((err as Error | null)?.message ?? '');
  if (/permission/i.test(message)) return 'You can only delete documents you added.';
  if (/not a member/i.test(message)) return "You're no longer in that vault.";
  if (/fetch|network/i.test(message)) return "We couldn't reach AskLocker. Check your connection.";
  return 'Try again.';
}

/** "Personal vault", "Personal vault and Verma family". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function DocumentsScreen() {
  const { user } = useAuth();
  // Only the mode's vaults (the drawer's Family or Business): a business never lists a family's documents.
  const { modeVaults: families, mode, currentFamily } = useFamily();
  const theme = useVaultTheme();
  const business = mode === 'business';
  const params = useLocalSearchParams<{ vault?: string; tab?: string }>();
  const [filter, setFilter] = useState<string>(typeof params.vault === 'string' ? params.vault : ALL);
  const [tab, setTab] = useState<DocumentsTab>(isDocumentsTab(params.tab) ? params.tab : 'documents');
  const [narrow, setNarrow] = useState<Narrow | null>(null);
  // The people of one vault: the open one when shared, else the mode's first shared one.
  const people = peopleVault(currentFamily, families);
  const [members, setMembers] = useState<FamilyMemberWithUser[] | null>(null);
  // Opened again from Home's other count: that count's tab.
  useEffect(() => {
    if (isDocumentsTab(params.tab)) { setTab(params.tab); setNarrow(null); }
  }, [params.tab]);
  const [docs, setDocs] = useState<ListedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // The documents the confirmation is asking about; null when it is closed.
  const [asking, setAsking] = useState<ListedDoc[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [news, setNews] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  // Only the latest load is shown.
  const loads = useRef(0);
  const familyKey = families.map((f) => f.family_id).join('|');

  const load = useCallback(async () => {
    if (!user) return;
    const run = ++loads.current;
    setLoading(true);
    setLoadProblem(null);
    try {
      // One vault that cannot be read leaves the others' documents listed.
      const [lists, peopleList] = await Promise.all([
        Promise.all(families.map((v) => fetchAllDocuments(v.family_id).catch(() => null))),
        people ? fetchFamilyMembers(people.family_id).catch(() => null) : Promise.resolve(null),
      ]);
      if (run !== loads.current) return;
      setMembers(peopleList);
      setDocs(
        lists
          .flatMap((list, i) => (list ?? []).map((d) => ({
            ...d,
            familyId: families[i].family_id,
            vault: vaultName(families[i].families),
            personalVault: isPersonalVault(families[i].families),
            vaultIcon: vaultIcon(families[i].families),
            // Only whoever added it, admins included (047); any admin in a business (051).
            canDelete: canDeleteDocument(families[i], d.uploaded_by, user.id),
          })))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      );
      const failed = families.filter((_, i) => lists[i] === null).map((v) => vaultName(v.families));
      if (failed.length) setLoadProblem(`Couldn't load documents in ${joinNames(failed)}. Open this screen again to retry.`);
    } finally {
      if (run === loads.current) setLoading(false);
    }
  }, [familyKey, user?.id, people?.family_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Again each time the screen is shown: a document deleted from its own page is gone here too.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // A vault left meanwhile is no filter any more.
  const vaultFilter = filter === ALL || families.some((f) => f.family_id === filter) ? filter : ALL;
  const inVault = vaultFilter === ALL ? docs : docs.filter((d) => d.familyId === vaultFilter);
  // In a family a document is someone's (whose document); in a business, whoever added it (051).
  const isTheirs = (d: ListedDoc, n: Extract<Narrow, { kind: 'person' }>) =>
    d.familyId === n.familyId && (business ? d.uploaded_by === n.userId : d.belongs_to_member === n.id);
  const shown = !narrow ? inVault
    : narrow.kind === 'category' ? inVault.filter((d) => categoryKey(d) === narrow.key)
      : inVault.filter((d) => isTheirs(d, narrow));
  const groups = useMemo(() => categoryGroups(docs), [docs]);
  const peopleRows = (members ?? [])
    .map((m) => {
      const n: Extract<Narrow, { kind: 'person' }> = {
        kind: 'person', familyId: m.family_id, id: m.id, userId: m.user_id,
        label: m.users?.display_name || m.users?.email?.split('@')[0] || 'Member',
      };
      return { member: m, narrow: n, count: docs.filter((d) => isTheirs(d, n)).length, you: m.user_id === user?.id };
    })
    .sort((a, b) => Number(b.you) - Number(a.you) || b.count - a.count || a.narrow.label.localeCompare(b.narrow.label));
  const deletable = shown.filter((d) => d.canDelete);
  const pickedDocs = shown.filter((d) => picked.has(keyOf(d)));
  const counts = useMemo(() => {
    const byVault: Record<string, number> = {};
    for (const d of docs) byVault[d.familyId] = (byVault[d.familyId] ?? 0) + 1;
    return byVault;
  }, [docs]);
  const choices: VaultChoice[] = [
    { key: ALL, name: mode === 'business' ? 'All businesses' : 'All vaults', subtitle: plural(docs.length, 'document', 'documents'), icon: 'layers' },
    ...families.map((v) => ({
      key: v.family_id,
      name: vaultName(v.families),
      subtitle: plural(counts[v.family_id] ?? 0, 'document', 'documents'),
      icon: vaultIcon(v.families) as VaultChoice['icon'],
    })),
  ];
  const chosenVault = vaultFilter === ALL ? null : choices.find((c) => c.key === vaultFilter)?.name ?? null;

  const stopSelecting = () => {
    setSelecting(false);
    setPicked(new Set());
  };

  const toggle = (d: ListedDoc) => {
    if (!d.canDelete) return;
    setPicked((now) => {
      const next = new Set(now);
      if (next.has(keyOf(d))) next.delete(keyOf(d));
      else next.add(keyOf(d));
      return next;
    });
  };

  const pickAll = () => {
    setPicked(pickedDocs.length === deletable.length ? new Set() : new Set(deletable.map(keyOf)));
  };

  const chooseVault = (key: string) => {
    setFilter(key);
    setPicked(new Set());
    setNews(null);
  };

  const chooseTab = (next: DocumentsTab) => {
    if (next !== 'documents') stopSelecting();
    setTab(next);
  };

  /** A person's or a category's documents, on the Documents tab. */
  const showOnly = (n: Narrow) => {
    setNarrow(n);
    setFilter(n.kind === 'person' ? n.familyId : ALL);
    setPicked(new Set());
    setNews(null);
    setTab('documents');
  };

  const doDelete = async () => {
    if (!asking || !user || deleting) return;
    setDeleting(true);
    const gone = new Set<string>();
    const problems: string[] = [];
    for (const d of asking) {
      try {
        await deleteDocument(d.familyId, d.id, user.id, d.storage_path);
        gone.add(keyOf(d));
      } catch (err) {
        // Deleted already (on another device, by someone else): as good as done.
        if (/not found/i.test(String((err as Error | null)?.message ?? ''))) gone.add(keyOf(d));
        else problems.push(deleteProblem(err));
      }
    }
    setDocs((all) => all.filter((d) => !gone.has(keyOf(d))));
    setPicked((now) => new Set([...now].filter((k) => !gone.has(k))));
    if (!problems.length) {
      setNews({
        kind: 'ok',
        text: asking.length === 1 ? `Deleted "${asking[0].file_name}".` : `Deleted ${plural(gone.size, 'document', 'documents')}.`,
      });
      setSelecting(false);
    } else {
      const notDone = problems.length === 1 ? "One document wasn't deleted" : `${problems.length} documents weren't deleted`;
      setNews({
        kind: 'error',
        text: `${gone.size ? `Deleted ${plural(gone.size, 'document', 'documents')}. ` : ''}${notDone}. ${problems[0]}`,
      });
    }
    setDeleting(false);
    setAsking(null);
  };

  const askVaults = asking ? [...new Set(asking.map((d) => d.vault))] : [];

  const peopleWord = business ? 'Team' : 'Family';
  const tabs: { key: DocumentsTab; label: string; count: number }[] = [
    { key: 'documents', label: 'Documents', count: docs.length },
    { key: 'people', label: peopleWord, count: members?.length ?? 0 },
    { key: 'categories', label: 'Categories', count: groups.filter((g) => g.key !== 'none').length },
  ];
  const tabBar = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = tab === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, on && { backgroundColor: theme.primary }]}
            onPress={() => chooseTab(t.key)}
            accessibilityRole="tab"
            aria-selected={on}
            accessibilityLabel={`${t.label}, ${t.count}`}
          >
            <Text style={[styles.tabText, on ? styles.tabTextOn : { color: theme.primary }]} numberOfLines={1}>{t.label}</Text>
            <Text style={[styles.tabCount, on ? styles.tabTextOn : { color: theme.secondary }]}>{t.count}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const header = (
    <View style={styles.top}>
      {tabBar}
      {!!narrow && (
        <View style={styles.narrowRow}>
          <TouchableOpacity
            style={[styles.narrowChip, { backgroundColor: theme.tint }]}
            onPress={() => { setNarrow(null); setFilter(ALL); }}
            accessibilityRole="button"
            accessibilityLabel={`Showing ${narrow.label}. Show all documents`}
          >
            <Feather name={narrow.kind === 'person' ? 'user' : 'tag'} size={14} color={theme.primary} />
            <Text style={[styles.narrowText, { color: theme.primary }]} numberOfLines={1}>{narrow.label}</Text>
            <Feather name="x" size={14} color={theme.primary} />
          </TouchableOpacity>
        </View>
      )}
      {families.length > 1 && !narrow && (
        <View style={styles.filter}>
          <Text style={styles.filterLabel}>Show documents from</Text>
          <VaultDropdown label="Show documents from" choices={choices} selected={vaultFilter} onSelect={chooseVault} />
        </View>
      )}
      {!loading && (
        <Text style={styles.count}>
          {plural(shown.length, 'document', 'documents')}{chosenVault && !narrow ? ` in ${chosenVault}` : ''}
        </Text>
      )}
      {!!news && (
        <Text
          style={[styles.news, news.kind === 'error' && styles.newsError]}
          accessibilityRole={news.kind === 'error' ? 'alert' : undefined}
          accessibilityLiveRegion="polite"
        >
          {news.text}
        </Text>
      )}
      {!!loadProblem && <Text style={[styles.news, styles.newsError]} accessibilityRole="alert">{loadProblem}</Text>}
      {selecting && (
        <View style={styles.selectBar}>
          <Text style={styles.selectHint}>
            Tick the documents to delete.{deletable.length < shown.length ? ' You can only delete ones you added.' : ''}
          </Text>
          {deletable.length > 1 && (
            <TouchableOpacity onPress={pickAll} style={styles.pickAll} accessibilityRole="button">
              <Text style={[styles.pickAllText, { color: theme.primary }]}>{pickedDocs.length === deletable.length ? 'Clear' : 'Select all'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderDoc = ({ item: d }: { item: ListedDoc }) => {
    const on = picked.has(keyOf(d));
    const details = [
      d.member_name ? `${d.member_relationship ? `${d.member_relationship} · ` : ''}${d.member_name}` : null,
      addedOn(d.created_at),
      fileSize(d.file_size_bytes),
    ].filter(Boolean).join(' · ');
    return (
      <View style={[styles.card, selecting && !d.canDelete && styles.cardDim, on && styles.cardOn]}>
        <TouchableOpacity
          style={styles.cardMain}
          onPress={() => (selecting ? toggle(d) : router.push({ pathname: '/document/[id]', params: { id: d.id, family: d.familyId } } as any))}
          disabled={selecting && !d.canDelete}
          activeOpacity={0.8}
          accessibilityRole={selecting ? 'checkbox' : 'button'}
          aria-checked={selecting ? on : undefined}
          accessibilityLabel={`${d.file_name}, in ${d.vault}`}
        >
          {selecting && (
            <Feather
              name={on ? 'check-square' : 'square'}
              size={22}
              color={d.canDelete ? (on ? color.danger : color.secondary) : color.border}
            />
          )}
          <LinearGradient colors={theme.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.docIcon}>
            <Feather name={docIcon(d.file_type)} size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.docInfo}>
            <Text style={styles.docTitle} numberOfLines={1}>{d.file_name}</Text>
            <View style={styles.docMeta}>
              {!!d.category_name && (
                <View style={[styles.categoryBadge, { backgroundColor: theme.secondary }]}>
                  <Text style={styles.categoryText} numberOfLines={1}>{d.category_name}</Text>
                </View>
              )}
              {vaultFilter === ALL && families.length > 1 && (
                <View style={[styles.vaultTag, { backgroundColor: theme.tint }]}>
                  <Feather name={d.vaultIcon} size={12} color={theme.primary} />
                  <Text style={[styles.vaultTagText, { color: theme.primary }]} numberOfLines={1}>{d.vault}</Text>
                </View>
              )}
              <Text style={styles.docDate}>{details}</Text>
            </View>
          </View>
        </TouchableOpacity>
        {!selecting && d.canDelete && (
          <TouchableOpacity
            style={styles.bin}
            onPress={() => { setNews(null); setAsking([d]); }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${d.file_name}`}
          >
            <Feather name="trash-2" size={18} color={color.danger} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const personal = !!people && isPersonalVault(people.families);
  const peopleList = (
    <>
      {members === null ? (
        <Text style={styles.count}>{loading ? '' : "Couldn't load the people. Open this screen again to retry."}</Text>
      ) : (
        <>
          {!!people && <Text style={styles.count}>{personal ? 'Only you' : vaultName(people.families)}</Text>}
          <View style={styles.group}>
            {peopleRows.map((r, i) => (
              <TouchableOpacity
                key={r.member.id}
                style={[styles.groupRow, i > 0 && styles.groupBorder]}
                onPress={() => showOnly(r.narrow)}
                accessibilityRole="button"
                accessibilityLabel={`${r.narrow.label}${r.you ? ', you' : ''}: ${plural(r.count, 'document', 'documents')}. Show them`}
              >
                <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
                  <Text style={[styles.avatarText, { color: theme.primary }]}>{r.narrow.label.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.groupText}>
                  <Text style={styles.groupName} numberOfLines={1}>{r.narrow.label}{r.you ? ' (you)' : ''}</Text>
                  <Text style={styles.groupSub} numberOfLines={1}>
                    {r.member.role === 'admin' ? 'Admin' : r.member.role === 'editor' ? 'Editor' : 'Viewer'}
                    {' · '}{business ? `added ${r.count}` : plural(r.count, 'document', 'documents')}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      <TouchableOpacity
        style={styles.manage}
        onPress={() => router.push((personal ? '/settings/vaults' : '/family') as any)}
        accessibilityRole="link"
      >
        <Text style={[styles.manageText, { color: theme.primary }]}>
          {personal ? 'Create a family in Your vaults' : business ? 'Manage team' : 'Manage Family'}
        </Text>
        <Feather name="chevron-right" size={16} color={theme.primary} />
      </TouchableOpacity>
    </>
  );

  const categoryList = groups.length === 0 ? (
    <View style={styles.empty}>
      <Feather name="tag" size={32} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No documents yet</Text>
      <Text style={styles.emptyText}>Each document's category shows up here.</Text>
    </View>
  ) : (
    <View style={styles.group}>
      {groups.map((g, i) => (
        <TouchableOpacity
          key={g.key}
          style={[styles.groupRow, i > 0 && styles.groupBorder]}
          onPress={() => showOnly({ kind: 'category', key: g.key, label: g.name })}
          accessibilityRole="button"
          accessibilityLabel={`${g.name}: ${plural(g.count, 'document', 'documents')}. Show them`}
        >
          <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
            <Feather name={g.key === 'none' ? 'help-circle' : 'tag'} size={16} color={theme.primary} />
          </View>
          <View style={styles.groupText}>
            <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
            <Text style={styles.groupSub}>{plural(g.count, 'document', 'documents')}</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="All documents"
        fallback="/home"
        right={tab !== 'documents' ? undefined : selecting
          ? <HeaderButton icon="x" label="Cancel" onPress={stopSelecting} />
          : deletable.length > 0
            ? <HeaderButton icon="check-square" label="Select" onPress={() => { setNews(null); setSelecting(true); }} />
            : undefined}
      />

      {loading && docs.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
      ) : tab !== 'documents' ? (
        <ScrollView contentContainerStyle={styles.list}>
          <View style={styles.top}>{tabBar}</View>
          {tab === 'people' ? peopleList : categoryList}
        </ScrollView>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={keyOf}
          renderItem={renderDoc}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="file-plus" size={32} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{narrow ? `No documents for ${narrow.label}` : chosenVault ? `No documents in ${chosenVault}` : 'No documents yet'}</Text>
              <Text style={styles.emptyText}>Your uploads show up here.</Text>
            </View>
          }
          contentContainerStyle={styles.list}
        />
      )}

      {selecting && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.deleteBtn, !pickedDocs.length && styles.deleteBtnOff]}
            onPress={() => setAsking(pickedDocs)}
            disabled={!pickedDocs.length}
            accessibilityRole="button"
          >
            <Feather name="trash-2" size={16} color="#FFFFFF" />
            <Text style={styles.deleteBtnText}>
              {pickedDocs.length ? `Delete ${plural(pickedDocs.length, 'document', 'documents')}` : 'Tick documents to delete'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={!!asking} transparent animationType="fade" onRequestClose={() => { if (!deleting) setAsking(null); }}>
        <Pressable style={styles.overlay} onPress={() => { if (!deleting) setAsking(null); }}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle} accessibilityRole="header">
              {asking && asking.length === 1 ? 'Delete this document?' : `Delete ${plural(asking?.length ?? 0, 'document', 'documents')}?`}
            </Text>
            <Text style={styles.dialogText}>
              {asking && asking.length === 1
                ? `"${asking[0].file_name}" and its file will be deleted from ${asking[0].vault}. This can't be undone.`
                : `This deletes them and their files from ${joinNames(askVaults)}. It can't be undone.`}
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAsking(null)} disabled={deleting} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={doDelete} disabled={deleting} accessibilityRole="button">
                {deleting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm },
  top: { gap: space.md, paddingTop: space.lg, paddingBottom: space.xs },
  filter: { gap: space.xs },
  filterLabel: { ...type.overline, marginLeft: space.xs },
  count: { ...type.caption, marginLeft: space.xs },
  news: {
    ...type.body, color: '#15803D', backgroundColor: '#F0FDF4',
    borderRadius: radius.control, padding: space.md,
  },
  newsError: { color: '#B91C1C', backgroundColor: '#FEF2F2' },
  selectBar: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  selectHint: { ...type.caption, flex: 1 },
  pickAll: { minHeight: size.control, justifyContent: 'center', paddingHorizontal: space.sm },
  pickAllText: { ...type.button, color: color.primary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: radius.control,
    minHeight: size.row,
    borderWidth: 1,
    borderColor: 'transparent',
    ...shadow.card,
  },
  cardOn: { borderColor: '#FCA5A5', backgroundColor: '#FFF7F7' },
  cardDim: { opacity: 0.45 },
  cardMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
  },
  docIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  docInfo: { flex: 1, minWidth: 0 },
  docTitle: { ...type.label, marginBottom: space.xs },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  categoryBadge: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, backgroundColor: color.secondary, maxWidth: 160 },
  categoryText: { ...type.meta, color: '#FFFFFF', fontWeight: '600' },
  vaultTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 170,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1,
    backgroundColor: color.tint, borderWidth: 1, borderColor: '#D6E2F5',
  },
  vaultTagText: { ...type.meta, color: color.primary, fontWeight: '600', flexShrink: 1 },
  docDate: type.meta,
  tabs: {
    flexDirection: 'row', gap: space.xs, padding: space.xs,
    backgroundColor: color.surface, borderRadius: radius.control, ...shadow.card,
  },
  tab: {
    flex: 1, minHeight: 40, borderRadius: 10, paddingHorizontal: space.xs,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  tabText: { ...type.label, fontWeight: '600', flexShrink: 1 },
  tabCount: { ...type.caption, fontWeight: '600' },
  tabTextOn: { color: '#FFFFFF' },
  narrowRow: { flexDirection: 'row' },
  narrowChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill,
  },
  narrowText: { ...type.label, fontWeight: '600', flexShrink: 1 },
  group: { backgroundColor: color.surface, borderRadius: radius.card, ...shadow.card },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: size.row, paddingHorizontal: space.lg, paddingVertical: space.sm },
  groupBorder: { borderTopWidth: 1, borderTopColor: color.divider },
  avatar: { width: size.iconBox, height: size.iconBox, borderRadius: size.iconBox / 2, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...type.label, fontWeight: '700' },
  groupText: { flex: 1, minWidth: 0 },
  groupName: type.label,
  groupSub: type.caption,
  manage: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: size.control, paddingHorizontal: space.lg, marginTop: space.sm,
    backgroundColor: color.surface, borderRadius: radius.control, ...shadow.card,
  },
  manageText: { ...type.label, fontWeight: '600' },
  bin: { width: size.control, height: size.control, alignItems: 'center', justifyContent: 'center', marginRight: space.xs },
  empty: { alignItems: 'center', paddingVertical: 40, gap: space.sm },
  emptyTitle: { ...type.heading, color: color.textMuted },
  emptyText: { ...type.caption, textAlign: 'center' },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.border,
  },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    minHeight: size.control, borderRadius: radius.control, backgroundColor: color.danger,
  },
  deleteBtnOff: { backgroundColor: '#FCA5A5' },
  deleteBtnText: { ...type.button, color: '#FFFFFF' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: space.xl },
  dialog: {
    backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg + 4,
    width: '100%', maxWidth: 360, boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.15)', elevation: 10,
  },
  dialogTitle: { ...type.title, color: color.text, marginBottom: space.sm },
  dialogText: { ...type.body, color: color.textMuted, marginBottom: space.xl },
  dialogButtons: { flexDirection: 'row', gap: space.md },
  cancelBtn: {
    flex: 1, minHeight: size.control, justifyContent: 'center', alignItems: 'center',
    borderRadius: radius.control, backgroundColor: color.divider,
  },
  cancelText: { ...type.button, color: '#4B5563' },
  confirmBtn: {
    flex: 1, minHeight: size.control, justifyContent: 'center', alignItems: 'center',
    borderRadius: radius.control, backgroundColor: '#EF4444',
  },
  confirmText: { ...type.button, color: '#FFFFFF' },
});
