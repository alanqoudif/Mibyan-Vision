import { useState } from 'react';
import { Alert, Image, View } from 'react-native';

import { Text } from '@/components/text';
import { Banner, Button, Card, EmptyState, IconButton, Screen, ScreenHeader, SearchField } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { ago, forget, forgetAll, useMemory } from '@/lib/memory';
import { useS } from '@/lib/strings';

/** Opt-in memory, on this phone only. Searchable, deletable, and honest about what it keeps. */
export default function MemoryScreen() {
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const items = useMemory();
  const [q, setQ] = useState('');
  const shown = items.filter((m) => !q.trim() || `${m.label} ${m.note}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Screen header={<ScreenHeader back title={s.memTitle} />}>
      <Banner tone="accent" icon="lock.shield.fill" message={s.memIntro} />
      <SearchField value={q} onChange={setQ} placeholder={s.memSearch} />
      {shown.length === 0 ? (
        <EmptyState icon="brain.head.profile" title={s.memEmpty} body={s.memEmptyBody} />
      ) : (
        shown.map((m) => (
          <Card key={m.id} style={{ gap: Spacing.two }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{m.label}</Text>
                <Text variant="label" tone="tertiary">{m.kind === 'remember' ? s.memSourceRemember : s.memSourceSeen} · {ago(m.at, lang)}</Text>
              </View>
              <IconButton icon="trash" label={s.memForget(m.label)} tint={c.stopText} onPress={() => forget(m.id)} />
            </View>
            <Text tone="secondary">{m.note}</Text>
            {m.photo ? <Image source={{ uri: m.photo }} style={{ height: 160, borderRadius: Radius.md, backgroundColor: c.surface }} accessibilityIgnoresInvertColors /> : null}
          </Card>
        ))
      )}
      <Text variant="caption" tone="tertiary">{s.memRetention}: {s.memRetentionNote}</Text>
      <Text variant="caption" tone="tertiary">{s.memExport}</Text>
      {items.length ? (
        <Button variant="danger" icon="trash" label={s.memClear} onPress={() => Alert.alert(s.memClear, s.memClearConfirm, [{ text: s.cancel, style: 'cancel' }, { text: s.delete, style: 'destructive', onPress: forgetAll }])} />
      ) : null}
    </Screen>
  );
}
