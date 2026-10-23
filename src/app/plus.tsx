// Family Plus and Family Pro (064) — what the paid plans give, side by side
// with Free. Every starred feature (★) opens this page for a free family
// (/plus?feature=…, which says which feature brought them here), and so do
// Settings, Storage and a full vault. Choosing Plus or Pro shows its monthly
// and yearly price; where payments are switched on (044: this project's
// Razorpay keys are set), any member pays here, and each payment adds that
// time. Until then the page says "Coming soon" instead of offering a button
// that does nothing.
//
// A business (051) sees its own plans instead — Plus, Pro and Enterprise,
// side by side with their prices before GST — and is never offered Family
// Plus: its plans are set up with us (ask in Settings › Feedback), not
// bought here. Nothing is ever removed from a business.

import { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily } from '../lib/family-context';
import { isBusinessVault, isPersonalVault, vaultName } from '../lib/vaults';
import { forgetOnPlus, useFamilyPlan, usePaymentsStatus, type BusinessFeature, type PlusFeature } from '../lib/family-plan';
import { PaymentError, createPlusOrder, fetchPlanLimits, fetchPlusPeriod, verifyPlusPayment } from '../lib/api';
import { checkoutSupported, openCheckout } from '../lib/razorpay';
import {
  CLOSED_MESSAGE, DEFAULT_PLAN_LIMITS, businessAmount, businessPlanName, familyPlanName, formatBytes, isBusinessPlan,
  localCurrency, localPlusAmount, localPlusPrice, localPlusYearlyOffer, localPlusYearlySaving, nextBusinessPlan,
  type BusinessPlan, type FamilyPlan, type PlanLimits,
} from '../lib/plans';
import { longDate } from '../lib/dates';
import { ScreenHeader } from '../components/screen-header';
import { TwelveMonthsPrice } from '../components/plus-price';
import { Card, Muted, screenStyles } from '../components/settings-ui';
import { biz, color, radius, space, type } from '../constants/design';
import { BUSINESS_THEME } from '../lib/vault-theme';
import { track } from '../lib/analytics';

type Cell = boolean | string;

interface Row {
  label: string;
  /** One short line under the label, where the name alone is not clear. */
  sub?: string;
  free: Cell;
  plus: Cell;
  pro: Cell;
  /** The starred feature this row is, so the page can point at it. */
  feature?: PlusFeature;
}

// "10 each" (per person, 043), or "No limit".
const voiceCell = (n: number | null): Cell => (n == null ? 'No limit' : `${n} each`);
// "20 each" a month (049), or "No limit" (Plus and Pro since 064).
const questionsCell = (n: number | null): Cell => (n == null ? 'No limit' : `${n} each`);

/**
 * What the plans give, clearest first. A star after a feature: it is more on
 * a paid plan. Family tree and emergency cards are on every plan, so they are
 * not here (the owner's ask, 23 October 2026).
 */
function rows(limits: PlanLimits, freeSpace: number): Row[] {
  const all: Array<Row | null> = [
    { label: 'Members', sub: 'People who sign in', free: String(limits.members.free), plus: String(limits.members.plus), pro: String(limits.familyPro.members), feature: 'members' },
    { label: 'Space', sub: 'For your documents', free: formatBytes(freeSpace), plus: formatBytes(limits.plus), pro: formatBytes(limits.familyPro.storage), feature: 'storage' },
    // Before 049 nobody's questions are counted, on any plan.
    limits.questions.free == null ? null : {
      label: 'Questions', sub: 'Each month', free: questionsCell(limits.questions.free),
      // 053's family number, where a database still has it.
      plus: limits.familyQuestions != null ? `${limits.familyQuestions} family` : questionsCell(limits.questions.plus),
      pro: limits.familyQuestions != null ? `${limits.familyQuestions} family` : questionsCell(limits.questions.plus),
      feature: 'questions',
    },
    { label: 'Ask by voice', sub: 'Talk and hear answers', free: voiceCell(limits.voiceAnswers.free), plus: voiceCell(limits.voiceAnswers.plus), pro: voiceCell(limits.voiceAnswers.plus), feature: 'voice' },
    limits.questions.free == null ? null : {
      label: 'Share a document', sub: 'A link for your CA or agent', free: '7 days', plus: '30 days', pro: '30 days', feature: 'links',
    },
    { label: 'Expiry reminders', sub: 'Before a passport or policy runs out', free: false, plus: true, pro: true, feature: 'reminders' },
    { label: 'Birthday reminders', sub: 'For everyone in your tree', free: false, plus: true, pro: true, feature: 'birthdays' },
    { label: 'Indian languages', sub: 'Read and talk in Hindi and more', free: 'English', plus: true, pro: true, feature: 'languages' },
    { label: 'Import from Gmail', sub: 'Attachments from your email', free: false, plus: true, pro: true, feature: 'gmail' },
  ];
  return all.filter((r): r is Row => r !== null);
}

// Which feature brought them here, and the plan that has it.
const BROUGHT_BY: Record<PlusFeature, { icon: string; text: (name: string) => string }> = {
  reminders: { icon: 'clock', text: (n) => `Expiry reminders come with ${n}.` },
  gmail: { icon: 'mail', text: (n) => `Import from Gmail comes with ${n}.` },
  storage: { icon: 'hard-drive', text: (n) => `More space comes with ${n}.` },
  voice: { icon: 'mic', text: (n) => `Asking by voice with no limit comes with ${n}.` },
  questions: { icon: 'message-circle', text: (n) => `More questions come with ${n}.` },
  members: { icon: 'users', text: (n) => `Room for more members comes with ${n}.` },
  links: { icon: 'link', text: (n) => `30-day share links come with ${n}.` },
  birthdays: { icon: 'gift', text: (n) => `Birthday reminders come with ${n}.` },
  languages: { icon: 'globe', text: (n) => `Indian languages come with ${n}.` },
};

const said = (cell: Cell) => (cell === true ? 'yes' : cell === false ? 'no' : cell);

function CellView({ value, plus, tone }: { value: Cell; plus?: boolean; tone?: string }) {
  if (value === true) return <Feather name="check" size={18} color="#16A34A" />;
  if (value === false) return <Feather name="minus" size={18} color="#9CA3AF" />;
  return <Text style={[styles.cellText, plus && styles.cellTextPlus, plus && !!tone && { color: tone }]}>{value}</Text>;
}

export default function PlusScreen() {
  const { currentFamily } = useFamily();
  return isBusinessVault(currentFamily) ? <BusinessPlans /> : <FamilyPlus />;
}

const FAMILY_COLUMNS = ['free', 'plus', 'family_pro'] as const;
const short = (p: FamilyPlan) => (p === 'family_pro' ? 'Pro' : 'Plus');

function FamilyPlus() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { currentFamily } = useFamily();
  const { plan, paidUntil, removalAt, closed, trial, refresh } = useFamilyPlan();
  const onPlan: FamilyPlan | null = plan === 'plus' || plan === 'family_pro' ? plan : null;
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_PLAN_LIMITS);
  // The plan they chose, whose monthly and yearly prices show.
  const [chosen, setChosen] = useState<FamilyPlan | null>(null);
  const scroll = useRef<ScrollView>(null);
  const choiceAt = useRef(0);
  // Members and space come with Pro for a family already on Plus.
  const broughtPlan: FamilyPlan = onPlan === 'plus' ? 'family_pro' : 'plus';
  const broughtBy = feature && feature in BROUGHT_BY ? BROUGHT_BY[feature as PlusFeature] : null;

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    track('plus_viewed', { feature: feature && feature in BROUGHT_BY ? feature : 'none' });
    refresh(true);
    fetchPlanLimits().then((l) => { if (!cancelled) setLimits(l); });
    return () => { cancelled = true; };
  }, [refresh, feature]));

  const choose = (p: FamilyPlan) => {
    setChosen(p);
    // The choice is right under the plans; bring it into view.
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, choiceAt.current - space.lg), animated: true }), 50);
  };

  // The Current column: none while unknown, and none once a plan has ended.
  const currentColumn = onPlan ? FAMILY_COLUMNS.indexOf(onPlan) : plan === 'free' && !closed ? 0 : -1;
  const familyName = currentFamily ? vaultName(currentFamily) : undefined;
  // What this vault may keep on Free (048): a personal vault less than a family.
  const freeHere = isPersonalVault(currentFamily) ? limits.freePersonal : limits.free;
  const table = rows(limits, freeHere);

  // ─── Paying (044, 064) ──────────────────────────────────
  const payments = usePaymentsStatus();
  const currency = localCurrency() === 'inr' ? 'INR' : 'USD';
  const canPayHere = !!payments?.currencies.includes(currency);
  const [paying, setPaying] = useState<'monthly' | 'yearly' | null>(null);
  const [payNote, setPayNote] = useState<{ tone: 'ok' | 'info' | 'error'; text: string } | null>(null);

  const pay = async (want: FamilyPlan, period: 'monthly' | 'yearly') => {
    if (!currentFamily || paying) return;
    const name = familyPlanName(want);
    setPaying(period);
    setPayNote(null);
    try {
      track('pay_started', { period, currency });
      const order = await createPlusOrder(currentFamily.id, period, currency, want);
      const result = await openCheckout(order);
      if (result.status === 'closed' || result.status === 'unsupported') return;
      if (result.status === 'failed') {
        setPayNote({ tone: 'error', text: `${result.reason} You weren't charged.` });
        return;
      }
      setPayNote({ tone: 'info', text: `Payment received. Switching on ${name}…` });
      try {
        const { paidUntil } = await verifyPlusPayment(result);
        track('payment_done', { period, currency });
        await refresh(true);
        forgetOnPlus();
        setPayNote({
          tone: 'ok',
          text: `Thank you! ${familyName ?? 'Your family'} has ${name} until ${longDate(new Date(paidUntil))}.`,
        });
      } catch (err) {
        if (err instanceof PaymentError && err.status === 'not_paid') {
          setPayNote({ tone: 'error', text: err.message });
          return;
        }
        // Razorpay tells the server too (its webhook), so a payment that went
        // through switches the plan on even when this check could not finish.
        setPayNote({
          tone: 'info',
          text: `We're still confirming your payment. If it went through, ${name} turns on in a few minutes. You don't need to pay again.`,
        });
        setTimeout(() => {
          refresh(true);
          forgetOnPlus();
          fetchPlusPeriod(currentFamily.id).catch(() => null);
        }, 30_000);
      }
    } catch (err) {
      setPayNote({ tone: 'error', text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setPaying(null);
    }
  };

  const planLine = (p: FamilyPlan) =>
    `${p === 'family_pro' ? limits.familyPro.members : limits.members.plus} members · ${formatBytes(p === 'family_pro' ? limits.familyPro.storage : limits.plus)}`;

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Plans" fallback="/home" />
      <ScrollView ref={scroll} contentContainerStyle={screenStyles.body}>
        {broughtBy && onPlan !== 'family_pro' && (
          <View style={styles.brought} accessibilityLiveRegion="polite">
            <Feather name={broughtBy.icon as any} size={16} color={color.primary} />
            <Text style={styles.broughtText}>{broughtBy.text(familyPlanName(broughtPlan))}</Text>
          </View>
        )}

        <LinearGradient colors={['#2A3D66', '#4A6491']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroTag}>★ Family Plus and Pro</Text>
          <Text style={styles.heroTitle}>More space and more help for your family</Text>
          <View style={styles.heroCells}>
            {(['plus', 'family_pro'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.heroCell, chosen === p && styles.heroCellChosen]}
                onPress={() => choose(p)}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen === p }}
                accessibilityLabel={`${familyPlanName(p)}, ${planLine(p)}, ${localPlusPrice('monthly', p)}${onPlan === p ? ', your plan' : ''}`}
              >
                <Text style={styles.heroCellLabel}>{familyPlanName(p)}</Text>
                <Text style={styles.heroAmount}>{localPlusAmount('monthly', p)}</Text>
                <Text style={styles.heroPer}>a month</Text>
                <Text style={styles.heroLine}>{planLine(p)}</Text>
                <View style={styles.heroPick}>
                  <Text style={styles.heroPickText}>{onPlan === p ? 'Your plan' : chosen === p ? 'Chosen' : 'Choose'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.heroNote}>
            {familyName ? `One plan for everyone in ${familyName}.` : 'One plan for everyone in the family.'}
          </Text>
        </LinearGradient>

        {onPlan ? (
          <View style={[styles.state, styles.statePlus]}>
            <Feather name="check-circle" size={18} color="#15803D" />
            <Text style={[styles.stateText, { color: '#15803D' }]}>
              {familyName ?? 'Your family'} has {familyPlanName(onPlan)}
              {trial ? ' on trial' : ''}{paidUntil ? `, until ${longDate(new Date(paidUntil))}` : ''}.
            </Text>
          </View>
        ) : plan === 'free' && closed ? (
          <View style={[styles.state, styles.stateEnded]}>
            <Feather name="alert-triangle" size={18} color="#B91C1C" />
            <Text style={[styles.stateText, { color: '#B91C1C' }]}>{CLOSED_MESSAGE}</Text>
          </View>
        ) : plan === 'free' && removalAt ? (
          <View style={[styles.state, styles.stateEnded]}>
            <Feather name="alert-triangle" size={18} color="#B91C1C" />
            <Text style={[styles.stateText, { color: '#B91C1C' }]}>
              Your paid plan has ended for {familyName ?? 'your family'}. On {longDate(new Date(removalAt))}, the newest
              documents over {formatBytes(freeHere)} will be removed. Renew, or delete documents to get under{' '}
              {formatBytes(freeHere)}.
            </Text>
          </View>
        ) : plan === 'free' ? (
          <View style={styles.state}>
            <Feather name="info" size={18} color={color.primary} />
            <Text style={styles.stateText}>{familyName ?? 'Your family'} is on Free.</Text>
          </View>
        ) : null}

        {/* The plan chosen: its monthly and yearly price, and paying. */}
        <View onLayout={(e) => { choiceAt.current = e.nativeEvent.layout.y; }}>
          {chosen && (
            <Card style={styles.payCard}>
              <Text style={styles.payTitle}>
                {onPlan === chosen ? `Add more time to ${familyPlanName(chosen)}` : familyPlanName(chosen)}
              </Text>
              <View style={styles.options}>
                <View
                  style={styles.option}
                  accessible
                  accessibilityLabel={`Yearly, ${localPlusYearlyOffer(chosen)}, ${localPlusYearlySaving(chosen)}`}
                >
                  <Text style={styles.optionLabel}>Yearly</Text>
                  <TwelveMonthsPrice plan={chosen} style={styles.optionWas} />
                  <Text style={styles.optionAmount}>{localPlusAmount('yearly', chosen)}</Text>
                  <Text style={styles.optionPer}>a year</Text>
                  <View style={styles.optionSave}>
                    <Text style={styles.optionSaveText}>{localPlusYearlySaving(chosen)}</Text>
                  </View>
                </View>
                <View style={styles.option} accessible accessibilityLabel={`Monthly, ${localPlusPrice('monthly', chosen)}`}>
                  <Text style={styles.optionLabel}>Monthly</Text>
                  {/* As tall as the crossed-out price, so the amounts sit level. */}
                  <View style={styles.optionWasSpace} />
                  <Text style={styles.optionAmount}>{localPlusAmount('monthly', chosen)}</Text>
                  <Text style={styles.optionPer}>a month</Text>
                </View>
              </View>

              {!payments ? null : !payments.available ? (
                <View style={styles.soon}>
                  <Text style={styles.soonTag}>Coming soon</Text>
                  <Text style={styles.soonText}>You can't buy {familyPlanName(chosen)} yet.</Text>
                </View>
              ) : !checkoutSupported ? (
                <Text style={styles.payFine}>For now, you can pay on the AskLocker web app.</Text>
              ) : !canPayHere ? (
                <Text style={styles.payFine}>Paying from outside India is coming soon.</Text>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.payBtn, styles.payBtnMain, !!paying && styles.payBtnBusy]}
                    onPress={() => pay(chosen, 'yearly')}
                    disabled={!!paying}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay ${localPlusAmount('yearly', chosen)} for a year of ${familyPlanName(chosen)}`}
                  >
                    {paying === 'yearly' ? <ActivityIndicator color="#FFFFFF" /> : (
                      <Text style={styles.payBtnText}>Pay {localPlusAmount('yearly', chosen)} for 1 year</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.payBtn, styles.payBtnOther, !!paying && styles.payBtnBusy]}
                    onPress={() => pay(chosen, 'monthly')}
                    disabled={!!paying}
                    accessibilityRole="button"
                    accessibilityLabel={`Pay ${localPlusAmount('monthly', chosen)} for a month of ${familyPlanName(chosen)}`}
                  >
                    {paying === 'monthly' ? <ActivityIndicator color={color.primary} /> : (
                      <Text style={styles.payBtnTextOther}>Pay {localPlusAmount('monthly', chosen)} for 1 month</Text>
                    )}
                  </TouchableOpacity>
                  <Text style={styles.payFine}>
                    UPI, card or net banking, through Razorpay. Nothing renews by itself.
                    {onPlan === chosen ? ' New time is added to what you have left.'
                      : onPlan ? ` The time left on ${familyPlanName(onPlan)} moves to ${familyPlanName(chosen)}.` : ''}
                  </Text>
                </>
              )}
              {payNote && (
                <Text
                  style={[styles.payMsg, payNote.tone === 'ok' ? styles.payMsgOk : payNote.tone === 'error' ? styles.payMsgError : null]}
                  accessibilityLiveRegion="polite"
                >
                  {payNote.text}
                </Text>
              )}
            </Card>
          )}
        </View>

        <Card style={styles.tableCard}>
          {currentColumn >= 0 && (
            <CurrentColumn from={currentColumn} to={currentColumn} count={3} width={FAMILY_VALUE} tone={color.primary} tint="#F3F6FB" />
          )}
          <View style={[styles.row, styles.headRow, currentColumn >= 0 && styles.headRowTagged]}>
            <Text style={[styles.label, styles.headText]}>What you get</Text>
            <Text style={[styles.value, styles.valueFamily, styles.headText]} accessibilityLabel={currentColumn === 0 ? 'Free, your plan' : 'Free'}>Free</Text>
            {(['plus', 'family_pro'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.value, styles.valueFamily]}
                onPress={() => choose(p)}
                accessibilityRole="button"
                accessibilityLabel={`${familyPlanName(p)}${onPlan === p ? ', your plan' : ''}. Choose it to see the prices.`}
              >
                <Text style={[styles.headText, styles.headPlus, chosen === p && styles.headChosen]}>{short(p)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {table.map((r) => {
            const pointed = !!broughtBy && r.feature === feature && onPlan !== 'family_pro';
            return (
              <View
                key={r.label}
                style={[styles.row, pointed && styles.rowPointed]}
                accessible
                accessibilityLabel={`${r.label}${r.sub ? `, ${r.sub}` : ''}: Free ${said(r.free)}, Family Plus ${said(r.plus)}, Family Pro ${said(r.pro)}`}
              >
                <View style={styles.labelBox}>
                  <Text style={styles.label}>
                    {r.label}
                    {/* After the name, never on a line of its own. */}
                    {r.free !== r.pro && <Text style={styles.star}>{'\u00A0★'}</Text>}
                  </Text>
                  {!!r.sub && <Text style={styles.labelSub}>{r.sub}</Text>}
                </View>
                <View style={[styles.value, styles.valueFamily]}><CellView value={r.free} /></View>
                <View style={[styles.value, styles.valueFamily]}><CellView value={r.plus} plus /></View>
                <View style={[styles.value, styles.valueFamily]}><CellView value={r.pro} plus /></View>
              </View>
            );
          })}
          <View
            style={[styles.row, styles.priceRow]}
            accessible
            accessibilityLabel={`Price: Free costs nothing. Family Plus ${localPlusPrice('monthly', 'plus')} or ${localPlusPrice('yearly', 'plus')}. Family Pro ${localPlusPrice('monthly', 'family_pro')} or ${localPlusPrice('yearly', 'family_pro')}.`}
          >
            <Text style={[styles.label, styles.priceLabel]}>Price</Text>
            <View style={[styles.value, styles.valueFamily]}>
              <Text style={styles.cellText}>Free</Text>
            </View>
            {(['plus', 'family_pro'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.value, styles.valueFamily]} onPress={() => choose(p)} accessibilityElementsHidden>
                <Text style={[styles.cellText, styles.cellTextPlus]}>{localPlusAmount('monthly', p)}</Text>
                <Text style={styles.cellPer}>a month</Text>
                <Text style={[styles.cellText, styles.cellTextPlus, styles.cellYear]}>{localPlusAmount('yearly', p)}</Text>
                <Text style={styles.cellPer}>a year</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Muted>
          {limits.questions.free != null && limits.questions.plus == null && limits.familyQuestions == null && limits.questionTriesPerDay.plus != null
            ? `Questions on Plus and Pro have no monthly limit. Each person can ask up to ${limits.questionTriesPerDay.plus} a day.\n`
            : ''}
          {`If a paid plan ends and a vault is over its free space, the newest documents over it are removed after ${limits.graceDays} days.`}
        </Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A family table's value columns: Free, Plus and Pro (064). */
const FAMILY_VALUE = 64;

// ─── A business's plans (051) ─────────────────────────────────────

const PAID: readonly BusinessPlan[] = ['business_plus', 'business_pro', 'business_enterprise'];
// The table always compares Free beside the paid plans (the owner's ask, 18 October 2026).
/**
 * A border round the columns of the plan the vault is on, top to bottom, with
 * "Current" at its head (the owner's ask, 18 October 2026). Drawn first, so it
 * sits behind the rows; the value columns have fixed widths, so where a column
 * sits is counted from the card's right edge.
 */
function CurrentColumn({ from, to, count, width, tone, tint }: {
  from: number; to: number; count: number; width: number; tone: string; tint: string;
}) {
  const reach = 4;
  const right = space.lg + (count - 1 - to) * (width + space.xs) - reach;
  const span = (to - from + 1) * width + (to - from) * space.xs + 2 * reach;
  return (
    <View pointerEvents="none" style={[styles.current, { right, width: span, borderColor: tone, backgroundColor: tint }]}>
      <View style={[styles.currentTag, { backgroundColor: tone }]}>
        <Text style={styles.currentTagText}>Current</Text>
      </View>
    </View>
  );
}

type BusinessColumn = 'free' | BusinessPlan;
const COLUMNS: readonly BusinessColumn[] = ['free', ...PAID];
const columnName = (c: BusinessColumn) => (c === 'free' ? 'Free' : businessPlanName(c));

// A business's plans have a monthly number of questions, and more people as they go up.
const BUSINESS_BROUGHT_BY: Record<PlusFeature | BusinessFeature, { icon: string; text: string }> = {
  ...(Object.fromEntries(Object.entries(BROUGHT_BY).map(([k, v]) => [k, { icon: v.icon, text: v.text('every paid plan') }])) as
    Record<PlusFeature, { icon: string; text: string }>),
  questions: { icon: 'message-circle', text: 'More questions come with every paid plan.' },
  members: { icon: 'users', text: 'Room for more people comes with a bigger plan.' },
  // The business's own (056).
  overview: { icon: 'refresh-cw', text: 'Renewals and bills due come with every paid plan.' },
  money: { icon: 'bar-chart-2', text: 'Money in and out comes with Pro and Enterprise.' },
  notes: { icon: 'bell', text: 'Reminders on your notes come with every paid plan.' },
};

interface BusinessRow {
  label: string;
  cells: Record<BusinessColumn, Cell>;
  feature?: PlusFeature | BusinessFeature;
}

function businessRows(limits: PlanLimits): BusinessRow[] {
  // Free's cell first, then each paid plan's.
  const row = (free: Cell, pick: (p: BusinessPlan) => Cell) =>
    ({ free, ...Object.fromEntries(PAID.map((p) => [p, pick(p)])) }) as Record<BusinessColumn, Cell>;
  const freeVoice = limits.voiceAnswers.free;
  return [
    { label: '★ People', cells: row(String(limits.freeBusinessMembers), (p) => String(limits.business[p].members)), feature: 'members' },
    // 060: on Free, each person's own number across their free vaults, and the business's for everyone together.
    ...(limits.freePerson != null
      ? [{ label: 'Each person can add, in all', cells: row(formatBytes(limits.freePerson), () => true) }]
      : []),
    { label: 'Space for the business, together', cells: row(formatBytes(limits.freeBusiness), (p) => formatBytes(limits.business[p].storage)), feature: 'storage' },
    {
      label: '★ Each person\'s questions',
      cells: row(`${limits.questions.free ?? 20} a month`, (p) => `${limits.business[p].questionsFairUse} a month`),
      feature: 'questions',
    },
    { label: '★ Voice chats', cells: row(freeVoice == null ? true : `${freeVoice} each`, () => true), feature: 'voice' },
    { label: '★ 30-day share links', cells: row(false, () => true), feature: 'links' },
    { label: '★ Expiry reminders', cells: row(false, () => true), feature: 'reminders' },
    { label: '★ Import from Gmail', cells: row(false, () => true), feature: 'gmail' },
    { label: '★ Renewals and bills due', cells: row(false, () => true), feature: 'overview' },
    { label: '★ Money in and out', cells: row(false, (p) => p !== 'business_plus'), feature: 'money' },
    { label: 'Notes each', cells: row(String(limits.notesPerPerson.free ?? 20), () => String(limits.notesPerPerson.paid ?? 500)) },
    { label: '★ Reminders on notes', cells: row(false, () => true), feature: 'notes' },
  ];
}

function BusinessPlans() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const { currentFamily } = useFamily();
  const { plan, paidUntil, closed, trial, refresh } = useFamilyPlan();
  const [limits, setLimits] = useState<PlanLimits>(DEFAULT_PLAN_LIMITS);
  const broughtBy = feature && feature in BUSINESS_BROUGHT_BY ? BUSINESS_BROUGHT_BY[feature as PlusFeature | BusinessFeature] : null;
  const onPlan = isBusinessPlan(plan) ? plan : null;
  const next = plan ? nextBusinessPlan(plan) : 'business_plus';
  const vault = currentFamily ? vaultName(currentFamily) : 'Your business';

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    track('plus_viewed', { feature: feature && feature in BUSINESS_BROUGHT_BY ? feature : 'none' });
    refresh(true);
    fetchPlanLimits().then((l) => { if (!cancelled) setLimits(l); });
    return () => { cancelled = true; };
  }, [refresh, feature]));

  const saidAll = (r: BusinessRow) => COLUMNS.map((c) => `${columnName(c)} ${said(r.cells[c])}`).join(', ');
  // The column of the plan it is on; none while unknown, or once a paid plan has ended (closed).
  const currentColumn = onPlan ? COLUMNS.indexOf(onPlan) : plan === 'free' && !closed ? 0 : -1;

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Plans" fallback="/home" />
      <ScrollView contentContainerStyle={screenStyles.body}>
        {broughtBy && !onPlan && (
          <View style={[styles.brought, { backgroundColor: biz.tint }]} accessibilityLiveRegion="polite">
            <Feather name={broughtBy.icon as any} size={16} color={biz.primary} />
            <Text style={[styles.broughtText, { color: biz.primary }]}>{broughtBy.text}</Text>
          </View>
        )}

        <LinearGradient colors={BUSINESS_THEME.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={[styles.heroTag, styles.heroTagBiz]}>★ Plans for your business</Text>
          <Text style={styles.heroTitle}>More space and more help for your team</Text>
          <View style={styles.heroCells}>
            {PAID.map((p) => (
              <View
                key={p}
                style={[styles.heroCell, styles.heroCellTight]}
                accessible
                accessibilityLabel={`${businessPlanName(p)}, ${limits.business[p].members} people, ${businessAmount(p)} a month plus GST`}
              >
                <Text style={styles.heroCellLabel}>{businessPlanName(p)}</Text>
                <Text style={styles.heroAmountTight}>{businessAmount(p)}</Text>
                <Text style={styles.heroPer}>{limits.business[p].members} people</Text>
              </View>
            ))}
          </View>
          <Text style={styles.heroNote}>A month, plus GST. Pay for a year and get 1 month free.</Text>
        </LinearGradient>

        {onPlan ? (
          <View style={[styles.state, styles.statePlus]}>
            <Feather name="check-circle" size={18} color="#15803D" />
            <Text style={[styles.stateText, { color: '#15803D' }]}>
              {vault} has {businessPlanName(onPlan)}{trial ? ' on trial' : ''}
              {paidUntil ? `, until ${longDate(new Date(paidUntil))}` : ''}.
            </Text>
          </View>
        ) : plan === 'free' && closed ? (
          <View style={[styles.state, styles.stateEnded]}>
            <Feather name="alert-triangle" size={18} color="#B91C1C" />
            <Text style={[styles.stateText, { color: '#B91C1C' }]}>{CLOSED_MESSAGE}</Text>
          </View>
        ) : plan === 'free' ? (
          <View style={styles.state}>
            <Feather name="info" size={18} color={biz.primary} />
            <Text style={[styles.stateText, { color: biz.primary }]}>{vault} is on Free.</Text>
          </View>
        ) : null}

        <Card style={styles.tableCard}>
          {currentColumn >= 0 && (
            <CurrentColumn from={currentColumn} to={currentColumn} count={COLUMNS.length} width={58} tone={biz.primary} tint="#F1F8F7" />
          )}
          <View style={[styles.row, styles.headRow, currentColumn >= 0 && styles.headRowTagged]}>
            <Text style={[styles.label, styles.headText]}>What you get</Text>
            {COLUMNS.map((c, i) => (
              <Text
                key={c}
                style={[styles.value, styles.valueBiz, styles.headBiz, styles.headText, c !== 'free' && { color: biz.accent }]}
                accessibilityLabel={`${columnName(c)}${i === currentColumn ? ', your plan' : ''}`}
              >
                {columnName(c)}
              </Text>
            ))}
          </View>
          {businessRows(limits).map((r) => {
            const pointed = !!broughtBy && r.feature === feature && !onPlan;
            return (
              <View key={r.label} style={[styles.row, pointed && styles.rowPointed]} accessible accessibilityLabel={`${r.label.replace('★ ', '')}: ${saidAll(r)}`}>
                <Text style={styles.label}>{r.label}</Text>
                {COLUMNS.map((c) => (
                  <View key={c} style={[styles.value, styles.valueBiz]}>
                    <CellView value={r.cells[c]} plus={c !== 'free'} tone={biz.primary} />
                  </View>
                ))}
              </View>
            );
          })}
          <View
            style={[styles.row, styles.priceRow]}
            accessible
            accessibilityLabel={`Price a month, plus GST: Free nothing, ${PAID.map((p) => `${businessPlanName(p)} ${businessAmount(p)}`).join(', ')}.`}
          >
            <Text style={[styles.label, styles.priceLabel]}>Price</Text>
            <View style={[styles.value, styles.valueBiz]}>
              <Text style={styles.cellText}>₹0</Text>
            </View>
            {PAID.map((p) => (
              <View key={p} style={[styles.value, styles.valueBiz]}>
                <Text style={[styles.cellText, { color: biz.primary }]}>{businessAmount(p)}</Text>
                <Text style={styles.cellPer}>a month</Text>
              </View>
            ))}
          </View>
        </Card>

        {next && (
          <Card style={styles.payCard}>
            <Text style={styles.payTitle}>{onPlan ? `Move to ${businessPlanName(next)}` : 'Get a plan'}</Text>
            <Text style={styles.payFine}>
              {onPlan ? `Tell us, and we'll move you to ${businessPlanName(next)}.` : "Tell us which plan you want, and we'll set it up for you."}
            </Text>
            <TouchableOpacity
              style={[styles.payBtn, { backgroundColor: biz.primary }]}
              onPress={() => router.push('/settings/feedback' as any)}
              accessibilityRole="button"
            >
              <Text style={styles.payBtnText}>Ask us</Text>
            </TouchableOpacity>
          </Card>
        )}

        <Muted>If a paid plan ends, every record stays. Adding new ones waits until it is renewed.</Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brought: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: color.tint, borderRadius: radius.control, paddingVertical: 10, paddingHorizontal: space.md,
  },
  broughtText: { ...type.label, flex: 1, color: color.primary },
  hero: { borderRadius: radius.card, padding: space.lg, gap: space.xs },
  heroTag: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#FBD5D1', letterSpacing: 0.4 },
  heroTagBiz: { color: '#F3DDAE' },
  heroTitle: { fontSize: 17, lineHeight: 23, fontWeight: '600', color: '#FFFFFF' },
  heroCells: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  heroCell: {
    flex: 1, alignItems: 'flex-start', borderRadius: radius.control, padding: space.md,
    backgroundColor: 'rgba(255, 255, 255, 0.12)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  heroCellLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#DCE3F0' },
  heroWas: { fontSize: 13, lineHeight: 18, marginTop: space.xs },
  heroWasSpace: { height: 18, marginTop: space.xs },
  heroAmount: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#FFFFFF' },
  // Three prices in a row on a 360-wide phone (051).
  heroCellTight: { padding: space.sm },
  heroAmountTight: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: '#FFFFFF' },
  heroPer: { fontSize: 13, lineHeight: 18, color: '#DCE3F0' },
  heroSave: {
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginTop: space.sm,
    backgroundColor: '#FBD5D1',
  },
  heroSaveText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#8A3B35' },
  // Family Plus and Pro, each a cell to choose (064).
  heroCellChosen: { backgroundColor: 'rgba(255, 255, 255, 0.24)', borderColor: '#FFFFFF', borderWidth: 2 },
  heroLine: { fontSize: 12, lineHeight: 16, color: '#DCE3F0', marginTop: space.xs },
  heroPick: {
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginTop: space.sm,
    backgroundColor: '#FFFFFF',
  },
  heroPickText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: color.primary },
  heroNote: { fontSize: 13, lineHeight: 18, color: '#DCE3F0' },
  state: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.control, paddingVertical: 10, paddingHorizontal: space.md,
    backgroundColor: color.surface, borderWidth: 1, borderColor: color.border,
  },
  statePlus: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  stateEnded: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', alignItems: 'flex-start' },
  stateText: { ...type.label, flex: 1, color: color.primary },
  tableCard: { paddingVertical: space.sm, gap: 0 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: color.divider,
  },
  rowPointed: { backgroundColor: '#FFF7ED', marginHorizontal: -space.lg, paddingHorizontal: space.lg },
  headRow: { paddingTop: space.xs },
  // Room above the column names for the current plan's "Current".
  headRowTagged: { paddingTop: 28 },
  current: { position: 'absolute', top: space.xs, bottom: space.xs, borderWidth: 2, borderRadius: radius.control, alignItems: 'center' },
  currentTag: { marginTop: space.xs, borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  currentTagText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#FFFFFF' },
  // Not uppercase like an overline: "MONTHLY" is wider than its column.
  headText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: color.textMuted },
  headPlus: { color: color.accent },
  label: { ...type.body, flex: 1, fontSize: 14, lineHeight: 20 },
  labelBox: { flex: 1, gap: 2 },
  labelSub: { fontSize: 12, lineHeight: 16, color: color.textMuted },
  star: { color: color.accent, fontWeight: '700' },
  headChosen: { textDecorationLine: 'underline' },
  valueFamily: { width: FAMILY_VALUE },
  cellYear: { marginTop: space.xs },
  options: { flexDirection: 'row', gap: space.sm },
  option: {
    flex: 1, alignItems: 'flex-start', borderRadius: radius.control, padding: space.md,
    backgroundColor: color.background, borderWidth: 1, borderColor: color.border,
  },
  optionLabel: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: color.textMuted },
  optionWas: { fontSize: 13, lineHeight: 18, marginTop: space.xs, color: color.textMuted },
  optionWasSpace: { height: 18, marginTop: space.xs },
  optionAmount: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: color.primary },
  optionPer: { fontSize: 13, lineHeight: 18, color: color.textMuted },
  optionSave: {
    borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2, marginTop: space.sm,
    backgroundColor: '#FBEDEB',
  },
  optionSaveText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#8A3B35' },
  value: { width: 60, alignItems: 'center', textAlign: 'center' },
  // "Enterprise" is wider than 60 (051).
  valueWide: { width: 70 },
  // Four columns in a business's table (Free and three plans), so a little narrower.
  valueBiz: { width: 58 },
  // A heading may reach into the gaps beside it, so "Enterprise" stays one word.
  headBiz: { width: 66, marginHorizontal: -4 },
  cellText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: color.textBody, textAlign: 'center' },
  cellTextPlus: { color: color.primary },
  cellWas: { fontSize: 12, lineHeight: 16, color: color.textMuted, textAlign: 'center' },
  cellWasSpace: { height: 16 },
  cellPer: { fontSize: 12, lineHeight: 16, color: color.textMuted, textAlign: 'center' },
  priceRow: { borderBottomWidth: 0 },
  priceLabel: { fontWeight: '600', color: color.text },
  payCard: { gap: space.sm },
  payTitle: { ...type.heading },
  payBtn: {
    minHeight: 52, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center',
    paddingVertical: space.sm, paddingHorizontal: space.md,
  },
  payBtnMain: { backgroundColor: color.primary },
  payBtnOther: { borderWidth: 1, borderColor: color.primary, backgroundColor: color.surface },
  payBtnBusy: { opacity: 0.6 },
  payBtnText: { ...type.button, color: '#FFFFFF' },
  payBtnSave: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: '#FBD5D1' },
  payBtnTextOther: { ...type.button, color: color.primary },
  payFine: { fontSize: 13, lineHeight: 18, color: color.textMuted },
  payMsg: { ...type.label, color: color.primary },
  payMsgOk: { color: '#15803D' },
  payMsgError: { color: '#B91C1C' },
  soon: {
    borderRadius: radius.control, padding: space.md, gap: space.xs,
    backgroundColor: '#FBEDEB',
  },
  soonTag: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: color.accent, textTransform: 'uppercase', letterSpacing: 0.6 },
  soonText: { ...type.body, fontSize: 14, lineHeight: 20, color: color.primary },
});
