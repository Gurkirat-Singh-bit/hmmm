/**
 * @file theme.ts
 * @description Shared color, spacing, radius, and typography design tokens.
 * @author Gurkirat Singh
 * @license MIT
 */

export const colors = {
  canvas: '#FFFFFF', canvasSoft: '#FAFAFA', surfaceMuted: '#F4F4F4',
  ink: '#1C1C1C', inkSecondary: '#323232', inkMuted: 'rgba(28, 28, 28, 0.58)', inkInverse: '#FFFFFF',
  line: 'rgba(28, 28, 28, 0.10)', lineStrong: 'rgba(28, 28, 28, 0.18)',
  primary: '#98E2F4', primarySoft: '#E3F8FC', happy: '#FDB0E3', happySoft: '#FFE7F6',
  calm: '#83F5CC', calmSoft: '#DDFFF1', darkCanvas: '#1C1C1C', darkSurface: '#323232',
  danger: '#FF6B6B', dangerSoft: '#FFE8E8', darkLine: 'rgba(255, 255, 255, 0.12)',
  darkMuted: 'rgba(255, 255, 255, 0.62)',
} as const;

export const spacing = { page: 20, section: 28, item: 14, compact: 8 } as const;
export const radii = { small: 10, medium: 16, large: 24, panel: 30, pill: 999 } as const;

export const onboardingFonts = {
  displayRegular: 'BricolageGrotesque_400Regular',
  displayMedium: 'BricolageGrotesque_500Medium',
  displaySemiBold: 'BricolageGrotesque_600SemiBold',
  displayBold: 'BricolageGrotesque_700Bold',
  bodyRegular: 'Nunito_400Regular',
  bodyMedium: 'Nunito_500Medium',
  bodySemiBold: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_700Bold',
} as const;
