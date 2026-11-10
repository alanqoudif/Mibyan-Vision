import { runWorkflow, type DeviceKind, type Permission, type RunResult } from '@mibyan/shared/sense';

import type { Lang } from '@/lib/i18n';
import { addRun } from '@/lib/runlog';
import { confirmWithUser, createPhoneAdapters } from '@/lib/sense-adapters';
import { senseName } from '@/lib/sixth';
import type { InstalledSense } from '@/lib/vision';

/**
 * Runs one installed Sense with exactly the permissions the person granted at install time,
 * logs the run on this phone, and never reports success when a step failed.
 */
export async function runInstalled(
  item: InstalledSense,
  ctx: { lang: Lang; phoneCapture?: () => Promise<string | undefined>; speakResult?: boolean },
): Promise<{ result: RunResult; source?: DeviceKind; text?: string; flagged: boolean }> {
  const m = item.manifest;
  let source: DeviceKind | undefined;
  const adapters = createPhoneAdapters({ lang: ctx.lang, phoneCapture: ctx.phoneCapture, senseId: m.id, onSource: (s) => (source = s) });
  if (ctx.speakResult === false) adapters.speak = async () => {};
  let result: RunResult;
  try {
    result = await runWorkflow(m, {
      granted: item.granted as Permission[],
      adapters,
      settings: item.settings,
      approve: (_id, kind) => confirmWithUser(kind, kind, ctx.lang),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    result = { status: 'failed', steps: [{ nodeId: '-', kind: 'trigger.manual', status: 'failed', startedAt: Date.now(), ms: 0, error: message }], outputs: {}, aiCalls: 0 };
  }
  const text = pickText(result);
  const failed = result.steps.find((s) => s.status === 'failed' || s.status === 'blocked');
  const flagged = result.steps.some((s) => s.nodeId === 'record' && s.status === 'ok') || result.steps.some((s) => s.nodeId === 'alert' && s.status === 'ok');
  addRun({
    senseId: m.id,
    name: senseName(m, ctx.lang),
    status: result.status,
    source,
    summary: failed?.error ?? text ?? '',
    flagged,
    steps: result.steps.map((s) => ({ nodeId: s.nodeId, kind: s.kind, status: s.status, error: s.error })),
  });
  return { result, source, text, flagged };
}

/** The most useful text a run produced (description, reading or answer). */
function pickText(r: RunResult): string | undefined {
  for (const id of ['look', 'text', 'answer']) {
    const o = r.outputs[id] as { text?: string } | undefined;
    if (o?.text) return o.text;
  }
  for (const o of Object.values(r.outputs)) {
    const t = (o as { text?: string } | undefined)?.text;
    if (typeof t === 'string' && t) return t;
  }
  return undefined;
}
