import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '@/constants/theme';

export function EmptyPanel({ title, body }: { title: string; body: string }) {
  return <View style={styles.panel}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{body}</Text></View>;
}

const styles = StyleSheet.create({
  panel: { gap: 7, padding: 20, borderRadius: radii.large, backgroundColor: colors.surfaceMuted },
  title: { color: colors.ink, fontSize: 18, fontWeight: '600' },
  body: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
});
