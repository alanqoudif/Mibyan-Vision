import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { MinTouch, Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';

/** Round header button with a soft shadow. Visual 48pt plus hitSlop, so the target is ≥ 56pt. */
export function CircleButton({
  icon,
  label,
  size = 48,
  variant = 'floating',
  style,
  ...rest
}: PressableProps & {
  icon: SFSymbol;
  label: string;
  size?: number;
  variant?: 'floating' | 'filled' | 'solid';
  style?: ViewStyle;
}) {
  const c = useColors();
  const bg = { floating: c.card, filled: c.surface, solid: c.text }[variant];
  const fg = variant === 'solid' ? c.background : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPressIn={() => Haptics.selectionAsync()}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        },
        variant === 'floating' && [styles.shadow, { shadowColor: c.shadow }],
        style,
      ]}
      {...rest}>
      <SymbolView name={icon} size={size * 0.42} tintColor={fg} weight="medium" />
    </Pressable>
  );
}

/** Small inline icon action (call, remove) in a list row, with the full 56pt target. */
export function IconAction({
  icon,
  label,
  color,
  size = 22,
  onPress,
}: {
  icon: SFSymbol;
  label: string;
  color: string;
  size?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, { opacity: pressed ? 0.5 : 1 }]}>
      <SymbolView name={icon} size={size} tintColor={color} />
    </Pressable>
  );
}

/** Connection status only: the Wearables SDK doesn't report the glasses' battery level. */
export function GlassesPill({ connected }: { connected: boolean }) {
  const c = useColors();
  const { t } = useI18n();
  return (
    <View
      accessible
      accessibilityLabel={connected ? t.glassesConnected : t.glassesDisconnected}
      style={[styles.pill, styles.shadow, { backgroundColor: c.card, shadowColor: c.shadow }]}>
      <SymbolView name="eyeglasses" size={22} tintColor={c.text} weight="semibold" />
      <Text variant="caption" tone={connected ? 'primary' : 'secondary'}>
        {connected ? t.connected : t.notConnected}
      </Text>
      {connected && <View style={[styles.dot, { backgroundColor: c.success }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  iconAction: { width: MinTouch, height: MinTouch, alignItems: 'center', justifyContent: 'center' },
});
