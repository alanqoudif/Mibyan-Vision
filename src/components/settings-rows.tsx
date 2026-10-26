import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';

/** Grouped settings building blocks shared by the Assistant and Glasses tabs. */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ gap: Spacing.two }}>
      <Text variant="caption" tone="secondary" accessibilityRole="header" style={{ paddingHorizontal: Spacing.one }}>
        {title}
      </Text>
      <View style={[rows.card, { backgroundColor: c.card }]}>{children}</View>
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        marginHorizontal: Spacing.three,
      }}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[rows.segment, { backgroundColor: c.surface }]} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.id)}
            style={[
              rows.segmentItem,
              selected && [rows.segmentSelected, { backgroundColor: c.card, shadowColor: c.shadow }],
            ]}>
            <Text variant="heading" center tone={selected ? 'primary' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  icon: SFSymbol;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={rows.row}>
      <SymbolView name={icon} size={22} tintColor={c.text} />
      <View style={{ flex: 1 }}>
        <Text variant="heading">{label}</Text>
        {!!hint && (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        )}
      </View>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: c.accent }} />
    </View>
  );
}

export const rows = StyleSheet.create({
  card: { borderRadius: Radius.md, overflow: 'hidden' },
  pad: { padding: Spacing.three, gap: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    minHeight: 64,
    paddingVertical: Spacing.two,
  },
  segment: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: Radius.sm,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.sm - 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
