// ─── The menu behind the name button on Home ────────────────────
//
// A drawer, not a screen: it slides in from the left over the page, the page
// stays visible behind it, and it closes with the ✕, a tap outside it, or the
// back button. Layout from the v4 design (who you are on top, then Home,
// Family tree, Emergency cards, Manage Family, Reminders and Settings, Sign Out
// at the bottom), in the app's own colours. In a business (051) there is no
// family tree and no emergency cards, and Manage Family is Manage team; it has
// its Overview and My notes instead (056). Under the header, Family or
// Business: the mode the app runs in, which is the open vault's kind; a
// business wears its own colours (vault-theme.ts).
// ────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Pressable, Animated, Easing, Platform, useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '../lib/auth';
import { useFamily, type AppMode } from '../lib/family-context';
import { isBusinessVault, isPersonalVault, vaultName } from '../lib/vaults';
import { useDrawer } from '../lib/drawer-context';
import { useFamilyPlan, useOnPlus, type PlusFeature } from '../lib/family-plan';
import { appVersion } from '../lib/app-info';
import { PlusStar, PlusTag } from './screen-header';
import { color, radius, size, space, type } from '../constants/design';
import { BUSINESS_THEME, FAMILY_THEME, useVaultTheme } from '../lib/vault-theme';
import { track } from '../lib/analytics';

type MenuItem = { icon: string; label: string; route: string; plus?: PlusFeature; familyOnly?: boolean; businessOnly?: boolean };

const menuItems: MenuItem[] = [
  { icon: 'home', label: 'Home', route: '/home' },
  // A business's own (056): what its papers say, and each person's notes.
  { icon: 'bar-chart-2', label: 'Overview', route: '/overview', businessOnly: true },
  { icon: 'edit-3', label: 'My notes', route: '/notes', businessOnly: true },
  { icon: 'git-branch', label: 'Family tree', route: '/family-tree', familyOnly: true },
  { icon: 'plus-square', label: 'Emergency cards', route: '/emergency', familyOnly: true },
  { icon: 'users', label: 'Manage Family', route: '/family' },
  // ★: part of Family Plus. A free family is shown the Family Plus page instead.
  { icon: 'clock', label: 'Reminders', route: '/reminders', plus: 'reminders' },
  { icon: 'settings', label: 'Settings', route: '/settings' },
];

// The native driver does not exist on the web; asking for it there warns.
const useNativeDriver = Platform.OS !== 'web';

export default function ProfileDrawer() {
  const { user, signOut } = useAuth();
  const { currentFamily, membership, mode, setMode } = useFamily();
  const theme = useVaultTheme();
  const { isDrawerOpen, closeDrawer } = useDrawer();
  const { routeFor } = useFamilyPlan();
  const onPlus = useOnPlus();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(300, Math.round(width * 0.86));

  // Stay mounted while sliding out, so closing animates rather than vanishes.
  const [mounted, setMounted] = useState(isDrawerOpen);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isDrawerOpen) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver,
      }).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [isDrawerOpen, progress]);

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] || 'User';
  const email = user?.email || '';
  const initial = displayName.charAt(0).toUpperCase();
  const role = membership?.role ? membership.role.charAt(0).toUpperCase() + membership.role.slice(1) : '';
  // The open vault, and who sees it (046): "Personal vault · only you", or the family and your role.
  const familyLine = isPersonalVault(currentFamily)
    ? `${vaultName(currentFamily)} · yours alone`
    : [currentFamily?.name, role].filter(Boolean).join(' · ');

  const business = isBusinessVault(currentFamily);
  const items = menuItems
    .filter((item) => !(business && item.familyOnly) && !(!business && item.businessOnly))
    .map((item) => (business && item.route === '/family' ? { ...item, icon: 'briefcase', label: 'Manage team' } : item));

  const handleNavigate = async (item: MenuItem) => {
    closeDrawer();
    const route = item.plus ? await routeFor(item.plus, item.route) : item.route;
    setTimeout(() => router.navigate(route as any), 150);
  };

  // Family or Business (the switch under the header): opens the vault last
  // open in that mode. Someone with no business yet is taken to make one.
  const chooseMode = (next: AppMode) => {
    if (next === mode) return;
    track('mode_switched', { mode: next });
    if (!setMode(next)) {
      closeDrawer();
      setTimeout(() => router.navigate('/setup-family?kind=business' as any), 150);
    }
  };

  const handleSignOut = async () => {
    closeDrawer();
    await signOut();
    router.replace('/login' as any);
  };

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={closeDrawer}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeDrawer}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          style={[styles.drawer, { width: drawerWidth, transform: [{ translateX }] }]}
          accessibilityViewIsModal
        >
          <LinearGradient
            colors={theme.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileHeader}
          >
            <View style={styles.headerTop}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <TouchableOpacity
                onPress={closeDrawer}
                style={styles.closeBtn}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <Feather name="x" size={size.icon} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text
              style={styles.profileName}
              numberOfLines={1}
              accessibilityLabel={onPlus ? `${displayName}, Family Plus` : undefined}
            >
              {displayName}{onPlus && <PlusStar onDark />}
            </Text>
            {!!email && <Text style={styles.profileSub} numberOfLines={1}>{email}</Text>}
            {!!familyLine && <Text style={styles.profileSub} numberOfLines={1}>{familyLine}</Text>}
          </LinearGradient>

          <View style={styles.modeRow} accessibilityRole="radiogroup" accessibilityLabel="Use AskLocker for">
            {([['family', 'users', 'Family'], ['business', 'briefcase', 'Business']] as const).map(([m, icon, label]) => {
              const on = mode === m;
              const tone = m === 'business' ? BUSINESS_THEME : FAMILY_THEME;
              return (
                <TouchableOpacity
                  key={m}
                  onPress={() => chooseMode(m)}
                  style={[styles.modeBtn, on && { backgroundColor: tone.primary, borderColor: tone.primary }]}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  aria-checked={on}
                >
                  <Feather name={icon} size={16} color={on ? '#FFFFFF' : tone.primary} />
                  <Text style={[styles.modeText, { color: on ? '#FFFFFF' : tone.primary }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.menuList}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={styles.menuItem}
                onPress={() => handleNavigate(item)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={[styles.menuIconWrap, { backgroundColor: theme.tint }]}>
                  <Feather name={item.icon as any} size={16} color={theme.primary} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.plus ? <PlusTag /> : <Feather name="chevron-right" size={16} color="#9CA3AF" />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Feather name="log-out" size={16} color={color.danger} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
            <Text style={styles.version}>AskLocker {appVersion}</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 17, 23, 0.55)',
  },
  // A fixed width and no `flex`. On the web `flex: 1` makes the panel fill
  // the whole row (the old drawer covered the page like a screen), and
  // `flex: 0` shrinks it to nothing; the width alone is what native does.
  drawer: {
    backgroundColor: '#FFFFFF',
    height: '100%',
    boxShadow: '8px 0px 24px rgba(13, 17, 23, 0.25)',
    elevation: 16,
  },
  modeRow: {
    flexDirection: 'row', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.md,
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    minHeight: 40, borderRadius: radius.control, borderWidth: 1, borderColor: color.inputBorder,
    backgroundColor: color.surface,
  },
  modeText: { ...type.label, fontSize: 14 },
  profileHeader: {
    paddingTop: space.sm,
    paddingBottom: space.lg,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    gap: 2,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  // The ✕ is drawn at 24px, like the back arrow, in a 44px touch area.
  closeBtn: {
    width: size.control,
    height: size.control,
    borderRadius: size.control / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  avatarText: { fontSize: 20, fontWeight: '600', color: '#FFFFFF' },
  profileName: { ...type.title, color: '#FFFFFF', paddingRight: space.md },
  profileSub: { ...type.caption, color: 'rgba(255,255,255,0.85)', paddingRight: space.md },
  menuList: {
    flex: 1,
    paddingTop: space.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  menuIconWrap: {
    width: size.iconBox,
    height: size.iconBox,
    borderRadius: 8,
    backgroundColor: color.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { ...type.label, flex: 1 },
  bottomSection: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    paddingTop: space.lg,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: radius.control,
    minHeight: size.control,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutText: { ...type.button, color: color.danger },
  version: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: space.md,
  },
});
