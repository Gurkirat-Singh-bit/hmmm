/**
 * @file _layout.tsx
 * @description Root Expo Router layout that loads fonts and app-wide providers.
 * @author Gurkirat Singh
 * @license MIT
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ReduceMotion, ReducedMotionConfig } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';

import { ForegroundFeedbackBanner } from '@/components/settings/ForegroundFeedbackBanner';
import { FloatingBottomNav } from '@/components/navigation/FloatingBottomNav';
import { colors, onboardingFonts } from '@/constants/theme';
import { registerNotificationResponseHandler } from '@/features/notifications/android-notifications';
import { refreshAppRuntime, retryAppRuntime, useAppRuntime, type AppRuntimeSnapshot } from '@/features/runtime/app-runtime';

export default function RootLayout() {
  const runtime = useAppRuntime();
  return <SafeAreaProvider>
    <ReducedMotionConfig mode={ReduceMotion.System} />
    {runtime.status === 'ready' ? <RootNavigator runtime={runtime} /> : <RuntimeBootstrap error={runtime.error} loading={runtime.status !== 'error'} />}
  </SafeAreaProvider>;
}

function RootNavigator({ runtime }: { runtime: AppRuntimeSnapshot }) {
  const pathname = usePathname();
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const guardedPath = useRef<string | null>(null);

  useEffect(() => {
    if (runtime.status !== 'ready' || !navigationState?.key) return;
    const guardKey = `${pathname}:${runtime.onboardingComplete}`;
    if (guardedPath.current === guardKey) return;
    guardedPath.current = guardKey;
    let disposed = false;
    void refreshAppRuntime().then((next) => {
      if (disposed) return;
      if (!next.onboardingComplete && pathname !== '/onboarding') router.replace('/onboarding');
      if (next.onboardingComplete && pathname === '/onboarding') router.replace('/');
    }).catch(() => {
      if (!disposed) guardedPath.current = null;
    });
    return () => { disposed = true; };
  }, [navigationState?.key, pathname, router, runtime.onboardingComplete, runtime.status]);

  useEffect(() => {
    if (!navigationState?.key || !runtime.onboardingComplete) return;
    return registerNotificationResponseHandler((captureId) => {
      router.replace({ pathname: '/vault/[id]', params: { id: captureId } });
    });
  }, [navigationState?.key, router, runtime.onboardingComplete]);

  const onboardingRoute = pathname === '/onboarding';
  const showFeedback = !onboardingRoute && !pathname.startsWith('/settings');
  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={onboardingRoute ? colors.darkCanvas : colors.canvas} style={onboardingRoute ? 'light' : 'dark'} />
      <Stack
        screenOptions={({ route }) => ({
          animation: ['index', 'vault/index', 'discuss/index', 'settings/index'].includes(route.name) ? 'none' : 'fade',
          contentStyle: { backgroundColor: colors.canvas },
          headerShown: false,
        })}
      >
        <Stack.Screen name="onboarding" />
        <Stack.Protected guard={runtime.onboardingComplete}>
          <Stack.Screen name="index" />
          <Stack.Screen name="vault/index" />
          <Stack.Screen name="vault/[id]" />
          <Stack.Screen name="discuss/index" />
          <Stack.Screen name="discuss/[ideaId]" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="settings/about" />
          <Stack.Screen name="settings/data" />
          <Stack.Screen name="settings/export-data" />
          <Stack.Screen name="settings/faq" />
          <Stack.Screen name="settings/how-to-use" />
          <Stack.Screen name="settings/language" />
          <Stack.Screen name="settings/notifications" />
          <Stack.Screen name="settings/privacy" />
          <Stack.Screen name="settings/providers" />
          <Stack.Screen name="settings/research" />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
      {['/', '/vault', '/discuss', '/settings'].includes(pathname) ? <FloatingBottomNav /> : null}
      {showFeedback ? <View pointerEvents="box-none" style={styles.feedbackLayer}><ForegroundFeedbackBanner /></View> : null}
    </View>
  );
}

function RuntimeBootstrap({ error, loading }: { error: string | null; loading: boolean }) {
  return <View style={styles.bootstrap}>
    {loading ? <ActivityIndicator color={colors.ink} size="small" /> : null}
    <Text accessibilityRole={loading ? 'progressbar' : 'header'} style={styles.bootstrapTitle}>{loading ? 'Preparing your local workspace…' : 'Hmmmidea needs a restart'}</Text>
    <Text style={styles.bootstrapBody}>{error ?? 'Your ideas stay on this device while Hmmmidea gets ready.'}</Text>
    {!loading ? <Pressable accessibilityRole="button" accessibilityLabel="Retry local workspace setup" onPress={() => void retryAppRuntime().catch(() => undefined)} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>Try again</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  feedbackLayer: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  bootstrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28, backgroundColor: colors.canvas },
  bootstrapTitle: { color: colors.ink, fontFamily: onboardingFonts.displaySemiBold, fontSize: 20, textAlign: 'center' },
  bootstrapBody: { maxWidth: 320, color: colors.inkMuted, fontFamily: onboardingFonts.bodyRegular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', marginTop: 8, paddingHorizontal: 22, borderRadius: 999, backgroundColor: colors.ink },
  retryText: { color: colors.inkInverse, fontFamily: onboardingFonts.bodyBold, fontSize: 14 },
  pressed: { opacity: 0.7 },
});
