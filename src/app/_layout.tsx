import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { Palettes } from '@/constants/theme';
import { SettingsProvider } from '@/lib/settings';

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const c = Palettes[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SettingsProvider>
      <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.background, card: c.background } }}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="live" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="find" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="helper" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="help-view" options={{ presentation: 'modal' }} />
        </Stack>
      </ThemeProvider>
    </SettingsProvider>
  );
}
