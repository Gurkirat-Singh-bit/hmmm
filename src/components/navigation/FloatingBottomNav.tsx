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
} from "phosphor-react-native";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { colors, onboardingFonts, radii } from "@/constants/theme";

const tabs = [
  { label: "Home", route: "/", icon: House },
  { label: "Vault", route: "/vault", icon: Archive },
  { label: "Discuss", route: "/discuss", icon: ChatCircleDots },
  { label: "Settings", route: "/settings", icon: GearSix },
] as const;
export function FloatingBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const layouts = useRef<Record<string, { width: number; x: number }>>({});
  const initialized = useRef(false);

  const activeRoute =
    tabs.find((tab) =>
      tab.route === "/" ? pathname === "/" : pathname.startsWith(tab.route),
    )?.route ?? "/";

  const moveIndicator = useCallback(
    (layout: { width: number; x: number }) => {
      if (!initialized.current) {
        indicatorX.setValue(layout.x);
        indicatorWidth.setValue(layout.width);
        initialized.current = true;
        return;
      }
      Animated.parallel([
        Animated.timing(indicatorX, {
          duration: 160,
          easing: Easing.out(Easing.quad),
          toValue: layout.x,
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          duration: 160,
          easing: Easing.out(Easing.quad),
          toValue: layout.width,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [indicatorWidth, indicatorX],
  );

  useEffect(() => {
    const layout = layouts.current[activeRoute];
    if (layout) moveIndicator(layout);
  }, [activeRoute, moveIndicator]);
  const goTo = (route: (typeof tabs)[number]["route"]) => {
    if (pathname === route) return;
    LayoutAnimation.configureNext({
      duration: 160,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    router.replace(route);
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View pointerEvents="none" style={styles.fogVeil} />
      <View accessibilityRole="tablist" style={styles.nav}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { left: indicatorX, width: indicatorWidth },
          ]}
        />
        {tabs.map((tab) => {
          const active =
            tab.route === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.route);
          const Icon = tab.icon;
          return (
            <Pressable
              accessibilityLabel={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.route}
              onLayout={({ nativeEvent: { layout } }: LayoutChangeEvent) => {
                layouts.current[tab.route] = {
                  width: layout.width,
                  x: layout.x,
                };
                if (active) moveIndicator(layout);
              }}
              onPress={() => goTo(tab.route)}
              style={({ pressed }) => [
                styles.tab,
                active && styles.activeTab,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                color={active ? colors.ink : colors.inkInverse}
                size={20}
                weight="bold"
              />
              {active ? (
                <Text style={styles.activeLabel}>{tab.label}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: 120,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 18,
  },
  fogVeil: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    height: 64,
    backgroundColor: "rgba(255,255,255,0.38)",
  },
  nav: {
    position: "relative",
    width: 286,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.darkCanvas,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 8,
  },
  tab: {
    zIndex: 1,
    width: 54,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: radii.pill,
  },
  activeTab: { width: 112, paddingHorizontal: 12 },
  indicator: {
    position: "absolute",
    top: 6,
    height: 50,
    borderRadius: radii.pill,
    backgroundColor: colors.canvas,
  },
  activeLabel: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  pressed: { opacity: 0.7 },
});
