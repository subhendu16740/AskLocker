// Drawer › Overview, in a business (056): what its own papers say. Counts on
// every plan; renewals and bills due on Business Plus; money in and out by
// month on Pro and Enterprise. The server sends only what the plan covers,
// so a locked card shows the count and opens Plans. Dates and amounts are as
// ingest read them, and the screen says so: each row opens its document.

import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFamily } from '../lib/family-context';
import { isBusinessVault, vaultName } from '../lib/vaults';
import { plusPage, type BusinessFeature } from '../lib/family-plan';
import {
  FeatureUnavailable, fetchBusinessOverview, setBillPaid,
  type BusinessOverview, type OverviewBill, type OverviewRenewal,
} from '../lib/api';
import {
  compactRupees, daysFromToday, financialYearTotals, formatRupees, monthlyTotals, shortDate, whenText,
} from '../lib/overview';
import { ScreenHeader, PlusTag } from '../components/screen-header';
import { Card, CardTitle, Muted, SecondaryButton, Status, screenStyles } from '../components/settings-ui';
import { biz, color, radius, space, type } from '../constants/design';
import { track } from '../lib/analytics';

// Two series, validated together for colour-blind separation and contrast
// on the white card (dataviz validator, light mode): money in, money out.
const IN = '#3E6BB0';
const OUT = '#C9625A';
const WARN = '#B45309';

const LIST_MAX = 6;

export default function OverviewScreen() {
  const { currentFamily } = useFamily();
  const business = isBusinessVault(currentFamily);
  const [data, setData] = useState<BusinessOverview | null>(null);
  const [problem, setProblem] = useState<{ unavailable: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setProblem(null);
    if (!currentFamily || !business) return;
    fetchBusinessOverview(currentFamily.id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => {
        if (cancelled) return;
        setProblem({ unavailable: err instanceof FeatureUnavailable, text: err?.message || "Couldn't load the overview." });
      });
    return () => { cancelled = true; };
  }, [currentFamily?.id, business]);

  useFocusEffect(useCallback(() => load(), [load]));

  if (!business) {
    return (
      <SafeAreaView style={screenStyles.safe} edges={['top']}>
        <ScreenHeader title="Overview" fallback="/home" />
        <ScrollView contentContainerStyle={screenStyles.body}>
          <Status kind="error">The overview is for business vaults. Open one in Manage Family.</Status>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Overview" fallback="/home" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        {problem ? (
          <>
            <Status kind="error">{problem.text}</Status>
            {!problem.unavailable && <SecondaryButton label="Try again" icon="refresh-cw" onPress={load} />}
          </>
        ) : !data ? (
          <View style={styles.center}>
            <ActivityIndicator color={biz.primary} />
          </View>
        ) : (
          <>
            <Text style={styles.intro}>What {vaultName(currentFamily)}'s documents say.</Text>
            <Tiles data={data} />
            <Renewals data={data} />
            <Bills data={data} familyId={currentFamily!.id} onChange={setData} />
            <Money data={data} />
            <Muted>Dates and amounts are read from your documents. Open one to check it.</Muted>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── The four numbers ──────────────────────────────────────────────

function Tiles({ data }: { data: BusinessOverview }) {
  const tiles = [
    { label: 'Renewals in 90 days', value: data.counts.renewals },
    { label: 'Expired lately', value: data.counts.expired, alert: data.counts.expired > 0 },
    { label: 'Bills with a due date', value: data.counts.bills },
    { label: 'Invoices and bills', value: data.counts.invoices },
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map((t) => (
        <View key={t.label} style={styles.tile} accessible accessibilityLabel={`${t.label}: ${t.value}`}>
          <Text style={styles.tileValue}>{t.value}</Text>
          <View style={styles.tileLabelRow}>
            {t.alert && <Feather name="alert-circle" size={12} color={color.danger} />}
            <Text style={styles.tileLabel}>{t.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── A card a plan opens ───────────────────────────────────────────

function Locked({ title, icon, text, feature, plan }: { title: string; icon: string; text: string; feature: BusinessFeature; plan: string }) {
  return (
    <TouchableOpacity
      onPress={() => router.push(plusPage(feature) as any)}
      activeOpacity={0.8}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${text} Comes with ${plan}.`}
    >
      <Card>
        <View style={styles.lockedHead}>
          <CardTitle icon={icon}>{title}</CardTitle>
          <PlusTag name={plan} />
        </View>
        <Text style={styles.body}>{text}</Text>
        <Text style={styles.link}>See plans ›</Text>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Renewals ──────────────────────────────────────────────────────

function Renewals({ data }: { data: BusinessOverview }) {
  const [all, setAll] = useState(false);
  if (!data.renewals) {
    return (
      <Locked
        title="Renewals"
        icon="refresh-cw"
        feature="overview"
        plan="Plus"
        text={data.counts.renewals + data.counts.expired > 0
          ? `${data.counts.renewals} coming up in the next 90 days, ${data.counts.expired} expired lately. See them all with dates.`
          : 'See every licence, policy and lease coming up for renewal, with dates.'}
      />
    );
  }
  const rows = all ? data.renewals : data.renewals.slice(0, LIST_MAX);
  return (
    <Card>
      <CardTitle icon="refresh-cw">Renewals</CardTitle>
      {data.renewals.length === 0
        ? <Muted>Nothing expires in the next 90 days.</Muted>
        : rows.map((r) => <RenewalRow key={r.documentId} r={r} />)}
      {data.renewals.length > LIST_MAX && (
        <Text style={styles.link} onPress={() => setAll(!all)} accessibilityRole="button">
          {all ? 'Show fewer' : `Show all ${data.renewals.length}`}
        </Text>
      )}
    </Card>
  );
}

function RenewalRow({ r }: { r: OverviewRenewal }) {
  const days = daysFromToday(r.expiry);
  const tone = days < 0 ? 'late' : days <= 30 ? 'soon' : 'later';
  const when = days < 0 ? `Expired ${-days === 1 ? 'yesterday' : `${-days} days ago`}` : whenText(days);
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => router.push(`/document/${r.documentId}` as any)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${r.fileName}, ${when}, ${shortDate(r.expiry)}`}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle} numberOfLines={1}>{r.fileName}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{[r.category, shortDate(r.expiry)].filter(Boolean).join(' · ')}</Text>
      </View>
      <When tone={tone} text={when} />
    </TouchableOpacity>
  );
}

function When({ tone, text }: { tone: 'late' | 'soon' | 'later'; text: string }) {
  const c = tone === 'late' ? color.danger : tone === 'soon' ? WARN : color.textMuted;
  return (
    <View style={styles.when}>
      {tone !== 'later' && <Feather name={tone === 'late' ? 'alert-circle' : 'clock'} size={12} color={c} />}
      <Text style={[styles.whenText, { color: c }]}>{text}</Text>
    </View>
  );
}

// ─── Bills due ─────────────────────────────────────────────────────

function Bills({ data, familyId, onChange }: { data: BusinessOverview; familyId: string; onChange: (d: BusinessOverview) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!data.bills) {
    return (
      <Locked
        title="Bills due"
        icon="file-text"
        feature="overview"
        plan="Plus"
        text={data.counts.bills > 0
          ? `${data.counts.bills} of your bills and invoices have a due date. See what's due and mark them paid.`
          : "See what's due to pay and to collect, and mark bills paid."}
      />
    );
  }
  const markPaid = async (b: OverviewBill) => {
    setBusy(b.documentId);
    setFailed(null);
    try {
      await setBillPaid(familyId, b.documentId, true);
      track('bill_marked_paid', {});
      onChange({
        ...data,
        bills: (data.bills ?? []).filter((x) => x.documentId !== b.documentId),
        counts: { ...data.counts, bills: Math.max(0, data.counts.bills - 1) },
      });
    } catch (err: any) {
      setFailed(err?.message || "Couldn't mark it paid.");
    } finally {
      setBusy(null);
    }
  };
  const byDue = (a: OverviewBill, b: OverviewBill) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity);
  const pay = data.bills.filter((b) => !b.collect).sort(byDue);
  const collect = data.bills.filter((b) => b.collect).sort(byDue);
  return (
    <Card>
      <CardTitle icon="file-text">Bills due</CardTitle>
      {data.bills.length === 0 && <Muted>No bill or invoice with a due date is waiting.</Muted>}
      {pay.length > 0 && <BillGroup title="To pay" bills={pay} busy={busy} onPaid={markPaid} />}
      {collect.length > 0 && <BillGroup title="To collect" bills={collect} busy={busy} onPaid={markPaid} />}
      {failed && <Status kind="error">{failed}</Status>}
    </Card>
  );
}

function BillGroup({ title, bills, busy, onPaid }: { title: string; bills: OverviewBill[]; busy: string | null; onPaid: (b: OverviewBill) => void }) {
  const [all, setAll] = useState(false);
  const total = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
  const rows = all ? bills : bills.slice(0, LIST_MAX);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}{total > 0 ? ` · ${formatRupees(total)}` : ''}</Text>
      {rows.map((b) => {
        const days = b.due ? daysFromToday(b.due) : null;
        const tone = days == null ? 'later' : days < 0 ? 'late' : days <= 7 ? 'soon' : 'later';
        const when = days == null ? 'No date read' : days < 0 ? `${-days} ${-days === 1 ? 'day' : 'days'} late` : `Due ${whenText(days).toLowerCase()}`;
        return (
          <View key={b.documentId} style={styles.row}>
            <TouchableOpacity
              style={styles.rowMain}
              onPress={() => router.push(`/document/${b.documentId}` as any)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.rowTitle} numberOfLines={1}>{b.invoiceNumber ? `${b.invoiceNumber} · ${b.fileName}` : b.fileName}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {[b.amount != null ? formatRupees(b.amount) : null, b.due ? shortDate(b.due) : null].filter(Boolean).join(' · ')}
              </Text>
            </TouchableOpacity>
            <View style={styles.billSide}>
              <When tone={tone} text={when} />
              <TouchableOpacity
                onPress={() => onPaid(b)}
                disabled={busy === b.documentId}
                style={styles.paidBtn}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${b.invoiceNumber ?? b.fileName} paid`}
              >
                {busy === b.documentId
                  ? <ActivityIndicator size="small" color={biz.primary} />
                  : <Text style={styles.paidText}>Mark paid</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
      {bills.length > LIST_MAX && (
        <Text style={styles.link} onPress={() => setAll(!all)} accessibilityRole="button">
          {all ? 'Show fewer' : `Show all ${bills.length}`}
        </Text>
      )}
    </View>
  );
}

// ─── Money in and out ──────────────────────────────────────────────

function Money({ data }: { data: BusinessOverview }) {
  const rows = data.money;
  const months = useMemo(() => (rows ? monthlyTotals(rows, 6) : []), [rows]);
  const year = useMemo(() => (rows ? financialYearTotals(rows) : null), [rows]);
  const lastWithData = months.map((m, i) => (m.in || m.out ? i : -1)).filter((i) => i >= 0).pop() ?? months.length - 1;
  const [picked, setPicked] = useState<number | null>(null);
  if (!rows) {
    return (
      <Locked
        title="Money in and out"
        icon="bar-chart-2"
        feature="money"
        plan="Pro"
        text={data.counts.invoices > 0
          ? `See what came in and went out each month, from your ${data.counts.invoices} invoices and bills.`
          : 'See what came in and went out each month, from your invoices and bills.'}
      />
    );
  }
  const unread = rows.filter((r) => r.amount == null).length;
  const max = Math.max(1, ...months.flatMap((m) => [m.in, m.out]));
  const sel = months[picked ?? lastWithData];
  return (
    <Card>
      <CardTitle icon="bar-chart-2">Money in and out</CardTitle>
      {rows.length === 0 ? (
        <Muted>File your invoices under Sales Invoices and bills under Purchase Bills to see them here.</Muted>
      ) : (
        <>
          <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: IN }]} /><Text style={styles.legendText}>In (sales)</Text></View>
            <View style={styles.legendItem}><View style={[styles.swatch, { backgroundColor: OUT }]} /><Text style={styles.legendText}>Out (purchases)</Text></View>
          </View>
          {sel && (
            <Text style={styles.selected} accessibilityLiveRegion="polite">
              {sel.label} {sel.year}: in {formatRupees(sel.in)}, out {formatRupees(sel.out)}
            </Text>
          )}
          <View style={styles.chart}>
            <Text style={styles.axisTop}>{compactRupees(max)}</Text>
            <View style={styles.gridTop} />
            <View style={styles.plot}>
              {months.map((m, i) => (
                <Pressable
                  key={`${m.year}-${m.month}`}
                  style={styles.slot}
                  onPress={() => setPicked(i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.label} ${m.year}: in ${formatRupees(m.in)}, out ${formatRupees(m.out)}`}
                >
                  <View style={styles.bars}>
                    <View style={[styles.bar, { backgroundColor: IN, height: barHeight(m.in, max) }]} />
                    <View style={[styles.bar, { backgroundColor: OUT, height: barHeight(m.out, max) }]} />
                  </View>
                  <Text style={[styles.monthLabel, (picked ?? lastWithData) === i && styles.monthLabelOn]}>{m.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {year && (
            <Text style={styles.year}>
              Since {shortDate(year.from)}: in {formatRupees(year.in)}, out {formatRupees(year.out)}
            </Text>
          )}
          {unread > 0 && <Muted>{unread} {unread === 1 ? 'document has' : 'documents have'} no total we could read.</Muted>}
        </>
      )}
    </Card>
  );
}

const PLOT = 132;
// Bars grow from one baseline; a value above zero shows at least a sliver.
const barHeight = (v: number, max: number) => (v <= 0 ? 0 : Math.max(3, Math.round((v / max) * PLOT)));

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 40 },
  intro: { ...type.body },
  body: { ...type.body },
  link: { ...type.caption, fontWeight: '600', color: biz.primary, marginTop: space.xs },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexGrow: 1, flexBasis: '45%', backgroundColor: color.surface, borderRadius: radius.control,
    borderWidth: 1, borderColor: color.border, padding: space.md, gap: 2,
  },
  tileValue: { fontSize: 24, lineHeight: 30, fontWeight: '600', color: color.text },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { ...type.caption },
  lockedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm,
    borderTopWidth: 1, borderTopColor: color.divider,
  },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.label, fontSize: 14 },
  rowSub: { ...type.caption },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  whenText: { ...type.meta, fontSize: 12, fontWeight: '600' },
  group: { gap: 0, marginTop: space.xs },
  groupTitle: { ...type.overline, marginTop: space.sm, marginBottom: space.xs },
  billSide: { alignItems: 'flex-end', gap: 4 },
  paidBtn: {
    minHeight: 28, minWidth: 76, paddingHorizontal: space.sm, borderRadius: 8, borderWidth: 1,
    borderColor: color.inputBorder, alignItems: 'center', justifyContent: 'center',
  },
  paidText: { ...type.meta, fontSize: 12, fontWeight: '600', color: biz.primary },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { ...type.caption, color: color.textBody },
  selected: { ...type.label, fontSize: 14 },
  chart: { marginTop: space.xs },
  axisTop: { ...type.meta, color: color.textMuted },
  gridTop: { height: 1, backgroundColor: color.divider, marginTop: 2 },
  plot: { flexDirection: 'row', alignItems: 'flex-end', height: PLOT + 24, borderTopWidth: 0 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: PLOT + 24 },
  bars: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: PLOT,
    borderBottomWidth: 1, borderBottomColor: color.inputBorder, paddingHorizontal: 2, alignSelf: 'stretch', justifyContent: 'center',
  },
  bar: { width: 14, maxWidth: 24, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  monthLabel: { ...type.meta, color: color.textMuted, marginTop: 4, height: 16 },
  monthLabelOn: { color: color.text, fontWeight: '600' },
  year: { ...type.caption, color: color.textBody },
});
