/**
 * @file theme.ts
 * @description Shared color, spacing, radius, and typography design tokens.
 * @author Gurkirat Singh
 * @license MIT
 */

export const colors = {
  canvas: "#FFFFFF",
  canvasSoft: "#FAFAFA",
  surfaceMuted: "#F4F4F4",
  ink: "#1C1C1C",
  inkSecondary: "#323232",
  inkMuted: "rgba(28, 28, 28, 0.68)",
  inkInverse: "#FFFFFF",
  line: "rgba(28, 28, 28, 0.10)",
  lineStrong: "rgba(28, 28, 28, 0.18)",
  primary: "#98E2F4",
  primarySoft: "#E3F8FC",
  happy: "#FDB0E3",
  happySoft: "#FFE7F6",
  calm: "#83F5CC",
  calmSoft: "#DDFFF1",
  darkCanvas: "#1C1C1C",
  darkSurface: "#323232",
  danger: "#FF6B6B",
  dangerSoft: "#FFE8E8",
  darkLine: "rgba(255, 255, 255, 0.12)",
  darkMuted: "rgba(255, 255, 255, 0.72)",
} as const;

export const spacing = { page: 20, section: 28, item: 14, compact: 8 } as const;
export const radii = {
  small: 10,
  medium: 16,
  large: 24,
  panel: 30,
  pill: 999,
} as const;

export const onboardingFonts = {
  displayRegular: "DynaPuff_400Regular",
  displayMedium: "DynaPuff_500Medium",
  displaySemiBold: "DynaPuff_600SemiBold",
  displayBold: "DynaPuff_700Bold",
  bodyRegular: "ShortStack_400Regular",
  bodyMedium: "ShortStack_400Regular",
  bodySemiBold: "DynaPuff_600SemiBold",
  bodyBold: "DynaPuff_700Bold",
} as const;
