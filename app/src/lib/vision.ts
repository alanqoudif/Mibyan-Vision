import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import type { Permission, SenseManifest } from '@mibyan/shared/sense';

import { supabase as mainClient, serverRender } from '@/lib/supabase';

/**
 * Account data for Senses. Uses its own Supabase project when EXPO_PUBLIC_VISION_SUPABASE_URL /
 * _ANON_KEY are set (for testing on a dev branch); otherwise the app's main account client.
 */
const url = process.env.EXPO_PUBLIC_VISION_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_VISION_SUPABASE_ANON_KEY;
const separate = !!(url && key);
export const visionClient = separate
  ? createClient(url!, key!, { auth: serverRender ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } : { storage: AsyncStorage, storageKey: 'vision-auth', autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })
  : mainClient;
export const visionIsSeparate = separate;

export type InstalledSense = { manifest: SenseManifest; enabled: boolean; granted: Permission[]; settings: Record<string, unknown>; version: string };

export function useVisionSession() {
  const [state, setState] = useState<{ ready: boolean; email: string | null }>({ ready: false, email: null });
  useEffect(() => {
    if (!visionClient) { Promise.resolve().then(() => setState({ ready: true, email: null })); return; }
    visionClient.auth.getSession().then(({ data }) => setState({ ready: true, email: data.session?.user.email ?? null }));
    const { data } = visionClient.auth.onAuthStateChange((_e, s) => setState({ ready: true, email: s?.user.email ?? null }));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}

export async function signInWithPassword(email: string, password: string) {
  if (!visionClient) throw new Error('No account backend configured.');
  const { error } = await visionClient.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutVision() {
  await visionClient?.auth.signOut();
}

/** The signed-in account's installed Senses, exactly as installed on the web. */
export async function fetchInstalled(): Promise<InstalledSense[]> {
  if (!visionClient) return [];
  const inst = await visionClient.from('vision_sense_installations').select('sense_id,version,enabled,granted_permissions,settings');
  if (inst.error) throw new Error(inst.error.message);
  const rows = inst.data ?? [];
  if (!rows.length) return [];
  const ver = await visionClient.from('vision_sense_versions').select('sense_id,version,manifest').in('sense_id', rows.map((r) => r.sense_id));
  if (ver.error) throw new Error(ver.error.message);
  return rows.flatMap((r) => {
    const v = (ver.data ?? []).find((x) => x.sense_id === r.sense_id && x.version === r.version);
    return v ? [{ manifest: v.manifest as SenseManifest, enabled: r.enabled, granted: r.granted_permissions as Permission[], settings: (r.settings ?? {}) as Record<string, unknown>, version: r.version }] : [];
  });
}

export async function setInstalledEnabled(senseId: string, enabled: boolean) {
  if (!visionClient) return;
  const { error } = await visionClient.from('vision_sense_installations').update({ enabled, updated_at: new Date().toISOString() }).eq('sense_id', senseId);
  if (error) throw new Error(error.message);
}

export function useInstalled(active: boolean) {
  const [items, setItems] = useState<InstalledSense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let live = true;
    Promise.resolve()
      .then(() => { if (live) setLoading(true); })
      .then(fetchInstalled)
      .then((r) => { if (live) { setItems(r); setError(null); } })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [active, tick]);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { items, error, loading, refresh };
}
