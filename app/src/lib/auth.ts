import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';
import { getDeviceId } from '@/lib/storage';

WebBrowser.maybeCompleteAuthSession();

export async function signIn(provider: 'apple' | 'google') {
  if (!supabase) throw new Error('أضف إعدادات Supabase أولاً.');
  if (provider === 'apple' && Platform.OS === 'ios') {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL, AppleAuthentication.AppleAuthenticationScope.FULL_NAME] });
    if (!credential.identityToken) throw new Error('لم يصل رمز تسجيل Apple.');
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken });
    if (error) throw error;
    await linkDevice();
    return data;
  }
  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true, scopes: provider === 'google' ? 'openid email profile' : undefined } });
  if (error) throw error;
  if (!data.url) throw new Error('لم يصل رابط تسجيل الدخول.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null;
  const returned = new URL(result.url);
  const code = returned.searchParams.get('code');
  if (!code) throw new Error('تعذر إكمال تسجيل الدخول.');
  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  await linkDevice();
  return sessionData;
}

export async function linkDevice() {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data, error } = await supabase.functions.invoke('mata-link-device', { body: { device_id: getDeviceId() } });
  if (error) throw error;
  if (data?.linked !== true) throw new Error(data?.error === 'device is linked to another account' ? 'هذا الجهاز مرتبط بحساب آخر.' : 'تعذر ربط الجهاز بالحساب.');
}
