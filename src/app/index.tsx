/**
 * @file index.tsx
 * @description Home capture route and onboarding entry guard.
 * @author Gurkirat Singh
 * @license MIT
 */

import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowClockwiseIcon as ArrowClockwise,
  WarningCircleIcon as WarningCircle,
} from "phosphor-react-native";
import { HomeGreeting } from "@/components/home/HomeGreeting";
import { RecentIdeasPreview } from "@/components/home/RecentIdeasPreview";
import { VoiceCapturePanel } from "@/components/home/VoiceCapturePanel";
import { colors, onboardingFonts, radii, spacing } from "@/constants/theme";
import { useCapture } from "@/features/capture/use-capture";
import { normalizeError } from "@/features/domain/errors";
import {
  isOnboardingComplete,
  readPreferences,
} from "@/features/onboarding/storage";
import { deleteCaptures } from "@/features/vault/vault-service";
export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState("there");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const capture = useCapture();

  const loadHome = useCallback(() => {
    setReady(false);
    setLoadError(null);
    void Promise.all([isOnboardingComplete(), readPreferences()])
      .then(([complete, preferences]) => {
        if (!complete) return router.replace("/onboarding");
        setName(preferences.displayName || "there");
        setReady(true);
      })
      .catch((error) => {
        setLoadError(normalizeError(error, "database").message);
      });
  }, [router]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  if (loadError) {
    return (
      <SafeAreaView style={styles.recovery}>
        <View
          accessible
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
          style={styles.recoveryCopy}
        >
          <View style={styles.recoveryIcon}>
            <WarningCircle color={colors.ink} size={26} weight="bold" />
          </View>
          <Text style={styles.recoveryTitle}>Hmmmidea could not load</Text>
          <Text style={styles.recoveryBody}>{loadError}</Text>
        </View>
        <Pressable
          accessibilityLabel="Try loading Hmmmidea again"
          accessibilityRole="button"
          onPress={loadHome}
          style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        >
          <ArrowClockwise color={colors.inkInverse} size={19} weight="bold" />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Open Hmmmidea setup"
          accessibilityRole="button"
          onPress={() => router.replace("/onboarding")}
          style={({ pressed }) => [styles.setup, pressed && styles.pressed]}
        >
          <Text style={styles.setupText}>Open setup</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!ready) {
    return (
      <View
        accessible
        accessibilityLabel="Loading your capture space"
        accessibilityRole="progressbar"
        style={styles.loading}
      >
        <ActivityIndicator color={colors.ink} size="small" />
        <Text style={styles.loadingText}>Loading your capture space…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <HomeGreeting name={name} />
        <VoiceCapturePanel
          capture={capture.capture}
          onCancel={capture.cancel}
          onFinish={capture.finish}
          onPause={capture.pause}
          onResume={capture.resume}
          onRetry={capture.retry}
          onStart={capture.start}
        />
        <RecentIdeasPreview
          ideas={capture.recent}
          onDelete={async (idea) => {
            try {
              await deleteCaptures([idea]);
            } catch (error) {
              Alert.alert(
                "Could not delete idea",
                normalizeError(error, "database").message,
              );
              throw error;
            }
          }}
          onOpen={(id) => router.push(`/vault/${id}`)}
          onRetry={capture.retryCapture}
          onSeeAll={() => router.push("/vault")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.compact,
    backgroundColor: colors.canvas,
  },
  loadingText: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 15,
  },
  recovery: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.page,
    backgroundColor: colors.canvas,
  },
  recoveryCopy: { alignItems: "center" },
  recoveryIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: colors.dangerSoft,
  },
  recoveryTitle: {
    marginTop: 18,
    color: colors.ink,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 24,
    textAlign: "center",
  },
  recoveryBody: {
    maxWidth: 360,
    marginTop: 8,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  retry: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 28,
    borderRadius: radii.medium,
    backgroundColor: colors.ink,
  },
  retryText: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 15,
  },
  setup: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  setupText: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 14,
  },
  pressed: { opacity: 0.72 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.page,
    paddingTop: 14,
    paddingBottom: 136,
  },
});
