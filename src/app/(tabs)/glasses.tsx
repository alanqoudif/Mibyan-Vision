import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Section, Segmented, rows } from '@/components/settings-rows';
import { Text } from '@/components/text';
import { BottomTabInset, OrbColors, Radius, Spacing, useColors } from '@/constants/theme';
import { useGlasses, type GlassesStatus } from '@/lib/glasses';
import { useI18n } from '@/lib/i18n';
import { useSettings, type Settings } from '@/lib/settings';

const DOT: Record<GlassesStatus, string> = {
  unsupported: '#FF9F0A',
  unregistered: '#FF9F0A',
  registering: '#FF9F0A',
  needsCamera: '#FF9F0A',
  ready: '#34C759',
};

export default function GlassesScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings, update } = useSettings();
  const { t, dir } = useI18n();
  const router = useRouter();
  const glasses = useGlasses();
  const status = t.glassesStatus[glasses.status];

  const intervals = ([3, 5, 10] as const).map((n) => ({ id: String(n) as '3' | '5' | '10', label: t.seconds(n) }));

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: c.surface, direction: dir }]}
      onMagicTap={() => router.push({ pathname: '/session', params: { mode: 'ask' } })}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
      ]}>
      <Text variant="display" accessibilityRole="header">
        {t.devices}
      </Text>

      {/* Device hero, modelled after Meta AI's Devices card */}
      <View
        style={[styles.device, { backgroundColor: c.card, shadowColor: c.shadow }]}
        accessible
        accessibilityLabel={`${t.rayban}, ${t.firstGen}. ${status.badge}. ${status.note}`}>
        <View style={styles.deviceHead}>
          <View style={{ gap: Spacing.half }}>
            <Text variant="title">Ray-Ban Meta</Text>
            <Text variant="caption" tone="secondary">
              {t.firstGen}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.surface }]}>
            <View style={[styles.dot, { backgroundColor: DOT[glasses.status] }]} />
            <Text variant="caption">{status.badge}</Text>
          </View>
        </View>
        <LinearGradient
          colors={[`${OrbColors[0]}18`, `${OrbColors[2]}22`, `${OrbColors[1]}18`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <SymbolView name="eyeglasses" size={120} tintColor={c.text} weight="light" />
        </LinearGradient>
        <View style={[styles.note, { backgroundColor: c.surface }]}>
          <SymbolView
            name={glasses.status === 'ready' ? 'eyeglasses' : 'iphone.rear.camera'}
            size={22}
            tintColor={c.accent}
          />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {glasses.error ?? status.note}
          </Text>
        </View>
        {status.action && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={status.action}
            accessibilityHint={t.opensMetaAI}
            accessibilityState={{ busy: glasses.busy }}
            disabled={glasses.busy}
            onPress={glasses.connect}
            style={({ pressed }) => [
              styles.connect,
              { backgroundColor: c.accent, opacity: pressed || glasses.busy ? 0.6 : 1 },
            ]}>
            <Text variant="heading" center style={{ color: c.onAccent }}>
              {status.action}
            </Text>
          </Pressable>
        )}
      </View>

      <Section title={t.sectionLive}>
        <View style={rows.pad}>
          <Text variant="heading">{t.liveEvery}</Text>
          <Segmented
            options={intervals}
            value={String(settings.liveEvery) as '3' | '5' | '10'}
            onChange={(v) => update({ liveEvery: Number(v) as Settings['liveEvery'] })}
          />
          <Text variant="caption" tone="secondary">
            {t.liveHint}
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.four },
  device: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  deviceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    height: 32,
    borderRadius: Radius.full,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hero: { height: 170, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.sm,
  },
  connect: { minHeight: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
});
