/**
 * @file notifications.tsx
 * @description Settings route for Android completion-notification preferences and permission state.
 * @author Gurkirat Singh
 * @license MIT
 */

import { BellSimpleIcon as Bell } from "phosphor-react-native";
import { StyleSheet, Switch, Text, View } from "react-native";

import { SettingsSubpage } from "@/components/settings/SettingsSubpage";
import { colors, onboardingFonts, radii } from "@/constants/theme";
import { useNotificationSettings } from "@/features/settings/use-notification-settings";
export default function NotificationSettingsScreen() {
  const settings = useNotificationSettings();
  return (
    <SettingsSubpage
      supporting="Stay focused. Alerts are off until you turn them on, and Android permission is requested only then."
      title="Notifications"
    >
      <View style={styles.notice}>
        <Bell color={colors.ink} size={20} weight="bold" />
        <Text style={styles.noticeText}>
          A background alert only says that processing finished or needs
          attention. It never includes an idea title, transcript, audio, or
          provider detail.
        </Text>
      </View>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.label}>Background completion alerts</Text>
          <Text style={styles.description}>
            Only when the app is not in the foreground.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Background completion alerts"
          accessibilityState={{
            busy: settings.saving,
            disabled: settings.saving,
          }}
          disabled={settings.saving}
          onValueChange={(enabled) => void settings.setEnabled(enabled)}
          trackColor={{ false: colors.lineStrong, true: colors.primary }}
          value={settings.preferences.enabled}
        />
      </View>
      <View style={styles.options}>
        <PreferenceSwitch
          description="Tell you when a report is ready."
          disabled={settings.saving}
          label="Report ready"
          onValueChange={(enabled) =>
            void settings.setCategory("reportReady", enabled)
          }
          value={settings.preferences.reportReady}
        />
        <PreferenceSwitch
          description="Tell you when processing needs attention."
          disabled={settings.saving}
          label="Processing failed"
          onValueChange={(enabled) =>
            void settings.setCategory("processingFailed", enabled)
          }
          value={settings.preferences.processingFailed}
        />
      </View>
      <Text style={styles.foreground}>
        When Hmmmidea is open, the same outcome is shown in-app instead of as a
        system notification.
      </Text>
      {settings.message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {settings.message}
        </Text>
      ) : null}
    </SettingsSubpage>
  );
}
function PreferenceSwitch({
  description,
  disabled,
  label,
  onValueChange,
  value,
}: {
  description: string;
  disabled: boolean;
  label: string;
  onValueChange(enabled: boolean): void;
  value: boolean;
}) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: colors.lineStrong, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.primarySoft,
  },
  noticeText: {
    flex: 1,
    color: colors.ink,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    padding: 16,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  copy: { flex: 1, gap: 3 },
  label: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 15,
  },
  description: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 17,
  },
  options: {
    gap: 1,
    marginTop: 14,
    paddingHorizontal: 16,
    borderRadius: radii.large,
    backgroundColor: colors.canvas,
  },
  preferenceRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  foreground: {
    marginTop: 12,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 12,
    lineHeight: 18,
  },
  message: {
    marginTop: 12,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 12,
  },
});
