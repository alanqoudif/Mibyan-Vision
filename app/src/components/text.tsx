import { Text as RNText, type TextProps } from 'react-native';

import { FontFamily, MaxFontScale, Type, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type Variant = keyof typeof Type;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'success' | 'warning' | 'danger';

export function Text({
  variant = 'body',
  tone = 'primary',
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; center?: boolean }) {
  const c = useColors();
  const { dir } = useI18n();
  const color = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accentText,
    success: c.success,
    warning: c.warning,
    danger: c.stopText,
  }[tone];
  const align = center ? 'center' : dir === 'rtl' ? 'right' : 'left';
  const v = Type[variant];
  return (
    <RNText
      maxFontSizeMultiplier={MaxFontScale}
      style={[v, { fontFamily: FontFamily[v.fontWeight], color, writingDirection: dir, textAlign: align }, style]}
      {...rest}
    />
  );
}
