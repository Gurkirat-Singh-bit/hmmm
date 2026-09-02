/**
 * @file WeeklyActivityChart.tsx
 * @description Reusable seven-day activity bar chart for capture counts.
 * @author Gurkirat Singh
 * @license MIT
 */

import { StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts, radii } from "@/constants/theme";

export type DailyActivity = { day: string; value: number };
export function WeeklyActivityChart({
  data,
}: {
  data: readonly DailyActivity[];
}) {
  const maximum = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <View
      accessible
      accessibilityLabel={`${total} ideas captured this week. ${data.map((item) => `${item.day}: ${item.value}`).join(", ")}`}
      style={styles.card}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>THIS WEEK</Text>
          <Text style={styles.title}>Your activity</Text>
        </View>
        <View style={styles.total}>
          <Text style={styles.totalValue}>{total}</Text>
          <Text style={styles.totalLabel}>IDEAS</Text>
        </View>
      </View>
      <View style={styles.chart}>
        {data.map((item, index) => {
          const active = index === data.length - 1;
          return (
            <View key={item.day} style={styles.column}>
              <View
                style={[
                  styles.activityRing,
                  active && styles.activityRingActive,
                ]}
              >
                <View
                  style={[
                    styles.activityDot,
                    { opacity: 0.24 + (item.value / maximum) * 0.76 },
                  ]}
                >
                  <Text style={styles.activityValue}>{item.value}</Text>
                </View>
              </View>
              <Text style={[styles.day, active && styles.dayActive]}>
                {item.day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 18,
    borderRadius: radii.large,
    backgroundColor: colors.happySoft,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 3,
    color: colors.ink,
    fontFamily: onboardingFonts.displaySemiBold,
    fontSize: 20,
  },
  total: {
    minWidth: 54,
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.medium,
    backgroundColor: colors.darkCanvas,
  },
  totalValue: {
    color: colors.inkInverse,
    fontFamily: onboardingFonts.displayBold,
    fontSize: 18,
  },
  totalLabel: {
    color: colors.darkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 7,
    letterSpacing: 0.8,
  },
  chart: { flexDirection: "row", gap: 5, marginTop: 20 },
  column: { flex: 1, alignItems: "center", gap: 8 },
  activityRing: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  activityRingActive: { borderWidth: 2, borderColor: colors.ink },
  activityDot: {
    width: 31,
    height: 31,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.happy,
  },
  activityValue: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 11,
  },
  day: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyMedium,
    fontSize: 9,
  },
  dayActive: { color: colors.ink, fontFamily: onboardingFonts.bodyBold },
});
