import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/text';
import { Banner, Chip, EmptyState, Group, LargeTitle, Row, Screen, SkeletonList, TimelineItem, timeAgo, Divider } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { ago, useMemory } from '@/lib/memory';
import { useRuns } from '@/lib/runlog';
import { isMissingTable, isOfflineError, listRecords } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useAsync } from '@/lib/use-async';
import { useVisionSession } from '@/lib/vision';

type Filter = 'all' | 'runs' | 'records' | 'alerts' | 'memory';
type Item = { key: string; kind: 'run' | 'record' | 'memory'; id: string; at: number; title: string; subtitle: string; icon: string; hue: string; alert: boolean };

export default function ActivityTab() {
  const s = useS();
  const c = useColors();
  const router = useRouter();
  const { lang } = useI18n();
  const session = useVisionSession();
  const runs = useRuns();
  const memory = useMemory();
  const [filter, setFilter] = useState<Filter>('all');
  const records = useAsync(() => (session.email ? listRecords({ limit: 60 }) : Promise.resolve([])), [session.email]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const r of runs) {
      out.push({ key: r.id, kind: 'run', id: r.id, at: r.at, title: r.name, subtitle: r.summary || s.actRunStatus[r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'failed' : 'blocked'], icon: r.status === 'succeeded' ? 'checkmark.circle.fill' : 'exclamationmark.triangle.fill', hue: r.status === 'succeeded' ? c.success : c.warning, alert: !!r.flagged || r.status !== 'succeeded' });
    }
    for (const r of records.data ?? []) {
      out.push({ key: r.id, kind: 'record', id: r.id, at: Date.parse(r.created_at), title: s.actRecordType[r.type] ?? r.type, subtitle: r.text, icon: r.flagged || r.type === 'issue' ? 'flag.fill' : 'doc.text.fill', hue: r.flagged || r.type === 'issue' ? c.warning : c.cyan, alert: r.flagged || r.type === 'issue' });
    }
    for (const m of memory) {
      out.push({ key: m.id, kind: 'memory', id: m.id, at: m.at, title: m.label, subtitle: m.note, icon: 'brain.head.profile', hue: c.sand, alert: false });
    }
    return out.sort((a, b) => b.at - a.at);
  }, [runs, records.data, memory, s, c]);

  const shown = items.filter((i) => filter === 'all' || (filter === 'runs' && i.kind === 'run') || (filter === 'records' && i.kind === 'record') || (filter === 'memory' && i.kind === 'memory') || (filter === 'alerts' && i.alert));
  const filters: [Filter, string][] = [['all', s.actAll], ['runs', s.actRuns], ['records', s.actRecords], ['alerts', s.actAlerts], ['memory', s.actMemory]];

  return (
    <Screen tabs onRefresh={records.refresh} refreshing={records.loading}>
      <LargeTitle>{s.actTitle}</LargeTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        {filters.map(([k, label]) => <Chip key={k} label={label} selected={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>

      <Group>
        <Row icon="person.badge.clock.fill" hue={c.cyan} title={s.shTitle} chevron onPress={() => router.push('/shift')} />
        <Divider />
        <Row icon="brain.head.profile" hue={c.sand} title={s.memTitle} chevron onPress={() => router.push('/memory')} />
        <Divider />
        <Row icon="point.3.connected.trianglepath.dotted" hue={c.glow} title={s.wfList} chevron onPress={() => router.push('/workflows')} />
      </Group>

      {records.error ? (
        <Banner tone={isMissingTable(records.error) ? 'warning' : 'danger'} icon={isOfflineError(records.error) ? 'wifi.slash' : 'exclamationmark.triangle.fill'} message={isOfflineError(records.error) ? s.offlineBanner : isMissingTable(records.error) ? s.shSchemaMissing : records.error} />
      ) : null}

      {records.loading && !items.length ? (
        <SkeletonList count={4} height={64} />
      ) : shown.length ? (
        <View>
          {shown.map((i, n) => (
            <TimelineItem
              key={i.key}
              icon={i.icon as never}
              hue={i.hue}
              title={i.title}
              subtitle={i.subtitle}
              time={i.kind === 'memory' ? ago(i.at, lang) : timeAgo(i.at, lang)}
              last={n === shown.length - 1}
              onPress={() => router.push({ pathname: '/activity-detail', params: { kind: i.kind, id: i.id } })}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="clock" title={s.actEmpty} body={s.actEmptyBody} />
      )}
      <Text variant="label" tone="tertiary" center>{session.email ? s.actAccount : s.actThisDevice}</Text>
    </Screen>
  );
}
