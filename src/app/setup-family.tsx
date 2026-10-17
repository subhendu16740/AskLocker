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
import { createNewFamily, fetchUseFor } from '../lib/api';
import { BackButton } from '../components/back-button';
import { color, radius, size, space, type } from '../constants/design';
import { track } from '../lib/analytics';

type Kind = 'family' | 'business';

// The words that change with what is being made (051).
const WORDS: Record<Kind, {
  title: string; subtitle: string; label: string; placeholder: string; empty: string;
  button: string; failed: string; infoTitle: string; infoSub: string; plusLink: string; icon: 'users' | 'briefcase';
}> = {
  family: {
    title: 'Create Your Family Vault',
    subtitle: 'Everyone you invite can see its documents. Your personal vault stays yours.',
    label: 'Family Name',
    placeholder: 'e.g. The Sharma Family',
    empty: 'Enter a family name.',
    button: 'Create Family Vault',
    failed: "Couldn't create the family. Try again.",
    infoTitle: "Your family's own space",
    infoSub: 'Only your family can open its documents in AskLocker.',
    plusLink: 'See Family Plus ›',
    icon: 'users',
  },
  business: {
    title: 'Create Your Business Vault',
    subtitle: 'Everyone you invite can see its records. Your personal vault stays yours.',
    label: 'Business Name',
    placeholder: 'e.g. Sharma Traders',
    empty: 'Enter a business name.',
    button: 'Create Business Vault',
    failed: "Couldn't create the business. Try again.",
    infoTitle: "Your business's own space",
    infoSub: 'Only your team can open its records in AskLocker.',
    plusLink: 'See Plus ›',
    icon: 'briefcase',
  },
};

export default function SetupFamilyScreen() {
  const { user } = useAuth();
  // First sign-in has nowhere to go back to — the app sends people here
  // until they have a vault. Someone who already has one came from Manage
  // Family to make another, and needs a way out.
  const { families, refreshFamilies, switchFamily } = useFamily();
  // Family or business (051): from the button that opened this, else from
  // what the person said they use AskLocker for. Either can be picked here.
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'business' ? 'business' : 'family');
  useEffect(() => {
    if (params.kind || !user) return;
    fetchUseFor(user.id).then((u) => { if (u === 'business') setKind('business'); }).catch(() => {});
  }, [user?.id, params.kind]);
  const w = WORDS[kind];
  const [familyName, setFamilyName] = useState('');
  const [description, setDescription] = useState('');
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
      const familyId = await createNewFamily(user.id, familyName.trim(), description.trim() || undefined, undefined, kind);
      track('family_created', { kind });
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
          <BackButton fallback="/family" />
        </View>
      )}
      <View style={[styles.container, families.length > 0 && styles.containerBelowBack]}>

        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#2A3D66', '#4A6491']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconBox}
          >
            <Feather name={w.icon} size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.title}>{w.title}</Text>
          <Text style={styles.subtitle}>{w.subtitle}</Text>
        </View>

        {/* Family or business */}
        <View style={styles.kinds} accessibilityRole="radiogroup">
          {(['family', 'business'] as const).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => { setKind(k); setProblem(null); }}
              style={[styles.kind, kind === k && styles.kindOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              activeOpacity={0.8}
            >
              <Feather name={WORDS[k].icon} size={16} color={kind === k ? '#FFFFFF' : color.primary} />
              <Text style={[styles.kindText, kind === k && styles.kindTextOn]}>{k === 'family' ? 'Family' : 'Business'}</Text>
            </TouchableOpacity>
          ))}
        </View>

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

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Description <Text style={styles.fieldOptional}>(optional)</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <Feather name="file-text" size={18} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                placeholder="A short description"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
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
            colors={['#2A3D66', '#4A6491']}
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

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Feather name="lock" size={16} color={color.primary} style={styles.infoIcon} />
          <View style={styles.infoTextWrap}>
            <Text style={styles.infoTitle}>{w.infoTitle}</Text>
            <Text style={styles.infoSub}>{w.infoSub}</Text>
          </View>
        </View>
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
  kindOn: { backgroundColor: color.primary, borderColor: color.primary },
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
  fieldOptional: { fontWeight: '400', color: '#9CA3AF' },
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
  infoCard: {
    flexDirection: 'row',
    backgroundColor: color.tint,
    borderRadius: radius.control,
    padding: space.md,
    gap: space.md,
    alignItems: 'flex-start',
  },
  infoIcon: { marginTop: 2 },
  infoTextWrap: { flex: 1 },
  infoTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: color.primary, marginBottom: 2 },
  infoSub: type.caption,
});
