// Settings › Privacy — three lines, the full policy, and the usage switch, as
// popular apps do it (the owner's ask, 25 October 2026: the screen read as too
// wordy). The details — every outside service by name, Gmail, payments, how
// long things are kept — are in the privacy policy, public/privacy.html,
// at asklocker.com/privacy. Every line here and there has to stay true of the
// code, and of the people who run AskLocker: documents are not end-to-end
// encrypted, so nothing may promise that nobody but the family can see them.

import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/screen-header';
import { Toggle, screenStyles } from '../../components/settings-ui';
import { analyticsBuilt, analyticsOn, setAnalyticsOn } from '../../lib/analytics';
import { useVaultTheme } from '../../lib/vault-theme';
import { color, radius, shadow, size, space, type } from '../../constants/design';

// On the web the policy is this site's own copy (/privacy.html works on any
// host; Cloudflare Pages serves it at /privacy); the phone app opens the live one.
const POLICY_URL = Platform.OS === 'web' ? '/privacy.html' : 'https://asklocker.com/privacy';

function Row({ icon, title, line, first, right, onPress }: {
  icon: string; title: string; line?: string; first?: boolean; right?: ReactNode; onPress?: () => void;
}) {
  const theme = useVaultTheme();
  const inner = (
    <>
      <View style={[styles.iconWrap, { backgroundColor: theme.tint }]}>
        <Feather name={icon as any} size={16} color={theme.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {!!line && <Text style={styles.line}>{line}</Text>}
      </View>
      {right}
      {onPress && <Feather name="external-link" size={16} color="#9CA3AF" />}
    </>
  );
  const rowStyle = [styles.row, !first && styles.rowBorder];
  return onPress ? (
    <TouchableOpacity style={rowStyle} onPress={onPress} activeOpacity={0.7} accessibilityRole="link">{inner}</TouchableOpacity>
  ) : (
    <View style={rowStyle}>{inner}</View>
  );
}

export default function PrivacyScreen() {
  // Usage counts (analytics.ts): only production builds send any.
  const [counts, setCounts] = useState<boolean | null>(null);
  useEffect(() => {
    if (analyticsBuilt) analyticsOn().then(setCounts);
  }, []);

  return (
    <SafeAreaView style={screenStyles.safe} edges={['top']}>
      <ScreenHeader title="Privacy" fallback="/settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Row first icon="users" title="Who can see your documents" line="People in your vault, and anyone you send a share link." />
          <Row icon="lock" title="Encrypted, not end-to-end" line="Our servers read them to search, and our team can open them." />
          <Row icon="message-circle" title="AI answers" line="Parts of your documents go to AI services to answer you. Never your whole vault." />
          <Row icon="file-text" title="Privacy policy" line="What we keep, and who else gets it." onPress={() => Linking.openURL(POLICY_URL)} />
        </View>

        {analyticsBuilt && counts !== null && (
          <View style={styles.card}>
            <Row
              first
              icon="bar-chart-2"
              title="Share app usage"
              right={<Toggle label="Share app usage" value={counts} onChange={(on) => { setCounts(on); setAnalyticsOn(on); }} />}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space.lg, gap: space.lg, paddingBottom: 40 },
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
