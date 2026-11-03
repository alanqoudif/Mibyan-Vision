import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { MODES, modeText, type ModeId } from '@/lib/modes';
import { useSettings } from '@/lib/settings';

/** Every tool by name, for when the user would rather pick than say it. */
export default function ToolsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t, lang, dir } = useI18n();
  const { settings } = useSettings();

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
        <Tool icon="puzzlepiece.extension" label={t.manageTools} onPress={() => router.push('/plugins')} />
        {MODES.filter((m) => m.id !== 'ask' && settings.enabledTools.includes(m.id)).map((m) => (
          <Tool key={m.id} icon={m.icon} label={modeText(m, lang).title} onPress={() => open(m.id)} />
        ))}
        {settings.enabledTools.includes('where') && <Tool icon="location.north.circle" label={t.qiblaTitle} onPress={() => router.replace('/qibla')} />}
      </ScrollView>
    </View>
  );
}

function Tool({
  icon,
  label,
  onPress,
}: {
  icon: SFSymbol;
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
      <View style={[styles.thumb, { backgroundColor: c.card }]}>
        <SymbolView name={icon} size={24} tintColor={c.text} weight="medium" />
      </View>
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
