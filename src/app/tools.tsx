import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { MODES, modeText, type Mode, type ModeId } from '@/lib/modes';

const QIBLA_TINT = ['#0F7B5F', '#3BB98F'] as const;

/** Every tool by name, for when the user would rather pick than say it. */
export default function ToolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t, lang, dir } = useI18n();

  const open = (mode: ModeId) =>
    router.replace(mode === 'find' ? '/find' : mode === 'live' ? '/live' : { pathname: '/session', params: { mode } });

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.background,
          direction: dir,
          paddingTop: insets.top + Spacing.two,
        },
      ]}>
      <View style={styles.topBar}>
        <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
        <Text variant="heading" accessibilityRole="header">
          {t.toolsTitle}
        </Text>
        <View style={{ width: 48 }} />
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + Spacing.four }]}>
        {MODES.filter((m) => m.id !== 'ask').map((m) => (
          <Tool key={m.id} icon={m.icon} tint={m.tint} label={modeText(m, lang).title} onPress={() => open(m.id)} />
        ))}
        <Tool
          icon="location.north.circle.fill"
          tint={QIBLA_TINT}
          label={t.qiblaTitle}
          onPress={() => router.replace('/qibla')}
        />
      </ScrollView>
    </View>
  );
}

function Tool({
  icon,
  tint,
  label,
  onPress,
}: {
  icon: SFSymbol;
  tint: Mode['tint'];
  label: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.tool, pressed && { backgroundColor: c.surface }]}>
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
        <SymbolView name={icon} size={24} tintColor="#FFFFFF" weight="semibold" />
      </LinearGradient>
      <Text variant="heading" style={{ flex: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: { padding: Spacing.two, gap: Spacing.one },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
