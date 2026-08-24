/**
 * @file AppScreen.tsx
 * @description Shared screen shell for primary application routes.
 * @author Gurkirat Singh
 * @license MIT
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainPageTransition } from '@/components/MainPageTransition';
import { MainBrandHeader } from '@/components/MainBrandHeader';
import { colors, spacing } from '@/constants/theme';

export function AppScreen({ eyebrow, title, supporting, children }: { eyebrow: string; title: string; supporting: string; children?: ReactNode }) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <MainPageTransition>
          <MainBrandHeader />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.supporting}>{supporting}</Text>
          <View style={styles.body}>{children}</View>
        </MainPageTransition>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.page, paddingTop: 22, paddingBottom: 112 },
  eyebrow: { marginTop: 24, color: colors.inkMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { maxWidth: 330, marginTop: 10, color: colors.ink, fontSize: 34, fontWeight: '700', lineHeight: 39 },
  supporting: { maxWidth: 330, marginTop: 10, color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  body: { flex: 1, marginTop: spacing.section },
});
