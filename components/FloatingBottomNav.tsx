/**
 * @file FloatingBottomNav.tsx
 * @description Floating bottom navigation for the main product routes.
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
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { colors, radii } from '@/constants/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const tabs = [
  { label: 'Home', route: '/', icon: House },
  { label: 'Vault', route: '/vault', icon: Archive },
  { label: 'Discuss', route: '/discuss', icon: ChatCircleDots },
  { label: 'Settings', route: '/settings', icon: GearSix },
] as const;

export function FloatingBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const goTo = (route: (typeof tabs)[number]['route']) => {
    if (pathname === route) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.replace(route);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View accessibilityRole="tablist" style={styles.nav}>
        {tabs.map((tab) => {
          const active = tab.route === '/' ? pathname === '/' : pathname.startsWith(tab.route);
          const Icon = tab.icon;
          return (
            <Pressable
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.route}
              onPress={() => goTo(tab.route)}
              style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}
            >
              <Icon color={active ? colors.ink : colors.inkInverse} size={19} weight="bold" />
              {active ? <Text style={styles.activeLabel}>{tab.label}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', right: 0, bottom: 18, left: 0, zIndex: 100, alignItems: 'center' },
  nav: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', padding: 6,
    borderRadius: radii.pill, backgroundColor: colors.darkCanvas,
    shadowColor: '#000000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16,
    shadowRadius: 14, elevation: 8,
  },
  tab: {
    minWidth: 50, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingHorizontal: 15, borderRadius: radii.pill,
  },
  activeTab: { paddingHorizontal: 18, backgroundColor: colors.canvas },
  activeLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.7 },
});
