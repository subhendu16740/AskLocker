// ─── After signing up: what AskLocker is for ────────────────────
//
// One question, one tap (the owner's ask, 19 October 2026): Family,
// Business or Both, three cards of one size. AskLocker opens in the one
// chosen; Both opens in Family, where the personal vault is, and gives the
// drawer its Family | Business switch, which the other two never show.
// Settings › Your vaults changes either later.
//
// Asked of a new account only (needsWelcome in family-context.tsx): someone
// in no family or business yet. Business goes on to create the business,
// since Business mode needs one, unless an invitation from one is waiting
// on Home. The choice is kept on the account (saveUses()), so no other
// device asks again.
// ────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFamily, type AppMode } from '../lib/family-context';
import { fetchMyInvitations } from '../lib/api';
import { isBusinessVault } from '../lib/vaults';
import { BUSINESS_THEME, FAMILY_THEME } from '../lib/vault-theme';
import { track } from '../lib/analytics';
import { color, radius, shadow, size, space, type } from '../constants/design';

type Choice = AppMode | 'both';

// One line each, of about one length, so the three cards match.
const CHOICES: { key: Choice; label: string; line: string; icon: 'users' | 'briefcase' | 'layers' }[] = [
  { key: 'family', label: 'Family', line: 'IDs, insurance, medical papers', icon: 'users' },
  { key: 'business', label: 'Business', line: 'Bills, GST, licences, contracts', icon: 'briefcase' },
  { key: 'both', label: 'Both', line: 'Switch between them in the menu', icon: 'layers' },
];

export default function WelcomeScreen() {
  const { families, setMode, setUses, usesChosen } = useFamily();
  const [done, setDone] = useState(false);

  // Answered already, on another device or before a refresh: nothing to ask.
  useEffect(() => {
    if (usesChosen) router.replace('/home' as any);
  }, []);

  const choose = async (choice: Choice) => {
    if (done) return;
    setDone(true);
    const first: AppMode = choice === 'business' ? 'business' : 'family';
    const both = choice === 'both';
    track('uses_chosen', { primary: first, both, where: 'welcome' });
    // Kept for this session and on this device at once, so nobody waits on
    // the network; an account that cannot take it now (offline) is offered
    // it again at the next start.
    setUses({ primary: first, both }).catch(() => {});
    const inBusiness = families.some((f) => isBusinessVault(f.families));
    if (first === 'business' && inBusiness) setMode('business');
    router.replace('/home' as any);
    if (first !== 'business' || inBusiness) return;
    // A business that asked them in waits on Home; otherwise they make one.
    const invited = await fetchMyInvitations().then((list) => list.some((i) => i.familyKind === 'business')).catch(() => false);
    if (!invited) router.push('/setup-family?kind=business' as any);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <LinearGradient colors={FAMILY_THEME.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoBox}>
            <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} accessibilityIgnoresInvertColors />
          </LinearGradient>
          <Text style={styles.title} accessibilityRole="header">What will you use AskLocker for?</Text>
          <Text style={styles.sub}>Pick one, or Both to switch between them from the menu.</Text>
        </View>

        <View style={styles.choices}>
          {CHOICES.map((c) => {
            const theme = c.key === 'business' ? BUSINESS_THEME : FAMILY_THEME;
            // Both: the family's tint running into the business's.
            const tint: readonly [string, string] = c.key === 'both'
              ? [FAMILY_THEME.tint, BUSINESS_THEME.tint] : [theme.tint, theme.tint];
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.choice, done && styles.dim]}
                onPress={() => choose(c.key)}
                disabled={done}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${c.label}: ${c.line}`}
              >
                <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.choiceIcon}>
                  <Feather name={c.icon} size={20} color={theme.primary} />
                </LinearGradient>
                <View style={styles.choiceText}>
                  <Text style={[styles.choiceLabel, { color: theme.primary }]} numberOfLines={1}>{c.label}</Text>
                  <Text style={styles.choiceLine} numberOfLines={1}>{c.line}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.note}>You can change this in Settings › Your vaults.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  body: {
    paddingHorizontal: space.lg, paddingTop: size.bar, paddingBottom: 40, maxWidth: 420, width: '100%', alignSelf: 'center',
  },
  head: { alignItems: 'center', marginBottom: space.xl },
  // The login screen's tile: the mark is drawn in white for it.
  logoBox: { width: 64, height: 64, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg },
  logo: { width: 44, height: 44 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: color.primary, textAlign: 'center', marginBottom: space.sm },
  sub: { ...type.body, color: color.textMuted, textAlign: 'center', maxWidth: 320 },
  choices: { gap: space.md },
  // One height for all three: a label and one line each.
  choice: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, height: 76,
    backgroundColor: color.surface, borderRadius: radius.card, paddingHorizontal: space.lg, ...shadow.card,
  },
  dim: { opacity: 0.6 },
  choiceIcon: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  choiceText: { flex: 1, minWidth: 0 },
  choiceLabel: { ...type.heading },
  choiceLine: { ...type.caption, marginTop: 2 },
  note: { ...type.caption, textAlign: 'center', marginTop: space.xl },
});
