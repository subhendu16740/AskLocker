import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { useFamily } from '../lib/family-context';
import { createNewFamily, fetchPlanLimits } from '../lib/api';
import { freeVaultsText } from '../lib/plans';
import { BackButton } from '../components/back-button';
import { color, radius, size, space, type } from '../constants/design';
import { track } from '../lib/analytics';
import { useOnPlus } from '../lib/family-plan';
import { vaultTheme } from '../lib/vault-theme';
import { isPersonalVault } from '../lib/vaults';

type Kind = 'family' | 'business';

// The words that change with what is being made (051).
const WORDS: Record<Kind, {
  title: string; subtitle: string; label: string; placeholder: string; empty: string;
  button: string; failed: string; plusLink: string; icon: 'users' | 'briefcase';
}> = {
  family: {
    title: 'Create Your Family Vault',
    subtitle: 'Everyone you invite can see it.',
    label: 'Family Name',
    placeholder: 'e.g. The Sharma Family',
    empty: 'Enter a family name.',
    button: 'Create Family Vault',
    failed: "Couldn't create the family. Try again.",
    plusLink: 'See Family Plus ›',
    icon: 'users',
  },
  business: {
    title: 'Create Your Business Vault',
    subtitle: 'Everyone you invite can see it.',
    label: 'Business Name',
    placeholder: 'e.g. Sharma Traders',
    empty: 'Enter a business name.',
    button: 'Create Business Vault',
    failed: "Couldn't create the business. Try again.",
    plusLink: 'See Plus ›',
    icon: 'briefcase',
  },
};

export default function SetupFamilyScreen() {
  const { user } = useAuth();
  // First sign-in has nowhere to go back to — the app sends people here
  // until they have a vault. Someone who already has one came from Manage
  // Family to make another, and needs a way out.
  const { families, refreshFamilies, switchFamily, uses, usesChosen, setUses } = useFamily();
  // Family or business (051): from the button that opened this, else what
  // AskLocker opens in (the welcome question). Either can be picked here.
  const params = useLocalSearchParams<{ kind?: string }>();
  const fixedKind = params.kind === 'business' || params.kind === 'family' ? params.kind : null;
  const [kind, setKind] = useState<Kind>(fixedKind ?? uses.primary);
  // For someone who never chose, what AskLocker opens in is worked out from
  // their vaults and older answer, which arrive a moment later.
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (!fixedKind && !picked) setKind(uses.primary);
  }, [uses.primary]);
  // On Free, one family and one business besides the personal vault (059;
  // 054 allowed one vault in all, which a project without 059 still keeps).
  // Said before the form once it can matter: to someone who already has a
  // family or business, not to someone making their first. Someone in a vault
  // on a paid plan is not on Free (055), so not to them.
  const onPlus = useOnPlus();
  const [freeNote, setFreeNote] = useState<string | null>(null);
  useEffect(() => {
    fetchPlanLimits().then((l) => {
      const text = freeVaultsText(l);
      setFreeNote(text ? `On Free, you can create ${text}.` : null);
    }).catch(() => {});
  }, []);
  const hasShared = families.some((f) => !isPersonalVault(f.families));
  const w = WORDS[kind];
  // What is being made wears its own colours: a business's from the start.
  const theme = vaultTheme({ kind });
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  // Said on the screen, not in an alert: an alert shows nothing in a browser.
  // `plus`: refused because on Free a person creates one family (050).
  const [problem, setProblem] = useState<{ message: string; plus: boolean } | null>(null);

  const handleCreate = async () => {
    setProblem(null);
    if (!familyName.trim()) {
      setProblem({ message: w.empty, plus: false });
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const familyId = await createNewFamily(user.id, familyName.trim(), undefined, undefined, kind);
      track('family_created', { kind });
      // A vault of the other kind than the one they chose first: they use
      // both now, so the menu gets the Family | Business switch.
      if (usesChosen && kind !== uses.primary && !uses.both) setUses({ primary: uses.primary, both: true }).catch(() => {});
      await refreshFamilies();
      // Their own new family, so it opens: making it is their own choice.
      switchFamily(familyId);
      router.replace('/home' as any);
    } catch (err: any) {
      setProblem({ message: err?.message || w.failed, plus: err?.hint === 'family_limit' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {families.length > 0 && (
        <View style={styles.backRow}>
          <BackButton fallback="/settings/vaults" />
        </View>
      )}
      <View style={[styles.container, families.length > 0 && styles.containerBelowBack]}>

        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Feather name={w.icon} size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: theme.primary }]}>{w.title}</Text>
          <Text style={styles.subtitle}>{w.subtitle}</Text>
        </View>

        {/* Family or business */}
        <View style={styles.kinds} accessibilityRole="radiogroup">
          {(['family', 'business'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => { setKind(k); setPicked(true); setProblem(null); }}
              style={[styles.kind, kind === k && { backgroundColor: vaultTheme({ kind: k }).primary, borderColor: vaultTheme({ kind: k }).primary }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              aria-checked={kind === k}
              activeOpacity={0.8}
            >
              <Feather name={WORDS[k].icon} size={16} color={kind === k ? '#FFFFFF' : vaultTheme({ kind: k }).primary} />
              <Text style={[styles.kindText, { color: vaultTheme({ kind: k }).primary }, kind === k && styles.kindTextOn]}>{k === 'family' ? 'Family' : 'Business'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!onPlus && freeNote && hasShared && <Text style={styles.kindNote}>{freeNote}</Text>}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{w.label}</Text>
            <View style={styles.inputWrapper}>
              <Feather name={w.icon} size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder={w.placeholder}
                placeholderTextColor="#9CA3AF"
                value={familyName}
                onChangeText={setFamilyName}
                style={styles.input}
                autoFocus
              />
            </View>
          </View>
        </View>

        {problem && (
          <View style={styles.problem} accessibilityRole="alert">
            <Feather name="alert-circle" size={16} color={color.danger} style={styles.problemIcon} />
            <View style={styles.problemTextWrap}>
              <Text style={styles.problemText}>{problem.message}</Text>
              {problem.plus && (
                <Text style={styles.problemLink} accessibilityRole="link" onPress={() => router.push('/plus' as any)}>
                  {w.plusLink}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          activeOpacity={0.85}
          disabled={loading}
        >
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.createBtn, loading && styles.btnDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.createBtnText}>{w.button}</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  // The arrow sits where every other screen has it: the top-left of a 56px bar.
  backRow: { height: size.bar, justifyContent: 'center', paddingLeft: space.xs },
  container: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: 40,
    maxWidth: 390,
    alignSelf: 'center',
    width: '100%',
  },
  containerBelowBack: { paddingTop: space.sm },
  header: {
    alignItems: 'center',
    marginBottom: space.xl,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  kinds: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  kindNote: { ...type.caption, textAlign: 'center', marginTop: -space.sm, marginBottom: space.lg },
  kind: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 40,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: color.inputBorder,
    backgroundColor: color.surface,
  },
  kindText: { ...type.label, color: color.primary },
  kindTextOn: { color: '#FFFFFF' },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600',
    color: color.primary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  subtitle: {
    ...type.body,
    color: color.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  form: { gap: space.lg, marginBottom: space.xl },
  field: {},
  fieldLabel: {
    ...type.caption,
    fontWeight: '500',
    color: color.textBody,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: color.inputBorder,
    minHeight: size.control,
    paddingHorizontal: space.md,
  },
  inputIcon: { marginRight: space.sm },
  input: {
    flex: 1,
    fontSize: type.body.fontSize,
    color: color.text,
    paddingVertical: space.xs,
    outlineStyle: 'none',
  } as any,
  createBtn: {
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: size.control,
    marginBottom: space.xl,
  },
  btnDisabled: { opacity: 0.7 },
  problem: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderRadius: radius.control,
    padding: space.md,
    marginBottom: space.lg,
  },
  problemIcon: { marginTop: 2 },
  problemTextWrap: { flex: 1, gap: space.xs },
  problemText: { ...type.caption, color: '#991B1B' },
  problemLink: { ...type.caption, fontWeight: '600', color: color.primary },
  createBtnText: { ...type.button, color: '#FFFFFF' },
});
