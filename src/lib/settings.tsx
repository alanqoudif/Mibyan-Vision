import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import * as Earcons from '@/lib/earcons';
import { readJSON, writeJSON } from '@/lib/storage';
import * as Voice from '@/lib/voice';

export type Settings = {
  lang: 'ar' | 'en';
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
