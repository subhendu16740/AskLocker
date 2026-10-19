// ─── After signing up: what AskLocker is for ────────────────────
//
// Two questions, one tap each (the owner's ask, 19 October 2026): Family or
// Business first, then the other one too? AskLocker opens in the first; with
// both, the drawer has the Family | Business switch, and without, it shows
// only the first. Settings › Your vaults changes either later.
//
// Asked of a new account only (needsWelcome in family-context.tsx): someone
// in no family or business yet. Business first goes on to create the
// business, since Business mode needs one, unless an invitation to one is
// waiting on Home. The choice is kept on the account (saveUses()), so no
// other device asks again.
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily, otherMode, type AppMode } from '../lib/family-context';
import { fetchMyInvitations } from '../lib/api';
import { isBusinessVault } from '../lib/vaults';
import { BUSINESS_THEME, FAMILY_THEME } from '../lib/vault-theme';
import { track } from '../lib/analytics';
import { color, radius, shadow, size, space, type } from '../constants/design';

const CHOICES: Record<AppMode, { label: string; line: string; icon: 'users' | 'briefcase' }> = {
  family: { label: 'Family', line: 'IDs, insurance, property and medical papers', icon: 'users' },
  business: { label: 'Business', line: 'Bills, GST, licences and contracts', icon: 'briefcase' },
};

const ALSO: Record<AppMode, string> = {
  family: 'Keep business records too, in vaults of their own. The menu then has a Family | Business switch.',
  business: 'Keep family papers too, apart from work. The menu then has a Family | Business switch.',
};

const themeOf = (mode: AppMode) => (mode === 'business' ? BUSINESS_THEME : FAMILY_THEME);

export default function WelcomeScreen() {
  const { families, setMode, setUses, usesChosen } = useFamily();
  const [primary, setPrimary] = useState<AppMode | null>(null);
  const [busy, setBusy] = useState(false);

  // Answered already, on another device or before a refresh: nothing to ask.
  useEffect(() => {
    if (usesChosen) router.replace('/home' as any);
  }, []);

  const finish = async (first: AppMode, both: boolean) => {
    setBusy(true);
    track('uses_chosen', { primary: first, both, where: 'welcome' });
    // Kept for this session and on this device at once, so nobody waits on
    // the network; an account that cannot take it now (offline) is offered
    // it again at the next start.
    setUses({ primary: first, both }).catch(() => {});
    if (first === 'business' && families.some((f) => isBusinessVault(f.families))) setMode('business');
    router.replace('/home' as any);
    if (first !== 'business' || families.some((f) => isBusinessVault(f.families))) return;
    // A business that asked them in waits on Home; otherwise they make one.
    const invited = await fetchMyInvitations().then((list) => list.some((i) => i.familyKind === 'business')).catch(() => false);
    if (!invited) router.push('/setup-family?kind=business' as any);
  };

  const other = primary ? otherMode(primary) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        {primary && !busy && (
          <TouchableOpacity
            onPress={() => setPrimary(null)}
            style={styles.back}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={size.icon} color={color.primary} />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <LinearGradient colors={FAMILY_THEME.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBox}>
            <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          </LinearGradient>
          <Text style={styles.step}>{primary ? '2 of 2' : '1 of 2'}</Text>
          {!primary || !other ? (
            <>
              <Text style={styles.title} accessibilityRole="header">What will you use AskLocker for?</Text>
              <Text style={styles.sub}>Pick the one you'll use most. AskLocker opens there.</Text>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: themeOf(other).primary }]} accessibilityRole="header">
                {CHOICES[other].label} too?
              </Text>
              <Text style={styles.sub}>{ALSO[primary]}</Text>
            </>
          )}
        </View>

        {!primary || !other ? (
          <View style={styles.choices} accessibilityRole="radiogroup">
            {(['family', 'business'] as const).map((m) => {
              const theme = themeOf(m);
              return (
                <TouchableOpacity
                  key={m}
                  style={styles.choice}
                  onPress={() => setPrimary(m)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${CHOICES[m].label}: ${CHOICES[m].line}`}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: theme.tint }]}>
                    <Feather name={CHOICES[m].icon} size={20} color={theme.primary} />
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={[styles.choiceLabel, { color: theme.primary }]}>{CHOICES[m].label}</Text>
                    <Text style={styles.choiceLine}>{CHOICES[m].line}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.yes, { backgroundColor: themeOf(other).primary }, busy && styles.busy]}
              onPress={() => finish(primary, true)}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.yesText}>Yes, {CHOICES[other].label.toLowerCase()} too</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.no, busy && styles.busy]}
              onPress={() => finish(primary, false)}
              disabled={busy}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[styles.noText, { color: themeOf(primary).primary }]}>No, just {CHOICES[primary].label.toLowerCase()}</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.note}>You can change this in Settings › Your vaults.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  bar: { height: size.bar, justifyContent: 'center', paddingLeft: space.xs },
  back: { width: size.control, height: size.control, alignItems: 'center', justifyContent: 'center' },
  body: {
    paddingHorizontal: space.lg, paddingBottom: 40, maxWidth: 420, width: '100%', alignSelf: 'center',
  },
  head: { alignItems: 'center', marginBottom: space.xl },
  // The login screen's tile: the mark is drawn in white for it.
  logoBox: { width: 64, height: 64, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  logo: { width: 44, height: 44 },
  step: { ...type.overline, marginBottom: space.sm },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: color.primary, textAlign: 'center', marginBottom: space.sm },
  sub: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
  choices: { gap: space.md },
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, minHeight: 72, ...shadow.card,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, minWidth: 0 },
  choiceLabel: { ...type.heading },
  choiceLine: { ...type.caption, marginTop: 2 },
  buttons: { gap: space.md },
  yes: { minHeight: size.control, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  yesText: { ...type.button, color: '#FFFFFF' },
  no: {
    minHeight: size.control, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: color.inputBorder, backgroundColor: color.surface,
  },
  noText: { ...type.button },
  busy: { opacity: 0.7 },
  note: { ...type.caption, textAlign: 'center', marginTop: space.xl },
});
