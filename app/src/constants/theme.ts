/**
 * Mubayan Vision design tokens — visual language modelled on Meta AI:
 * airy white canvas, heavy type, soft grey surfaces, one blue accent and a gradient orb.
 * Touch targets stay ≥ 56pt for VoiceOver / TalkBack users.
 */

import '@/global.css';

import { Platform, useColorScheme } from 'react-native';

const light = {
  background: '#FFFFFF',
  surface: '#F1F4F7',
  surfaceStrong: '#E4E8EE',
  card: '#FFFFFF',
  border: '#E4E8EE',
  text: '#0A1317',
  textSecondary: '#65717C',
  textTertiary: '#A7B0B9',
  accent: '#0064E0',
  onAccent: '#FFFFFF',
  stop: '#FFE1E6',
  stopText: '#E4153B',
  success: '#1FA855',
  shadow: '#0A1317',
};

const dark: typeof light = {
  background: '#000000',
  surface: '#16191D',
  surfaceStrong: '#23272D',
  card: '#101215',
  border: '#23272D',
  text: '#F5F7F9',
  textSecondary: '#9AA4AE',
  textTertiary: '#5B646D',
  accent: '#3D8BFF',
  onAccent: '#FFFFFF',
  stop: '#3A1219',
  stopText: '#FF6B81',
  success: '#34D17A',
  shadow: '#000000',
};

export type Palette = typeof light;
export const Palettes = { light, dark };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** The Meta‑style orb gradient: blue → cyan → violet. */
export const OrbColors = ['#0064E0', '#00C6FF', '#7B61FF', '#C04BFF', '#0064E0'] as const;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded' },
  default: { sans: 'normal', rounded: 'normal' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 26,
  full: 999,
} as const;

export const Type = {
  display: { fontSize: 32, fontWeight: '700', lineHeight: 42, letterSpacing: -0.4 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 32 },
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 26 },
  spoken: { fontSize: 22, fontWeight: '400', lineHeight: 34 },
  caption: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
} as const;

export const MinTouch = 56;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
