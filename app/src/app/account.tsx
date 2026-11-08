import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PillButton, ScreenHeader } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useAnnounce } from '@/lib/a11y';
import { signIn } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const c = useColors();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { t, dir } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useAnnounce(error);

  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    void supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null)).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);

  async function login(provider: 'apple' | 'google') {
    setBusy(true);
    setError('');
    try {
      await signIn(provider);
      const { data } = await supabase!.auth.getUser();
      setEmail(data.user?.email ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.accountError);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase?.auth.signOut();
    setEmail(null);
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background, direction: dir, paddingTop: insets.top + Spacing.two }]}>
      <ScreenHeader title={t.accountTitle} closeLabel={t.close} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <Text variant="title" accessibilityRole="header">
          {t.accountHeading}
        </Text>
        <Text tone="secondary">{t.accountIntro}</Text>

        {email ? (
          <View style={[styles.well, { backgroundColor: c.surface }]}>
            <Text variant="caption" tone="secondary">
              {t.accountSignedInAs}
            </Text>
            <Text variant="heading" selectable>
              {email}
            </Text>
          </View>
        ) : null}

        {!!error && (
          <Text tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Text>
        )}

        {email ? (
          <PillButton label={t.accountSignOut} variant="secondary" onPress={() => void logout()} />
        ) : (
          <View style={styles.actions}>
            {appleAvailable && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={
                  scheme === 'dark'
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={Radius.full}
                style={[styles.apple, busy && { opacity: 0.45 }]}
                onPress={() => !busy && void login('apple')}
              />
            )}
            <PillButton
              label={t.accountGoogle}
              variant={appleAvailable ? 'secondary' : 'primary'}
              busy={busy}
              onPress={() => void login('google')}
            />
            <Text variant="caption" tone="secondary">
              {t.accountSetupNote}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  well: { padding: Spacing.three, borderRadius: Radius.md, gap: Spacing.one },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  apple: { height: 60 },
});
