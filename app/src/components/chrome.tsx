import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, TextInput, View, type PressableProps, type TextInputProps, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { MaxFontScale, MinTouch, Radius, Spacing, Type, useColors } from '@/constants/theme';
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerEnd: { minWidth: 48, alignItems: 'flex-end' },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 60,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.full,
  },
  field: {
    ...Type.body,
    minHeight: MinTouch,
    minWidth: 0,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  fieldMultiline: { minHeight: 120, textAlignVertical: 'top' },
});

/**
 * Header shared by every modal screen: close (or back) at the start, the title as the screen's
 * header in the middle, and an optional trailing control (or an equal spacer) at the end.
 */
export function ScreenHeader({
  title,
  closeLabel,
  onClose,
  icon = 'xmark',
  trailing,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  icon?: SFSymbol;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <CircleButton icon={icon} label={closeLabel} onPress={onClose} />
      <Text variant="heading" center accessibilityRole="header" numberOfLines={2} style={{ flex: 1 }}>
        {title}
      </Text>
      <View style={styles.headerEnd}>{trailing}</View>
    </View>
  );
}

/**
 * The one button shape: a 56pt pill. `primary` is ink (the main action on a screen), `secondary`
 * a grey well, `destructive` the stop well. Labels use heading type and never shrink.
 */
export function PillButton({
  label,
  icon,
  variant = 'primary',
  busy,
  disabled,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  icon?: SFSymbol;
  variant?: 'primary' | 'secondary' | 'destructive';
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}) {
  const c = useColors();
  const bg = { primary: c.text, secondary: c.surface, destructive: c.stop }[variant];
  const fg = { primary: c.background, secondary: c.text, destructive: c.stopText }[variant];
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      disabled={off}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.pillButton, { backgroundColor: bg, opacity: off ? 0.45 : pressed ? 0.75 : 1 }, style]}>
      {!!icon && <SymbolView name={icon} size={20} tintColor={fg} weight="semibold" />}
      <Text variant="heading" center style={{ color: fg, flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Text field with a visible label above it (placeholders vanish while typing; labels don't). */
export function Field({
  label,
  containerStyle,
  multiline,
  ...rest
}: Omit<TextInputProps, 'style'> & { label: string; containerStyle?: ViewStyle }) {
  const c = useColors();
  const { dir } = useI18n();
  return (
    <View style={[{ gap: Spacing.one }, containerStyle]}>
      <Text variant="caption" tone="secondary" importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textTertiary}
        maxFontSizeMultiplier={MaxFontScale}
        multiline={multiline}
        style={[
          styles.field,
          multiline && styles.fieldMultiline,
          { backgroundColor: c.field, color: c.text, textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir },
        ]}
        {...rest}
      />
    </View>
  );
}
