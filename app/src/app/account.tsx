import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { signIn } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const c = useColors(); const insets = useSafeAreaInsets(); const { dir } = useI18n(); const router = useRouter();
  const [email, setEmail] = useState<string | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    void supabase?.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null)).data.subscription;
    return () => subscription?.unsubscribe();
  }, []);
  async function login(provider: 'apple' | 'google') {
    setBusy(true); setError('');
    try { await signIn(provider); const { data } = await supabase!.auth.getUser(); setEmail(data.user?.email ?? null); }
    catch (e) { setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول.'); }
    finally { setBusy(false); }
  }
  async function logout() { await supabase?.auth.signOut(); setEmail(null); }
  return <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30, direction: dir }]}>
    <View style={styles.header}><CircleButton icon="chevron.backward" label="رجوع" onPress={() => router.back()} /><Text variant="heading">الحساب والمزامنة</Text><View style={{ width: 48 }} /></View>
    <View style={[styles.card, { backgroundColor: c.surface }]}><Text variant="title">إضافاتك على أجهزتك</Text><Text tone="secondary">سجّل الدخول لربط إضافاتك وكتالوج الصيدلية بين تطبيق مبيان والموقع. سجل هذا الجهاز الحالي يبقى مرتبطًا بحسابك.</Text>
      {email ? <><Text variant="heading" style={{ marginTop: 20 }}>{email}</Text><Pressable style={[styles.action, { backgroundColor: c.card }]} onPress={() => void logout()}><Text variant="heading">تسجيل الخروج</Text></Pressable></> : <>
        {error ? <Text style={{ color: '#b63449' }}>{error}</Text> : null}
        {appleAvailable && <Pressable disabled={busy} style={[styles.action, { backgroundColor: '#201b2c' }]} onPress={() => void login('apple')}><Text variant="heading" style={{ color: 'white' }}>المتابعة مع Apple</Text></Pressable>}
        <Pressable disabled={busy} style={[styles.action, { backgroundColor: c.card }]} onPress={() => void login('google')}><Text variant="heading">المتابعة مع Google</Text></Pressable>
        <Text variant="caption" tone="secondary">يتطلب تسجيل الدخول تفعيل مزوّدي Apple وGoogle في إعدادات Supabase الخاصة بالمشروع.</Text>
      </>}
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: Spacing.three, gap: Spacing.three }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, card: { padding: Spacing.three, borderRadius: Radius.lg, gap: Spacing.two }, action: { minHeight: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.one, padding: Spacing.two } });
