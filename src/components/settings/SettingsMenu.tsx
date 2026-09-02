/**
 * @file SettingsMenu.tsx
 * @description Reusable settings action list based on the profile reference.
 * @author Gurkirat Singh
 * @license MIT
 */

import {
  CaretRightIcon as CaretRight,
  DownloadSimpleIcon as Download,
  GearSixIcon as GearSix,
  GithubLogoIcon as GithubLogo,
  InfoIcon as Info,
  QuestionIcon as Question,
  ShieldCheckIcon as ShieldCheck,
  TranslateIcon as Translate,
} from "phosphor-react-native";
import type { ComponentProps, ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, onboardingFonts, radii } from "@/constants/theme";

export type SettingsMenuItem = {
  description: string;
  icon: ComponentType<ComponentProps<typeof GearSix>>;
  label: string;
  onPress: () => void;
};
type MenuGroup = { label: string; items: readonly SettingsMenuItem[] };
export function SettingsMenu({
  additionalConfiguration = [],
  additionalDataPrivacy = [],
  onExport,
  onGithub,
  onOpenAbout,
  onOpenFaq,
  onOpenGuide,
  onOpenLanguage,
  onOpenPrivacy,
  onOpenProviders,
}: {
  additionalConfiguration?: readonly SettingsMenuItem[];
  additionalDataPrivacy?: readonly SettingsMenuItem[];
  onExport: () => void;
  onGithub: () => void;
  onOpenAbout: () => void;
  onOpenFaq: () => void;
  onOpenGuide: () => void;
  onOpenLanguage: () => void;
  onOpenPrivacy: () => void;
  onOpenProviders: () => void;
}) {
  const groups: MenuGroup[] = [
    {
      label: "CONFIGURATION",
      items: [
        {
          icon: GearSix,
          label: "Providers & models",
          description: "Speech, AI, keys, and model selection",
          onPress: onOpenProviders,
        },
        {
          icon: Translate,
          label: "Language",
          description: "App and generated-content language",
          onPress: onOpenLanguage,
        },
        ...additionalConfiguration,
      ],
    },
    {
      label: "HELP",
      items: [
        {
          icon: Info,
          label: "How to use Hmmmidea",
          description: "Learn the complete capture workflow",
          onPress: onOpenGuide,
        },
        {
          icon: Question,
          label: "Frequently asked questions",
          description: "Answers about privacy, providers, and ideas",
          onPress: onOpenFaq,
        },
      ],
    },
    {
      label: "DATA & PRIVACY",
      items: [
        {
          icon: Download,
          label: "Export data",
          description: "Create a copy without secret API keys",
          onPress: onExport,
        },
        {
          icon: ShieldCheck,
          label: "Privacy policy",
          description: "Understand what stays local and what is sent",
          onPress: onOpenPrivacy,
        },
        ...additionalDataPrivacy,
      ],
    },
    {
      label: "ABOUT",
      items: [
        {
          icon: Info,
          label: "About & open source",
          description: "Version, license, and project information",
          onPress: onOpenAbout,
        },
        {
          icon: GithubLogo,
          label: "Open GitHub repository",
          description: "View the source code and contribute",
          onPress: onGithub,
        },
      ],
    },
  ];
  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <View key={group.label}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.menu}>
            {group.items.map(
              ({ description, icon: Icon, label, onPress }, index) => (
                <Pressable
                  accessibilityHint={description}
                  accessibilityRole="button"
                  key={label}
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    color={colors.inkSecondary}
                    size={20}
                    weight="regular"
                  />
                  <View style={styles.copy}>
                    <Text style={styles.label}>{label}</Text>
                    <Text style={styles.description}>{description}</Text>
                  </View>
                  <CaretRight color={colors.inkMuted} size={18} weight="bold" />
                  {index < group.items.length - 1 ? (
                    <View style={styles.divider} />
                  ) : null}
                </Pressable>
              ),
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 22 },
  groupLabel: {
    marginBottom: 8,
    marginLeft: 4,
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  menu: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.medium,
    backgroundColor: colors.canvas,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copy: { flex: 1, gap: 2 },
  label: {
    color: colors.ink,
    fontFamily: onboardingFonts.bodySemiBold,
    fontSize: 13,
  },
  description: {
    color: colors.inkMuted,
    fontFamily: onboardingFonts.bodyRegular,
    fontSize: 10,
  },
  divider: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 50,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.line,
  },
  pressed: { backgroundColor: colors.canvasSoft },
});
