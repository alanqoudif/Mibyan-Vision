import { useLocalSearchParams } from 'expo-router';
import { Image, View } from 'react-native';

import { Text } from '@/components/text';
import { Badge, Card, Divider, EmptyState, Group, Row, Screen, ScreenHeader } from '@/components/ui';
import { Radius, Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useMemory } from '@/lib/memory';
import { useRuns } from '@/lib/runlog';
import { listRecords } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import { useAsync } from '@/lib/use-async';

export default function ActivityDetail() {
  const { kind, id } = useLocalSearchParams<{ kind: string; id: string }>();
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const runs = useRuns();
  const memory = useMemory();
  const rec = useAsync(() => (kind === 'record' ? listRecords({ limit: 200 }) : Promise.resolve([])), [kind]);
  const fmt = (t: number | string) => new Date(t).toLocaleString(lang === 'ar' ? 'ar' : 'en');
  const srcName = (x?: string) => (x === 'meta_glasses' ? s.lvSourceGlasses : x ? s.lvSourcePhone : '—');

  const run = kind === 'run' ? runs.find((r) => r.id === id) : undefined;
  const record = kind === 'record' ? rec.data?.find((r) => r.id === id) : undefined;
  const mem = kind === 'memory' ? memory.find((m) => m.id === id) : undefined;

  return (
    <Screen header={<ScreenHeader back title={s.actDetail} />}>
      {run ? (
        <>
          <Text variant="title">{run.name}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Badge tone={run.status === 'succeeded' ? 'success' : 'warning'} label={s.actRunStatus[run.status === 'succeeded' ? 'ok' : run.status === 'failed' ? 'failed' : 'blocked']} />
            {run.flagged ? <Badge tone="warning" label={s.lvFlagged} /> : null}
          </View>
          <Group>
            <Row title={s.actTime} subtitle={fmt(run.at)} icon="clock" />
            <Divider />
            <Row title={s.actSource} subtitle={srcName(run.source)} icon="camera" />
            <Divider />
            <Row title={s.actSense} subtitle={run.name} icon="sparkles" />
          </Group>
          {run.summary ? <Card><Text variant="label" tone="tertiary">{s.actResult.toUpperCase()}</Text><Text variant="spoken" selectable>{run.summary}</Text></Card> : null}
          <Group title={s.lvSteps}>
            {run.steps.map((st, i) => (
              <View key={i}>
                {i > 0 && <Divider />}
                <Row title={s.nodeKind[st.kind] ?? st.kind} subtitle={st.error} trailing={<Badge tone={st.status === 'ok' ? 'success' : st.status === 'skipped' ? 'neutral' : 'danger'} label={s.stepStatus[st.status] ?? st.status} />} />
              </View>
            ))}
          </Group>
        </>
      ) : record ? (
        <>
          <Text variant="title">{s.actRecordType[record.type] ?? record.type}</Text>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            {record.flagged ? <Badge tone="warning" label={s.lvFlagged} /> : null}
            <Badge tone={record.consented ? 'success' : 'neutral'} label={record.consented ? s.shShare : '—'} />
          </View>
          <Group>
            <Row title={s.actTime} subtitle={fmt(record.created_at)} icon="clock" />
            <Divider />
            <Row title={s.actSource} subtitle={s.actSourceLabel[record.source]} icon="camera" />
            {record.sense_id ? <><Divider /><Row title={s.actSense} subtitle={record.sense_id} icon="sparkles" /></> : null}
          </Group>
          <Card><Text variant="label" tone="tertiary">{s.actResult.toUpperCase()}</Text><Text variant="spoken" selectable>{record.text}</Text></Card>
        </>
      ) : mem ? (
        <>
          <Text variant="title">{mem.label}</Text>
          <Group>
            <Row title={s.actTime} subtitle={fmt(mem.at)} icon="clock" />
            <Divider />
            <Row title={s.actSource} subtitle={mem.kind === 'remember' ? s.memSourceRemember : s.memSourceSeen} icon="brain.head.profile" />
          </Group>
          <Card><Text variant="spoken" selectable>{mem.note}</Text></Card>
          {mem.photo ? <Image source={{ uri: mem.photo }} style={{ height: 240, borderRadius: Radius.lg, backgroundColor: c.surface }} accessibilityIgnoresInvertColors /> : null}
        </>
      ) : (
        <EmptyState icon="questionmark.circle" title={s.emptyTitle} />
      )}
    </Screen>
  );
}
