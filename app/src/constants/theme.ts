/**
 * Mibyan Vision design tokens: the Mibyan language at its most legible.
 * Near-black canvas (default), graphite surfaces, electric-violet accent with a cyan edge.
 *  * Every readable text colour meets 4.5:1 on background and surface in both modes (low-vision audience).
 * Touch targets stay ≥ 56pt for VoiceOver / TalkBack users; text scales up to 2× with the OS setting.
 */

import '@/global.css';

import { Platform, useColorScheme, useWindowDimensions } from 'react-native';

import { useSettings, type Accent } from '@/lib/settings';

const light = {
  background: '#F6F5FB',
  surface: '#ECEAF5',
  surfaceStrong: '#DDDAEC',
  card: '#FFFFFF',
  border: '#E1DEEE',
  field: '#ECEAF5', // text inputs and wells that sit on a card
  text: '#0E0D18',
  textSecondary: '#4D4B63', // 7.6:1 on background
  textTertiary: '#5C5A72', // 6.0:1 on background, 5.2:1 on surface
  accent: '#6D3FE0', // 6.1:1 with white text
  accentText: '#5B2FCB', // 7.4:1 on background
  onAccent: '#FFFFFF',
  stop: '#FFE3E8',
  stopText: '#B4112D',
  success: '#157A3E',
  onSuccess: '#FFFFFF',
  warning: '#9A5B00',
  cyan: '#0A7E96',
  sand: '#8A6B3A',
  glow: '#8B5CF6',
  shadow: '#1A1033',
};

const dark: typeof light = {
  background: '#07070B',
  surface: '#101018',
  surfaceStrong: '#1B1B28',
  card: '#13131C',
  border: '#24243A',
  field: '#1B1B28', // one step above card; surface is too close to read as a well
  text: '#F4F3FA',
  textSecondary: '#A8A7BD', // 8.4:1 on background
  textTertiary: '#8F8EA6', // 6.3:1 on background, 5.6:1 on surface
  accent: '#7C4DEB', // 5.2:1 with white text
  accentText: '#A78BFA', // 6.9:1 on surface
  onAccent: '#FFFFFF',
  stop: '#3A1219',
  stopText: '#FF7A90',
  success: '#34D17A',
  onSuccess: '#07070B',
  warning: '#F5B544',
  cyan: '#38D5F0',
  sand: '#D9C3A0',
  glow: '#8B5CF6',
  shadow: '#000000',
};

export type Palette = typeof light;
export const Palettes = { light, dark };

/** Dark is the default; "system" follows the OS. */
export function useScheme(): 'light' | 'dark' {
  const { settings } = useSettings();
  const system = useColorScheme();
  if (settings.appearance === 'system') return system === 'light' ? 'light' : 'dark';
  return settings.appearance;
}

/**
 * The accent the user picked in Personalization. Each pair is checked: white on `accent` and
 * `accentText` on background and surface stay at or above 4.5:1 in both modes.
 */
export const Accents: Record<Accent, { light: [string, string]; dark: [string, string]; swatch: string }> = {
  violet: { light: ['#6D3FE0', '#5B2FCB'], dark: ['#7C4DEB', '#A78BFA'], swatch: '#7C4DEB' },
  blue: { light: ['#1F5FD0', '#1A54BC'], dark: ['#2F6BDB', '#86B4FF'], swatch: '#2F6BDB' },
  teal: { light: ['#0A766A', '#08665C'], dark: ['#0B7468', '#4CD3C2'], swatch: '#14A394' },
  amber: { light: ['#9C4F00', '#8A4500'], dark: ['#A05300', '#F6B65A'], swatch: '#E08A1E' },
  rose: { light: ['#C0185A', '#AD154F'], dark: ['#C21F5C', '#FF8DB4'], swatch: '#E0407A' },
};

export function useColors(): Palette {
  const scheme = useScheme();
  const { settings } = useSettings();
  const base = Palettes[scheme];
  const a = Accents[settings.accent] ?? Accents.violet;
  if (settings.accent === 'violet' || !Accents[settings.accent]) return base;
  const [accent, accentText] = a[scheme];
  return { ...base, accent, accentText, glow: a.swatch };
}

/**
 * Alerts drawn over the camera feed. They sit on video, not on the theme background, so they
 * don't switch with light/dark. Both pass 4.5:1 for caption text.
 */
export const CameraAlert = {
  danger: { fill: '#C2122F', text: '#FFFFFF' }, // 6.0:1
  warning: { fill: '#FF9F0A', text: '#0A1317' }, // 9.6:1 (white on this orange was 2.2:1)
  scrim: 'rgba(0,0,0,0.6)', // white caption stays >= 4.5:1 over a bright frame
} as const;

/** The Sense Orb gradient: violet → indigo → cyan. */
export const OrbColors = ['#7C4DEB', '#4F46E5', '#22D3EE', '#8B5CF6', '#7C4DEB'] as const;

/** IBM Plex Sans Arabic covers Arabic and Latin, so one family serves both languages. */
export const FontFamily = {
  '400': 'IBMPlexSansArabic_400Regular',
  '500': 'IBMPlexSansArabic_500Medium',
  '600': 'IBMPlexSansArabic_600SemiBold',
  '700': 'IBMPlexSansArabic_700Bold',
} as const;

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
  xl: 34,
  full: 999,
} as const;

export const Type = {
  hero: { fontSize: 38, fontWeight: '700', lineHeight: 52, letterSpacing: -0.5 },
  display: { fontSize: 32, fontWeight: '700', lineHeight: 44, letterSpacing: -0.3 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 34 },
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 28 },
  body: { fontSize: 17, fontWeight: '400', lineHeight: 28 },
  spoken: { fontSize: 22, fontWeight: '400', lineHeight: 36 },
  caption: { fontSize: 15, fontWeight: '500', lineHeight: 24 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 20, letterSpacing: 0.2 },
} as const;

export const MinTouch = 56;
/** Secondary controls never go below Apple's 44pt minimum. */
export const SmallTouch = 44;
/** Dynamic Type ceiling. Low-vision users need room to grow; never cap below 2. */
export const MaxFontScale = 2;
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;

/**
 * Size for big decorative graphics (orb, compass dial, direction arrow). When the user's text is
 * large, or the screen is short, the graphic gives its room back to the words around it.
 */
export function useGraphicSize(base: number): number {
  const { fontScale, height } = useWindowDimensions();
  const byText = Math.min(Math.max(fontScale, 1), 1.6);
  const byHeight = Math.min(1, height / 844);
  return Math.round((base * byHeight) / byText);
}
