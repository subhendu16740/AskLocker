// Home's one question for someone new (051): what will you use AskLocker
// for? Family, Business or Both, one tap. It only decides which Create comes
// first in Manage Family, and goes to usage counts; it locks nothing.
//
// Asked only of someone whose only vault is their personal vault — a new
// account; someone who joined by invitation is in a family already — and
// only until they answer or tap Not now. The answer is kept on their users
// row (051), so another device does not ask again; Not now is this device's.
//
// Someone already in a family and in no business, or the other way round,
// who has never answered, is offered the other kind of vault once instead
// ("Have a business too?"), so an account made before 051 finds it too.
// Creating one counts as "both".

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useFamily } from '../lib/family-context';
import { fetchUseFor, saveUseFor, type UseFor } from '../lib/api';
import { isBusinessVault, isPersonalVault } from '../lib/vaults';
import { track } from '../lib/analytics';
import { color, radius, shadow, size, space, type } from '../constants/design';

const CHOICES: Array<{ key: UseFor; label: string; icon: 'users' | 'briefcase' | 'layers' }> = [
  { key: 'family', label: 'Family', icon: 'users' },
  { key: 'business', label: 'Business', icon: 'briefcase' },
  { key: 'both', label: 'Both', icon: 'layers' },
];

export function UseForOffer({ style }: { style?: StyleProp<ViewStyle> }) {
  const { user } = useAuth();
  const { families } = useFamily();
  // Unknown until asked: shown only once it is known nobody has answered.
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [picked, setPicked] = useState<UseFor | null>(null);

  const onlyPersonal = families.length > 0 && families.every((f) => isPersonalVault(f.families));
  const inBusiness = families.some((f) => isBusinessVault(f.families));
  const inFamily = families.some((f) => !isPersonalVault(f.families) && !isBusinessVault(f.families));
  // The kind of vault to offer someone who already has the other one.
  const other: 'business' | 'family' | null =
    inFamily && !inBusiness ? 'business' : inBusiness && !inFamily ? 'family' : null;
  const ask = onlyPersonal || other !== null;

  useEffect(() => {
    if (!user || !ask) return;
    let cancelled = false;
    fetchUseFor(user.id).then((v) => { if (!cancelled) setAnswered(v !== null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, ask]);

  if (!user || (!ask && !picked) || (answered !== false && !picked)) return null;

  const choose = (choice: UseFor) => {
    setPicked(choice);
    track('use_for_chosen', { choice });
    saveUseFor(user.id, choice).catch(() => {});
  };

  const notNow = () => {
    setAnswered(true);
    track('use_for_chosen', { choice: 'skipped' });
    saveUseFor(user.id, 'skipped').catch(() => {});
  };

  if (!onlyPersonal && other && !picked) {
    return (
      <View style={style}>
        <View style={styles.card}>
          <Text style={styles.title}>{other === 'business' ? 'Have a business too?' : 'Share with your family too?'}</Text>
          <Text style={styles.sub}>
            {other === 'business'
              ? 'Keep business records in a vault of their own, apart from your family.'
              : 'Keep family papers in a vault of their own, apart from work.'}
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => {
                setAnswered(true);
                track('use_for_chosen', { choice: 'both' });
                saveUseFor(user.id, 'both').catch(() => {});
                router.push(`/setup-family?kind=${other}` as any);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Create a {other}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={notNow} accessibilityRole="button">
              <Text style={styles.secondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (picked) {
    const kind = picked === 'business' ? 'business' : 'family';
    return (
      <View style={style}>
        <View style={styles.card}>
          <Text style={styles.title}>{picked === 'business' ? 'Set up your business' : 'Set up your family'}</Text>
          <Text style={styles.sub}>
            Create a {kind} vault and invite people to share documents. Your personal vault stays yours.
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => { setAnswered(true); setPicked(null); router.push(`/setup-family?kind=${kind}` as any); }}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Create a {kind}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => { setAnswered(true); setPicked(null); }} accessibilityRole="button">
              <Text style={styles.secondaryText}>Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={style}>
      <View style={styles.card}>
        <Text style={styles.title}>What will you use AskLocker for?</Text>
        <View style={styles.buttons} accessibilityRole="radiogroup">
          {CHOICES.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={styles.choice}
              onPress={() => choose(c.key)}
              accessibilityRole="button"
            >
              <Feather name={c.icon} size={16} color={color.primary} />
              <Text style={styles.choiceText}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity onPress={notNow} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.later}>Not now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface, borderRadius: radius.card, padding: space.lg, gap: space.md,
    borderWidth: 1, borderColor: '#BFDBFE', ...shadow.card,
  },
  title: type.heading,
  sub: type.caption,
  buttons: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1, minHeight: size.control, borderRadius: radius.control, borderWidth: 1, borderColor: color.inputBorder,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs, backgroundColor: color.surface,
  },
  choiceText: { ...type.button, color: color.primary },
  primary: { flex: 1, minHeight: size.control, borderRadius: radius.control, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.button, color: '#FFFFFF' },
  secondary: {
    flex: 1, minHeight: size.control, borderRadius: radius.control, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface,
  },
  secondaryText: { ...type.button, color: color.textBody },
  later: { ...type.caption, textAlign: 'center' },
});
