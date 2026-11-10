import { useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';

import { Text } from '@/components/text';
import { Badge, Banner, Button, Card, EmptyState, Group, IconBadge, Row, Screen, ScreenHeader, SectionHeader, Toggle, timeAgo, useToast, Divider } from '@/components/ui';
import { Spacing, useColors } from '@/constants/theme';
import { useI18n } from '@/lib/i18n';
import { useRuns } from '@/lib/runlog';
import { STUDIO_URL, senseName, setEnabled, useCatalog, useInstalledSenses } from '@/lib/sixth';
import { useS } from '@/lib/strings';
import type { SFSymbol } from 'expo-symbols';
import type { NodeKind, Workflow, WorkflowNode } from '@mibyan/shared/sense';

const ICON: Record<NodeKind, SFSymbol> = {
  'trigger.manual': 'hand.tap.fill',
  'capture.image': 'camera.fill',
  'ai.vision.describe': 'eye.fill',
  'ai.vision.ocr': 'text.viewfinder',
  'ai.ask': 'bubble.left.and.text.bubble.right.fill',
  'logic.condition': 'arrow.triangle.branch',
  'action.speak': 'speaker.wave.2.fill',
  'action.notify': 'bell.fill',
  'action.save_record': 'tray.and.arrow.down.fill',
  'action.create_task': 'checklist',
  'data.memory_search': 'brain.head.profile',
};

/** Nodes in execution order (a stable topological sort starting at the trigger). */
function ordered(wf: Workflow): WorkflowNode[] {
  const out: WorkflowNode[] = [];
  const seen = new Set<string>();
  const start = wf.nodes.find((n) => n.kind.startsWith('trigger.'));
  const queue = start ? [start.id] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const n = wf.nodes.find((x) => x.id === id);
    if (n) out.push(n);
    wf.edges.filter((e) => e.from === id).forEach((e) => queue.push(e.to));
  }
  return out;
}

/** A readable mobile view of a workflow: steps in order with their connections. Editing stays in Vision Studio. */
export default function WorkflowDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useS();
  const c = useColors();
  const { lang } = useI18n();
  const toast = useToast();
  const installed = useInstalledSenses();
  const catalog = useCatalog();
  const runs = useRuns();
  const item = installed.items.find((i) => i.manifest.id === id);
  const m = item?.manifest ?? catalog.items.find((x) => x.id === id);
  if (!m) return <Screen header={<ScreenHeader back />}><EmptyState icon="questionmark.circle" title={s.emptyTitle} /></Screen>;

  const steps = ordered(m.workflow);
  const label = (nid: string) => s.nodeKind[m.workflow.nodes.find((n) => n.id === nid)?.kind ?? ''] ?? nid;
  const last = runs.find((r) => r.senseId === m.id);
  const settingsEntries = Object.entries(item?.settings ?? {});
  const studio = STUDIO_URL ? `${STUDIO_URL.replace(/\/$/, '')}/studio/senses` : '';

  const param = (n: WorkflowNode) => {
    const p = n.params ?? {};
    const v = (p.prompt ?? p.text ?? p.query ?? p.title ?? p.observation) as string | undefined;
    return typeof v === 'string' && v ? v : undefined;
  };

  return (
    <Screen header={<ScreenHeader back title={s.wfTitle} />}>
      <Text variant="title" accessibilityRole="header">{senseName(m, lang)}</Text>
      <Group>
        <Row title={s.wfStatus} icon="power" trailing={item ? <Toggle value={item.enabled} label={senseName(m, lang)} onChange={(v) => setEnabled(m.id, v).catch((e) => toast(String(e instanceof Error ? e.message : e), 'error'))} /> : <Badge label={s.off} />} />
        <Divider />
        <Row title={s.wfTrigger} icon="bolt.fill" subtitle={m.triggers.join(' · ')} />
        <Divider />
        <Row title={s.wfRecent} icon="clock" subtitle={last ? `${timeAgo(last.at, lang)} · ${s.actRunStatus[last.status === 'succeeded' ? 'ok' : last.status === 'failed' ? 'failed' : 'blocked']}` : s.wfNever} />
      </Group>

      <View style={{ gap: Spacing.two }}>
        <SectionHeader title={s.wfSteps} />
        {steps.map((n, i) => {
          const out = m.workflow.edges.filter((e) => e.from === n.id);
          return (
            <View key={n.id}>
              <Card style={{ gap: Spacing.two }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
                  <IconBadge icon={ICON[n.kind] ?? 'circle'} hue={n.kind.startsWith('trigger') ? c.success : n.kind.startsWith('ai') ? c.glow : n.kind.startsWith('logic') ? c.warning : c.cyan} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{i + 1}. {s.nodeKind[n.kind] ?? n.kind}</Text>
                    {param(n) ? <Text variant="caption" tone="secondary" numberOfLines={3}>{param(n)}</Text> : null}
                  </View>
                </View>
                {out.length > 0 && (
                  <View style={{ gap: 2 }}>
                    {out.map((e, k) => (
                      <Text key={k} variant="label" tone="accent">
                        {e.when ? `${e.when === 'true' ? s.wfBranchTrue : s.wfBranchFalse} → ` : '→ '}{label(e.to)}
                      </Text>
                    ))}
                  </View>
                )}
              </Card>
            </View>
          );
        })}
      </View>

      {settingsEntries.length ? (
        <Group title={s.wfSettingsTitle}>
          {settingsEntries.map(([k, v], i) => (
            <View key={k}>{i > 0 && <Divider />}<Row title={k} subtitle={String(v)} /></View>
          ))}
        </Group>
      ) : null}

      <Banner tone="accent" icon="macwindow" message={`${s.wfEditNote} ${STUDIO_URL ? '' : '(EXPO_PUBLIC_STUDIO_URL)'}`} />
      <Button variant="secondary" icon="arrow.up.right.square" label={s.continueInStudio} disabled={!studio} onPress={() => studio && void Linking.openURL(studio)} />
    </Screen>
  );
}
