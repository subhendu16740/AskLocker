// Home's nudge about the kind of vault a person has not made yet.
//
// Someone who answered the welcome questions (welcome.tsx) and has no vault
// of their first kind yet, besides their personal vault, is asked to set one
// up: "Set up your family", or "your business". Later hides it on this
// device. It locks nothing: the personal vault works without either.
//
// Someone who never answered (an account made before the welcome questions)
// and is in a family and no business, or the other way round, is offered the
// other kind once ("Have a business too?"). Either button keeps their answer
// on the account, as the welcome questions do: Create turns the other mode
// on, Not now leaves it off.

import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useFamily, otherMode, type AppMode } from '../lib/family-context';
import { isBusinessVault, isPersonalVault } from '../lib/vaults';
import { accountKey, storageGet, storageSet } from '../lib/storage';
import { track } from '../lib/analytics';
import { biz, color, radius, shadow, size, space, type } from '../constants/design';

export function UseForOffer({ style }: { style?: StyleProp<ViewStyle> }) {
  const { user } = useAuth();
  const { families, uses, usesChosen, setUses } = useFamily();
  // Unknown until read: shown only once it is known it was not put off.
  const [later, setLater] = useState<string | null | undefined>(undefined);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    storageGet(accountKey.setupLater(user.id)).then((v) => { if (!cancelled) setLater(v); }).catch(() => setLater(null));
    return () => { cancelled = true; };
  }, [user?.id]);

  const inBusiness = families.some((f) => isBusinessVault(f.families));
  const inFamily = families.some((f) => !isPersonalVault(f.families) && !isBusinessVault(f.families));
  const has = (kind: AppMode) => (kind === 'business' ? inBusiness : inFamily);

  if (!user || hidden || families.length === 0) return null;

  // Never answered, and in one kind of vault: the other kind, once.
  const other: AppMode | null = inFamily && !inBusiness ? 'business' : inBusiness && !inFamily ? 'family' : null;
  if (!usesChosen && other) {
    const first = otherMode(other);
    const answer = (both: boolean) => {
      setHidden(true);
      track('uses_chosen', { primary: first, both, where: 'home' });
      setUses({ primary: first, both }).catch(() => {});
      if (both) router.push(`/setup-family?kind=${other}` as any);
    };
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
              style={[styles.primary, other === 'business' && { backgroundColor: biz.primary }]}
              onPress={() => answer(true)}
              accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Create a {other}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondary} onPress={() => answer(false)} accessibilityRole="button">
              <Text style={styles.secondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Answered, and no vault of the first kind yet: set one up.
  const kind = uses.primary;
  if (!usesChosen || has(kind) || later === undefined || later === kind) return null;
  return (
    <View style={style}>
      <View style={styles.card}>
        <Text style={styles.title}>{kind === 'business' ? 'Set up your business' : 'Set up your family'}</Text>
        <Text style={styles.sub}>
          Create a {kind} vault and invite people to share documents. Your personal vault stays yours.
        </Text>
        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.primary, kind === 'business' && { backgroundColor: biz.primary }]}
            onPress={() => router.push(`/setup-family?kind=${kind}` as any)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Create a {kind}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => { setLater(kind); storageSet(accountKey.setupLater(user.id), kind); }}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Later</Text>
          </TouchableOpacity>
        </View>
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
  primary: { flex: 1, minHeight: size.control, borderRadius: radius.control, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...type.button, color: '#FFFFFF' },
  secondary: {
    flex: 1, minHeight: size.control, borderRadius: radius.control, borderWidth: 1, borderColor: color.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface,
  },
  secondaryText: { ...type.button, color: color.textBody },
});
