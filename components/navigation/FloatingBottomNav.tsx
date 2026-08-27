/**
 * @file FloatingBottomNav.tsx
 * @description Shared floating bottom navigation for the main product routes.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  ArchiveIcon as Archive,
  ChatCircleDotsIcon as ChatCircleDots,
  GearSixIcon as GearSix,
  HouseIcon as House,
} from 'phosphor-react-native';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, onboardingFonts, radii, spacing } from '@/constants/theme';

const tabs = [
  { label: 'Home', route: '/', icon: House },
  { label: 'Vault', route: '/vault', icon: Archive },
  { label: 'Discuss', route: '/discuss', icon: ChatCircleDots },
  { label: 'Settings', route: '/settings', icon: GearSix },
] as const;

export function FloatingBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goTo = (route: (typeof tabs)[number]['route']) => {
    if (pathname === route) return;
    router.replace(route);
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(12, insets.bottom + 8) }]}>
      <View accessibilityLabel="Primary navigation" accessibilityRole="tablist" style={styles.nav}>
        {tabs.map((tab) => {
          const active = matchesRoute(pathname, tab.route);
          const Icon = tab.icon;
          return (
            <Pressable
              accessibilityLabel={tab.label}
              accessibilityHint={`Open ${tab.label}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.route}
              onPress={() => goTo(tab.route)}
              style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
            >
              <Icon color={colors.ink} size={20} weight={active ? 'bold' : 'regular'} />
              <Text style={styles.label}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', right: 0, bottom: 0, left: 0, zIndex: 100, alignItems: 'center', paddingHorizontal: spacing.page },
  nav: {
    width: '100%', maxWidth: 380, minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radii.large, backgroundColor: colors.canvas,
    shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12,
    shadowRadius: 12, elevation: 4,
  },
  tab: {
    minWidth: 48, minHeight: 54, flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 2, borderRadius: radii.medium,
  },
  activeTab: { backgroundColor: colors.primary },
  label: { color: colors.inkSecondary, fontFamily: onboardingFonts.bodySemiBold, fontSize: 10, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});

function matchesRoute(pathname: string, route: (typeof tabs)[number]['route']) {
  return route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(`${route}/`);
}
