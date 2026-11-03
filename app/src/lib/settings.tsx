import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import * as Earcons from '@/lib/earcons';
import { readJSON, writeJSON } from '@/lib/storage';
import * as Voice from '@/lib/voice';
import { supabase } from '@/lib/supabase';
import { linkDevice } from '@/lib/auth';
import type { ModeId } from '@/lib/modes';

export type Settings = {
  lang: 'ar' | 'en';
  languageMode: 'system' | 'manual';
  enabledTools: ModeId[];
  enabledPluginIds: string[];
  speed: 'slow' | 'normal' | 'fast';
  detail: boolean;
  model: 'smart' | 'fast';
  haptics: boolean;
  /** Keep listening after each answer, like a real conversation. */
  continuous: boolean;
  /** Seconds between frames in live mode. */
  liveEvery: 1 | 3 | 5 | 10;
  /** Short status sounds (listening, photo taken, thinking, error). */
  sounds: boolean;
  /** Coach the user to aim the camera before reading text, money, labels or screens. */
  framing: boolean;
  /** Keep the mic open while answering so "stop" / a new question cuts the answer off. */
  bargeIn: boolean;
  /** Name people the user enrolled. Only offered when FACES_ALLOWED (see lib/faces). */
  faces: boolean;
  /** "Chair at 2 o'clock, 3 steps" (O&M style) or plain left/right. */
  directions: 'clock' | 'simple';
  /** With VoiceOver on, speak answers through VoiceOver (its voice and rate) instead of the app's. */
  voiceOver: boolean;
  /** What the assistant calls the user, asked during onboarding. */
  name: string;
  /** The first-launch voice setup has run (or was skipped). */
  onboarded: boolean;
};

const DEFAULTS: Settings = {
  lang: 'ar',
  languageMode: 'system',
  enabledTools: ['describe', 'where', 'read', 'find', 'money', 'product', 'meds', 'screen', 'clothes', 'menu', 'people', 'live'],
  enabledPluginIds: ['builtin-study', 'builtin-navigation', 'builtin-safety-inspection', 'builtin-pharmacy-shelf'],
  speed: 'normal',
  detail: true,
  model: 'smart',
  haptics: true,
  continuous: true,
  liveEvery: 1,
  sounds: true,
  framing: true,
  bargeIn: false,
  faces: false,
  directions: 'clock',
  voiceOver: true,
  name: '',
  onboarded: false,
};

export const SPEECH_RATE: Record<Settings['speed'], number> = { slow: 0.85, normal: 1, fast: 1.2 };

const Ctx = createContext<{ settings: Settings; update: (p: Partial<Settings>) => void } | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...readJSON('settings', {}) }));
  const settingsRef = useRef(settings);
  const [syncOwner, setSyncOwner] = useState<string | null>(null);
  const [syncReady, setSyncReady] = useState(() => !supabase);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const sync = async (userId: string | null) => {
      if (!userId) { setSyncOwner(null); setSyncReady(true); return; }
      try {
        await linkDevice();
        const { data, error } = await client.from('mata_user_settings').select('settings').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        if (data?.settings && typeof data.settings === 'object') {
          const merged = { ...DEFAULTS, ...data.settings } as Settings;
          settingsRef.current = merged;
          setSettings(merged);
          writeJSON('settings', merged);
        } else {
          await client.from('mata_user_settings').upsert({ user_id: userId, settings: settingsRef.current, updated_at: new Date().toISOString() });
        }
        if (active) { setSyncOwner(userId); setSyncReady(true); }
      } catch (error) { console.warn('settings sync failed', error); if (active) setSyncReady(true); }
    };
    void client.auth.getSession().then(({ data }) => sync(data.session?.user.id ?? null));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => { setSyncReady(false); setTimeout(() => void sync(session?.user.id ?? null), 0); });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    const client = supabase;
    if (!syncReady || !syncOwner || !client) return;
    const timer = setTimeout(() => {
      void client.from('mata_user_settings').upsert({ user_id: syncOwner, settings, updated_at: new Date().toISOString() })
        .then(({ error }) => { if (error) console.warn('settings sync failed', error.message); });
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, syncOwner, syncReady]);
  useEffect(() => Earcons.setEnabled(settings.sounds), [settings.sounds]);
  useEffect(() => Voice.setPreferScreenReader(settings.voiceOver), [settings.voiceOver]);
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch };
      writeJSON('settings', next);
      return next;
    });
  return <Ctx.Provider value={{ settings, update }}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings outside SettingsProvider');
  return v;
}
