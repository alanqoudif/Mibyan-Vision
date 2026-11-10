import { NODE_SPECS, type Adapters, type SenseManifest } from '@mibyan/shared/sense';

import type { Lang } from '@/lib/i18n';
import { createPhoneAdapters } from '@/lib/sense-adapters';

export type Compat = {
  /** True when every capability the workflow needs exists on this phone, and a supported device is available. */
  runnable: boolean;
  /** Adapter capabilities the workflow needs that this phone does not provide. */
  missing: string[];
  /** The workflow saves to the account, so a signed-in account is required. */
  needsAccount: boolean;
  /** At least one of the Sense's supported devices can be used right now. */
  deviceOk: boolean;
};

let probe: Adapters | null = null;

/**
 * Validates a Sense against what this phone can really do: the same adapter set the runtime
 * will use (a missing adapter fails a run with a CapabilityError, so we say so up front).
 */
export function checkCompat(m: SenseManifest, ctx: { glassesReady: boolean; signedIn: boolean; lang: Lang }): Compat {
  probe ??= createPhoneAdapters({ lang: ctx.lang });
  const need = new Set<string>();
  for (const n of m.workflow.nodes) {
    const a = NODE_SPECS[n.kind]?.adapter;
    if (a) need.add(a);
  }
  const missing = [...need].filter((a) => typeof (probe as Record<string, unknown>)[a] !== 'function');
  const needsAccount = need.has('saveRecord') || need.has('createTask');
  const deviceOk = m.supported_devices.includes('phone_camera') || (m.supported_devices.includes('meta_glasses') && ctx.glassesReady);
  return { runnable: missing.length === 0 && deviceOk && (!needsAccount || ctx.signedIn), missing, needsAccount, deviceOk };
}
