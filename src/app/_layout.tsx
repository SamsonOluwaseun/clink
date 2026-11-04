import { Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { DataProvider } from '@/lib/data';
import { colors, fonts } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <DataProvider>
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
        <Stack.Screen name="manage" options={{ title: 'Activities and children' }} />
        <Stack.Screen name="activity-form" options={{ presentation: 'modal', title: 'Activity' }} />
      </Stack>
    </DataProvider>
  );
}
