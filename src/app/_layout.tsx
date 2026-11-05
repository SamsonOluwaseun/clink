import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold, useFonts } from '@expo-google-fonts/montserrat';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { CurrencyProvider } from '@/lib/currency';
import { DataProvider } from '@/lib/data';
import { SyncProvider } from '@/lib/sync';
import { colors, fonts } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <DataProvider>
      <SyncProvider>
      <CurrencyProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.cream },
          headerShadowVisible: false,
          headerTintColor: colors.navy,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 19 },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.cream },
        }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="child/[id]" options={{ title: '' }} />
        <Stack.Screen name="child-form" options={{ presentation: 'modal', title: 'Child' }} />
        <Stack.Screen name="reward" options={{ presentation: 'modal', title: 'Give a reward' }} />
        <Stack.Screen name="goal" options={{ presentation: 'modal', title: 'Goal' }} />
        <Stack.Screen name="manage" options={{ title: 'Activities' }} />
        <Stack.Screen name="activity-form" options={{ presentation: 'modal', title: 'Activity' }} />
        <Stack.Screen name="sync" options={{ title: 'Family sync' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan pairing code' }} />
        <Stack.Screen name="give" options={{ presentation: 'modal', title: 'Tithe or offering' }} />
        <Stack.Screen name="report" options={{ title: 'Weekly report' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
      </CurrencyProvider>
      </SyncProvider>
    </DataProvider>
  );
}
