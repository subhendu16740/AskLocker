// Settings › Privacy — who can see what, and where a document's text goes,
// one short line each (the owner's ask, 25 October 2026: the cards read as
// too wordy). Every line has to stay true of the code, and of the people who
// run AskLocker: documents are not end-to-end encrypted, so nothing here may
// promise that nobody but the family can see them. Check it when changing
// sharing, search, OCR, embeddings, voice, Gmail import, payments or usage
// counts. Usage counts are said, with their switch, without naming the
// service that keeps them (the owner's ask, the same day).

import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/screen-header';
import { Toggle, screenStyles } from '../../components/settings-ui';
import { analyticsBuilt, analyticsOn, setAnalyticsOn } from '../../lib/analytics';
import { DEFAULT_PLAN_LIMITS } from '../../lib/plans';
import { useVaultTheme } from '../../lib/vault-theme';
import { color, radius, shadow, size, space, type } from '../../constants/design';

type Item = { icon: string; title: string; line: string; right?: ReactNode; onPress?: () => void; hide?: boolean };

function Group({ title, items }: { title: string; items: Item[] }) {
  const theme = useVaultTheme();
  const shown = items.filter((i) => !i.hide);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.card}>
        {shown.map((item, i) => {
          const inner = (
            <>
              <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
                <Feather name={item.icon as any} size={16} color={theme.primary} />
              </View>
              <View style={styles.text}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.line}>{item.line}</Text>
              </View>
              {item.right}
              {item.onPress && <Feather name="chevron-right" size={16} color="#9CA3AF" />}
            </>
          );
          const rowStyle = [styles.row, i > 0 && styles.rowBorder];
          return item.onPress ? (
            <TouchableOpacity key={item.title} style={rowStyle} onPress={item.onPress} activeOpacity={0.7} accessibilityRole="button">
              {inner}
            </TouchableOpacity>
          ) : (
            <View key={item.title} style={rowStyle}>{inner}</View>
          );
        })}
      </View>
    </View>
  );
}

export default function PrivacyScreen() {
  const theme = useVaultTheme();
  // Usage counts (analytics.ts): only production builds send any.
  const [counts, setCounts] = useState<boolean | null>(null);
  useEffect(() => {
    if (analyticsBuilt) analyticsOn().then(setCounts);
  }, []);

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Privacy" fallback="/settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <Group
          title="Your documents"
          items={[
            { icon: 'users', title: 'Who can see them', line: "Your vault's members, and anyone you send a share link. Your personal vault is yours alone." },
            { icon: 'lock', title: 'Encrypted, not end-to-end', line: 'Our servers read them to search, and our team can open them.' },
            { icon: 'link', title: 'Share links', line: 'Anyone with the link can open that one document until it expires or you turn it off.' },
            { icon: 'plus-square', title: 'Emergency cards', line: 'Your family can see them. Never sent to AI.', hide: theme.business },
          ]}
        />

        <Group
          title="Other services"
          items={[
            { icon: 'message-circle', title: 'Answers', line: 'Your question and the best matching parts go to Anthropic or Groq. Never your whole vault.' },
            { icon: 'search', title: 'Search', line: "Search data is made on our servers or at Cloudflare, which doesn't train AI on it." },
            { icon: 'file-text', title: 'Reading files', line: 'Photos and spreadsheets are read on your device. Scanned PDFs and Gmail photos go to OCR.space.' },
            { icon: 'mic', title: 'Voice', line: "Uses your browser's speech service. In Chrome, that's Google." },
            { icon: 'credit-card', title: 'Payments', line: 'Razorpay takes your card or UPI details. We never see them.' },
            { icon: 'mail', title: 'Gmail import', line: 'Until you pick a file, we keep only its sender, subject and name. Never the email.' },
          ]}
        />

        <Group
          title="Good to know"
          items={[
            { icon: 'alert-circle', title: 'AI can be wrong', line: 'Check the document before you rely on an answer.' },
            { icon: 'archive', title: 'Not a backup', line: 'Keep the originals of important papers.' },
            {
              icon: 'clock', title: 'If your family plan ends', hide: theme.business,
              line: `The newest documents over free space go after ${DEFAULT_PLAN_LIMITS.graceDays} days. We warn you first.`,
            },
          ]}
        />

        <Group
          title="Your account"
          items={[
            {
              icon: 'bar-chart-2', title: 'App usage', hide: !analyticsBuilt,
              line: 'We count screens and taps, and document types like Passport. Never what is in them.',
              right: counts !== null && (
                <Toggle label="Share app usage" value={counts} onChange={(on) => { setCounts(on); setAnalyticsOn(on); }} />
              ),
            },
            {
              icon: 'user-x', title: 'Delete account',
              line: 'Immediate. Documents you added to a family stay there, so delete them first.',
              onPress: () => router.push('/settings/delete-account' as any),
            },
          ]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: space.lg, paddingBottom: 40 },
  group: { paddingHorizontal: space.lg, marginBottom: space.lg },
  groupTitle: { ...type.overline, marginBottom: space.sm, marginLeft: space.xs },
  card: { backgroundColor: color.surface, borderRadius: radius.card, ...shadow.card },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: size.row,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: color.divider },
  iconWrap: { width: size.iconBox, height: size.iconBox, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...type.caption, fontWeight: '600', color: color.text },
  line: type.caption,
});
