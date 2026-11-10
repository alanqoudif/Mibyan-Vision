import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const secureStorage: SupportedStorage = {
  async getItem(key) {
    const meta = await SecureStore.getItemAsync(`${key}.parts`);
    if (!meta) return SecureStore.getItemAsync(key);
    const count = Number(meta);
    if (!Number.isInteger(count) || count < 1 || count > 20) return null;
    return (await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)))).join('');
  },
  async setItem(key, value) {
    const chunkSize = 1700;
    const parts = Array.from({ length: Math.ceil(value.length / chunkSize) }, (_, i) => value.slice(i * chunkSize, (i + 1) * chunkSize));
    if (parts.length > 20) throw new Error('Session data exceeds secure storage capacity.');
    if (!parts.length) parts.push('');
    await Promise.all(parts.map((part, i) => SecureStore.setItemAsync(`${key}.${i}`, part)));
    await SecureStore.setItemAsync(`${key}.parts`, String(parts.length));
    await SecureStore.deleteItemAsync(key);
  },
  async removeItem(key) {
    const meta = await SecureStore.getItemAsync(`${key}.parts`);
    const count = Math.min(Number(meta) || 0, 20);
    await Promise.all([...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)), SecureStore.deleteItemAsync(`${key}.parts`), SecureStore.deleteItemAsync(key)]);
  },
};

/** Web pages are first rendered on the dev server, where there's no `window` or storage to keep a session in. */
export const serverRender = Platform.OS === 'web' && typeof window === 'undefined';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = url && anonKey
  ? createClient(url, anonKey, { auth: serverRender ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } : { storage: Platform.OS === 'web' ? AsyncStorage : secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'pkce' } })
  : null;
