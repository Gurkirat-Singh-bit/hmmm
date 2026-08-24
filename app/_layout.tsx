/**
 * @file _layout.tsx
 * @description Root Expo Router layout that loads fonts and app-wide providers.
 * @author Gurkirat Singh
 * @license MIT
 */

import { BricolageGrotesque_400Regular } from '@expo-google-fonts/bricolage-grotesque/400Regular';
import { BricolageGrotesque_500Medium } from '@expo-google-fonts/bricolage-grotesque/500Medium';
import { BricolageGrotesque_600SemiBold } from '@expo-google-fonts/bricolage-grotesque/600SemiBold';
import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_500Medium } from '@expo-google-fonts/nunito/500Medium';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';
import { FloatingBottomNav } from '@/components/navigation/FloatingBottomNav';
import { prefetchPublicCatalogs } from '@/features/onboarding/model-catalog';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    void prefetchPublicCatalogs();
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.darkCanvas }} />;

  return <SafeAreaProvider><RootNavigator /></SafeAreaProvider>;
}

function RootNavigator() {
  const pathname = usePathname();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={({ route }) => ({
          animation: ['index', 'vault/index', 'discuss', 'settings/index'].includes(route.name) ? 'none' : 'fade',
          contentStyle: { backgroundColor: colors.canvas },
          headerShown: false,
        })}
      />
      {['/', '/vault', '/discuss', '/settings'].includes(pathname) ? <FloatingBottomNav /> : null}
    </>
  );
}
