import { useFocusEffect, useRouter } from 'expo-router';
import * as Voice from '@/lib/voice';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircleButton } from '@/components/chrome';
import { Text } from '@/components/text';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { fetchHistory, type HistoryRow } from '@/lib/assist';
import { useI18n, voiceFor } from '@/lib/i18n';
import { getMode, modeText } from '@/lib/modes';
import { SPEECH_RATE, useSettings } from '@/lib/settings';

function timeAgo(iso: string, t: ReturnType<typeof useI18n>['t']) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return t.minutesAgo(mins);
  const h = Math.round(mins / 60);
  if (h < 24) return t.hoursAgo(h);
  const d = Math.round(h / 24);
  return d === 1 ? t.yesterday : t.daysAgo(d);
}

/** Past answers, opened from the Assistant tab; tapping one reads it out again. */
export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useColors();
  const { settings } = useSettings();
  const { t, lang, dir } = useI18n();
  const [items, setItems] = useState<HistoryRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchHistory());
      setFailed(false);
    } catch {
      setFailed(true);
      setItems((v) => v ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <FlatList
      style={[styles.root, { backgroundColor: c.background, direction: dir }]}
      data={items ?? []}
      keyExtractor={(i) => i.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.four },
      ]}
      ListHeaderComponent={
        <View style={styles.header}>
          <CircleButton icon="xmark" label={t.close} onPress={() => router.back()} />
          <Text variant="display" accessibilityRole="header">
            {t.historyTitle}
          </Text>
          <Text tone="secondary">{t.historySubtitle}</Text>
        </View>
      }
      ListEmptyComponent={
        items === null ? (
          <ActivityIndicator style={{ marginTop: Spacing.six }} />
        ) : (
          <View style={styles.empty}>
            <SymbolView name={failed ? 'wifi.slash' : 'sparkles'} size={36} tintColor={c.textTertiary} />
            <Text tone="secondary" center>
              {failed ? t.historyFailed : t.historyEmpty}
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => {
        const mode = getMode(item.mode);
        const title = modeText(mode, lang).title;
        const when = timeAgo(item.created_at, t);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${when}. ${item.question ?? ''}. ${item.answer}`}
            accessibilityHint={t.replayHint}
            onPress={() => {
              Voice.stop();
              Voice.speak(item.answer, { language: voiceFor(item.answer), rate: SPEECH_RATE[settings.speed] });
            }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface }]}>
            <LinearGradient colors={mode.tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
              <SymbolView name={mode.icon} size={22} tintColor="#FFFFFF" weight="semibold" />
            </LinearGradient>
            <View style={{ flex: 1, gap: Spacing.half }}>
              <View style={styles.meta}>
                <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
                  {item.question || title}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {when}
                </Text>
              </View>
              <Text tone="secondary" numberOfLines={2}>
                {item.answer}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.two, gap: Spacing.one },
  header: { gap: Spacing.two, marginBottom: Spacing.three, paddingHorizontal: Spacing.two },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderRadius: Radius.md,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  empty: {
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.five,
  },
});
