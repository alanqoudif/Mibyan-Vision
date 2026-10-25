import { Text as RNText, type TextProps } from 'react-native';

import { Type, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

type Variant = keyof typeof Type;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent';

export function Text({
  variant = 'body',
  tone = 'primary',
  center,
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone; center?: boolean }) {
  const c = useColors();
  const { dir } = useI18n();
  const color = { primary: c.text, secondary: c.textSecondary, tertiary: c.textTertiary, accent: c.accent }[tone];
  const align = center ? 'center' : dir === 'rtl' ? 'right' : 'left';
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[Type[variant], { color, writingDirection: dir, textAlign: align }, style]}
      {...rest}
    />
  );
}
