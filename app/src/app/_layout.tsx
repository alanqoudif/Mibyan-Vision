import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastProvider } from '@/components/ui';
import { useColors, useScheme } from '@/constants/theme';
import { SettingsProvider } from '@/lib/settings';
import { useExternalRoutes } from '@/lib/shortcuts';
import { useSixthBootstrap } from '@/lib/sixth';
import { useS } from '@/lib/strings';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });
  // A font failure must not block the app: fall back to the system font.
  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <SettingsProvider>
      <Shell />
    </SettingsProvider>
  );
}

function Shell() {
  const scheme = useScheme();
  const c = useColors();
  const s = useS();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  useSixthBootstrap();

  const pushed = (title: string) => ({
    headerShown: true,
    title,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerTintColor: c.text,
    headerStyle: { backgroundColor: c.background },
    headerShadowVisible: false,
    headerTitleStyle: { color: c.text },
  });

  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.background, card: c.background, primary: c.accent, text: c.text, border: c.border } }}>
      <ToastProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <ExternalRoutes />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="profile" options={pushed('')} />
          <Stack.Screen name="senses" options={pushed('')} />
          <Stack.Screen name="glasses" options={pushed('')} />
          <Stack.Screen name="activity" options={pushed('')} />
          <Stack.Screen name="shortcuts" options={pushed('')} />
          <Stack.Screen name="personalize" options={pushed('')} />
          <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="live" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="find" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="qibla" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="helper" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="live-vision" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="help-view" options={{ presentation: 'modal' }} />
          <Stack.Screen name="contacts" options={{ presentation: 'modal' }} />
          <Stack.Screen name="tools" options={{ presentation: 'modal' }} />
          <Stack.Screen name="plugins" options={{ presentation: 'modal' }} />
          <Stack.Screen name="account" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pharmacy" options={{ presentation: 'modal' }} />
          <Stack.Screen name="history" options={{ presentation: 'modal' }} />
          <Stack.Screen name="assistant-settings" options={pushed(s.prAccessibility)} />
          <Stack.Screen name="glasses-settings" options={pushed(s.gSettings)} />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}

function ExternalRoutes() {
  useExternalRoutes();
  return null;
}
