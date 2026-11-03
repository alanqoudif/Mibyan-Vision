/**
 * Mibyan Vision design tokens: the Mibyan language at its most legible.
 * White canvas, ink type, soft grey wells, one blue accent and the live-agent orb.
 * Vision is the one Mibyan product where the accent fills primary actions (strongest affordance).
 * Every readable text colour meets 4.5:1 on background and surface in both modes (low-vision audience).
 * Touch targets stay ≥ 56pt for VoiceOver / TalkBack users; text scales up to 2× with the OS setting.
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
  textSecondary: '#55606A', // 6.4:1 on background, 5.8:1 on surface
  textTertiary: '#5E6973', // 5.6:1 on background, 5.1:1 on surface (was 2.2:1)
  accent: '#0064E0', // 5.4:1 with white text
  onAccent: '#FFFFFF',
  stop: '#FFE1E6',
  stopText: '#C2122F', // 5.0:1 on stop, 6.0:1 on background (was 3.8:1 on stop)
  success: '#1E8A47',
  onSuccess: '#FFFFFF', // 4.4:1, used for large glyphs only
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
  textTertiary: '#8B949E', // 6.8:1 on background, 5.7:1 on surface (was 3.5:1)
  // Lighter fill with ink text: 8.2:1. White on the old #3D8BFF was only 3.3:1.
  accent: '#6FB0F0',
  onAccent: '#0A1317',
  stop: '#3A1219',
  stopText: '#FF6B81',
  success: '#34D17A',
  onSuccess: '#0A1317', // 9.4:1; white on this green was 2.0:1
  shadow: '#000000',
};

export type Palette = typeof light;
export const Palettes = { light, dark };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** The live-agent orb gradient: Vision blue → cyan → violet. */
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
  caption: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
} as const;

export const MinTouch = 56;
/** Dynamic Type ceiling. Low-vision users need room to grow; never cap below 2. */
export const MaxFontScale = 2;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
