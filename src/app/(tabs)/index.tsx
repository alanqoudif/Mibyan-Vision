import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton, GlassesPill } from '@/components/chrome';
import { Composer } from '@/components/composer';
import { OrbMark } from '@/components/orb';
import { Text } from '@/components/text';
import { BottomTabInset, OrbColors, Radius, Spacing, useColors } from '@/constants/theme';
import { useGlasses } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { SUGGESTIONS, modeText, type Mode, type ModeId } from '@/lib/modes';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { t, dir } = useI18n();
  const glasses = useGlasses();

  const h = new Date().getHours();
  const greeting = h < 12 ? t.greetMorning : h < 18 ? t.greetAfternoon : t.greetEvening;

  const open = (mode: ModeId, q?: string) =>
    mode === 'find'
      ? router.push('/find')
      : router.push({ pathname: '/session', params: q ? { mode, q } : { mode } });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.background, direction: dir }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.two }]}>
        <GlassesPill connected={glasses.status === 'ready'} />
        <CircleButton icon="plus.bubble" label={t.newChat} onPress={() => open('ask')} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardDismissMode="on-drag">
        <Text variant="display" accessibilityRole="header" style={styles.headline}>
          {greeting}
        </Text>

        <LiveCard onPress={() => router.push('/live')} />
        <HelperCard onPress={() => router.push('/helper')} />

        <View style={styles.list}>
          {SUGGESTIONS.map((m) => (
            <Suggestion key={m.id} mode={m} onPress={() => open(m.id)} />
          ))}
        </View>
      </ScrollView>

      <Composer
        bottomInset={insets.bottom + BottomTabInset}
        onSubmit={(text) => open('ask', text)}
        onVoice={() => open('ask')}
      />
    </KeyboardAvoidingView>
  );
}

function LiveCard({ onPress }: { onPress: () => void }) {
  const c = useColors();
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.liveTitle}
      accessibilityHint={t.liveSubtitle}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <LinearGradient
        colors={[`${OrbColors[0]}1F`, `${OrbColors[2]}26`, `${OrbColors[1]}1F`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.live, { borderColor: c.border }]}>
        <OrbMark size={44} />
        <View style={{ flex: 1, gap: Spacing.half }}>
          <Text variant="heading">{t.liveTitle}</Text>
          <Text variant="caption" tone="secondary">
            {t.liveSubtitle}
          </Text>
        </View>
        <View style={[styles.liveGo, { backgroundColor: c.text }]}>
          <SymbolView name="play.fill" size={16} tintColor={c.background} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function HelperCard({ onPress }: { onPress: () => void }) {
  const c = useColors();
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.helperCardTitle}
      accessibilityHint={t.helperCardSubtitle}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.live, { borderColor: c.border, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.helperIcon, { backgroundColor: c.surface }]}>
        <SymbolView name="person.wave.2.fill" size={24} tintColor={c.text} />
      </View>
      <View style={{ flex: 1, gap: Spacing.half }}>
        <Text variant="heading">{t.helperCardTitle}</Text>
        <Text variant="caption" tone="secondary">
          {t.helperCardSubtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function Suggestion({ mode, onPress }: { mode: Mode; onPress: () => void }) {
  const c = useColors();
  const { lang } = useI18n();
  const { prompt } = modeText(mode, lang);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={prompt}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: c.surface }]}>
      <LinearGradient colors={mode.tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
        <SymbolView name={mode.icon} size={24} tintColor="#FFFFFF" weight="semibold" />
      </LinearGradient>
      <Text variant="body" style={{ flex: 1 }}>
        {prompt}
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
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.four, gap: Spacing.four },
  headline: { marginBottom: Spacing.one },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  helperIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  liveGo: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  list: { gap: Spacing.one, marginHorizontal: -Spacing.two, marginTop: -Spacing.two },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 64,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});
