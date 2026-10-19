// The top bar of every screen but Home: the back arrow at the left, the
// title beside it, and room on the right for one action. One component, so
// every screen's top looks the same.

import type { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackButton } from './back-button';
import { useFamily } from '../lib/family-context';
import { isBusinessVault } from '../lib/vaults';
import { plusName } from '../lib/plans';
import { biz, color, size, space, type } from '../constants/design';
import { useVaultTheme } from '../lib/vault-theme';

export function ScreenHeader({
  title, subtitle, fallback, right, titleLines = 1,
}: {
  title: string;
  subtitle?: string;
  fallback?: string;
  right?: ReactNode;
  /** 2 where the title is a name the person must be able to read in full. */
  titleLines?: number;
}) {
  // Business mode wears the business's colours (the drawer's switch).
  const theme = useVaultTheme();
  return (
    <View style={styles.bar}>
      <BackButton fallback={fallback} />
      <View style={styles.titles}>
        <Text style={[styles.title, { color: theme.primary }]} numberOfLines={titleLines} accessibilityRole="header">{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

/** Two icon actions side by side at the right of the bar (Ask: new question, saved chats). */
export function HeaderActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

/** An icon-only action at the right of the bar, drawn like the back arrow. */
export function HeaderIconButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const theme = useVaultTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.iconButton}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Feather name={icon as any} size={size.icon} color={theme.primary} />
    </TouchableOpacity>
  );
}

/** A small labelled action at the right of the bar: "Add", "Save". */
export function HeaderButton({ icon, label, onPress }: { icon?: string; label: string; onPress: () => void }) {
  const theme = useVaultTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.textButton, { backgroundColor: theme.primary }]}
      activeOpacity={0.8}
      hitSlop={{ top: 4, bottom: 4 }}
      accessibilityRole="button"
    >
      {!!icon && <Feather name={icon as any} size={16} color="#FFFFFF" />}
      <Text style={styles.textButtonLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * "★ Family Plus" — marks what the paid plan includes. With `link` it opens
 * the Family Plus page (Free and Plus side by side); without, it is only a
 * mark, for a tag inside something that is already tappable.
 */
export function PlusTag({ link = false, name: fixedName }: { link?: boolean; name?: string }) {
  // In a business (051) it is called Plus, unless the screen speaks of every vault.
  const { currentFamily } = useFamily();
  const name = fixedName ?? plusName(isBusinessVault(currentFamily));
  // A business's Plus in its own colours, orange and gold; Family Plus in the family's.
  const business = fixedName ? fixedName !== 'Family Plus' : isBusinessVault(currentFamily);
  const tag = (
    <View style={[styles.plusTag, business && styles.plusTagBiz]} accessibilityLabel={`Part of ${name}, the paid plan`}>
      <Text style={[styles.plusStar, business && { color: biz.accent }]}>★</Text>
      <Text style={[styles.plusText, business && { color: biz.primary }]}>{name}</Text>
    </View>
  );
  if (!link) return tag;
  return (
    <TouchableOpacity
      onPress={() => router.push('/plus' as any)}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      accessibilityRole="link"
      accessibilityLabel={`${name}: see what it includes`}
    >
      {tag}
    </TouchableOpacity>
  );
}

/**
 * " ★" after the name of someone on Family Plus, inside the name's own Text.
 * Hidden from screen readers: the name's Text says "Family Plus" instead.
 */
export function PlusStar({ onDark = false }: { onDark?: boolean }) {
  return <Text style={[styles.nameStar, onDark && styles.nameStarOnDark]} aria-hidden> ★</Text>;
}

const styles = StyleSheet.create({
  bar: {
    minHeight: size.bar,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.lg,
    backgroundColor: color.surface,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  titles: { flex: 1, minWidth: 0, paddingVertical: space.sm },
  title: type.title,
  subtitle: { ...type.caption, lineHeight: 16 },
  actions: { flexDirection: 'row', alignItems: 'center', marginRight: -space.sm },
  iconButton: {
    width: size.control,
    height: size.control,
    borderRadius: size.control / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: 10,
    backgroundColor: color.primary,
  },
  textButtonLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#FFFFFF' },
  plusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FBEDEB',
  },
  plusTagBiz: { backgroundColor: '#FBF1DF' },
  plusStar: { fontSize: 12, color: color.accent },
  plusText: { fontSize: 12, fontWeight: '600', color: color.primary },
  nameStar: { color: color.accent },
  nameStarOnDark: { color: '#FBD5D1' },
});
