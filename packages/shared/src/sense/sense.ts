/**
 * Sixth Sense core: manifest, validation, and an executable workflow engine.
 * Pure TypeScript, no I/O of its own. Device / AI / storage access is injected through
 * `Adapters`, and anything an adapter does not provide fails with an explicit CapabilityError.
 */

export const PERMISSIONS = [
  'camera',
  'microphone',
  'speech_out',
  'location',
  'notifications',
  'store_read',
  'store_write',
  'memory_read',
  'memory_write',
  'tasks_write',
  'team_message',
  'network',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const DEVICE_KINDS = ['meta_glasses', 'phone_camera', 'uploaded_image', 'demo_session'] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];

export const SENSE_CATEGORIES = [
  'accessibility', 'productivity', 'industry', 'maintenance', 'safety', 'education',
  'translation', 'personal', 'developer', 'automation',
] as const;
export type SenseCategory = (typeof SENSE_CATEGORIES)[number];

export type SenseKind = 'builtin' | 'flow' | 'code' | 'template' | 'organization';

export type ResourceLimits = {
  maxSteps: number;
  maxAiCalls: number;
  nodeTimeoutMs: number;
  totalTimeoutMs: number;
};

export type SettingField = { key: string; type: 'boolean' | 'string' | 'number' | 'enum'; default?: unknown; options?: string[]; label_en: string; label_ar: string };

export type SenseManifest = {
  id: string;
  kind: SenseKind;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  icon: string;
  category: SenseCategory;
  version: string;
  author: string;
  supported_devices: DeviceKind[];
  triggers: ('manual' | 'voice' | 'schedule' | 'image_captured' | 'device_event')[];
  inputs: string[];
  outputs: string[];
  permissions: Permission[];
  settings_schema: SettingField[];
  workflow: Workflow;
  model_requirements: { vision?: boolean; reasoning?: boolean; ocr?: boolean; speech?: boolean };
  privacy_settings: { stores_media: boolean; retention_days: number; requires_consent: boolean };
  resource_limits: ResourceLimits;
};

// ---------- workflow ----------

export type NodeKind =
  | 'trigger.manual'
  | 'capture.image'
  | 'ai.vision.describe'
  | 'ai.vision.ocr'
  | 'ai.ask'
  | 'logic.condition'
  | 'action.speak'
  | 'action.notify'
  | 'action.save_record'
  | 'action.create_task'
  | 'data.memory_search';

export type WorkflowNode = { id: string; kind: NodeKind; params?: Record<string, unknown> };
export type WorkflowEdge = { from: string; to: string; when?: 'true' | 'false' };
export type Workflow = { nodes: WorkflowNode[]; edges: WorkflowEdge[] };

/** What each node needs: manifest permissions, adapter method, and whether a human must approve it. */
export const NODE_SPECS: Record<NodeKind, { permissions: Permission[]; adapter?: keyof Adapters; ai?: boolean; needsApproval?: boolean }> = {
  'trigger.manual': { permissions: [] },
  'capture.image': { permissions: ['camera'], adapter: 'capture' },
  'ai.vision.describe': { permissions: [], adapter: 'describe', ai: true },
  'ai.vision.ocr': { permissions: [], adapter: 'ocr', ai: true },
  'ai.ask': { permissions: [], adapter: 'ask', ai: true },
  'logic.condition': { permissions: [] },
  'action.speak': { permissions: ['speech_out'], adapter: 'speak' },
  'action.notify': { permissions: ['notifications'], adapter: 'notify' },
  'action.save_record': { permissions: ['store_write'], adapter: 'saveRecord' },
  'action.create_task': { permissions: ['tasks_write'], adapter: 'createTask', needsApproval: true },
  'data.memory_search': { permissions: ['memory_read'], adapter: 'searchMemory' },
};

export type Adapters = {
  capture?(): Promise<{ imageRef: string; source: DeviceKind }>;
  describe?(imageRef: string, prompt?: string): Promise<{ text: string; confidence?: number }>;
  ocr?(imageRef: string): Promise<{ text: string }>;
  ask?(prompt: string): Promise<{ text: string }>;
  speak?(text: string): Promise<void>;
  notify?(title: string, body: string): Promise<void>;
  saveRecord?(record: Record<string, unknown>): Promise<{ id: string }>;
  createTask?(title: string): Promise<{ id: string }>;
  searchMemory?(query: string): Promise<{ id: string; text: string }[]>;
};

export class CapabilityError extends Error {
  readonly capability: string;
  constructor(capability: string, detail?: string) {
    super(`Capability not available: ${capability}${detail ? ` (${detail})` : ''}`);
    this.capability = capability;
    this.name = 'CapabilityError';
  }
}
export class PermissionError extends Error {
  readonly permission: Permission;
  readonly nodeId: string;
  constructor(permission: Permission, nodeId: string) {
    super(`Node "${nodeId}" needs permission "${permission}" which the Sense does not declare or the user has not granted`);
    this.permission = permission;
    this.nodeId = nodeId;
    this.name = 'PermissionError';
  }
}

// ---------- validation ----------

export type ValidationIssue = { path: string; message: string };

const ID_RE = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export const DEFAULT_LIMITS: ResourceLimits = { maxSteps: 50, maxAiCalls: 10, nodeTimeoutMs: 15_000, totalTimeoutMs: 60_000 };

/** Adapter capabilities the workflow needs that the given adapters do not provide. */
export function missingCapabilities(wf: Workflow, adapters: Adapters): string[] {
  const out = new Set<string>();
  for (const n of wf.nodes) {
    const a = NODE_SPECS[n.kind]?.adapter;
    if (a && typeof adapters[a] !== 'function') out.add(a);
  }
  return [...out];
}

/** Permissions a workflow actually uses, derived from its nodes. */
export function requiredPermissions(wf: Workflow): Permission[] {
  const set = new Set<Permission>();
  for (const n of wf.nodes) for (const p of NODE_SPECS[n.kind]?.permissions ?? []) set.add(p);
  return [...set];
}

export function validateWorkflow(wf: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  wf.nodes.forEach((n, i) => {
    if (!NODE_SPECS[n.kind]) issues.push({ path: `nodes[${i}].kind`, message: `Unknown node kind "${n.kind}"` });
    if (ids.has(n.id)) issues.push({ path: `nodes[${i}].id`, message: `Duplicate node id "${n.id}"` });
    ids.add(n.id);
  });
  wf.edges.forEach((e, i) => {
    if (!ids.has(e.from)) issues.push({ path: `edges[${i}].from`, message: `Unknown node "${e.from}"` });
    if (!ids.has(e.to)) issues.push({ path: `edges[${i}].to`, message: `Unknown node "${e.to}"` });
  });
  const triggers = wf.nodes.filter((n) => n.kind.startsWith('trigger.'));
  if (triggers.length !== 1) issues.push({ path: 'nodes', message: 'A workflow needs exactly one trigger node' });
  // Cycle check (Kahn).
  const indeg = new Map<string, number>(wf.nodes.map((n) => [n.id, 0]));
  for (const e of wf.edges) if (indeg.has(e.to)) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
  let seen = 0;
  while (queue.length) {
    const id = queue.shift()!;
    seen++;
    for (const e of wf.edges) if (e.from === id && indeg.has(e.to)) {
      const d = (indeg.get(e.to) ?? 0) - 1;
      indeg.set(e.to, d);
      if (d === 0) queue.push(e.to);
    }
  }
  if (seen !== wf.nodes.length) issues.push({ path: 'edges', message: 'Workflow contains a cycle' });
  // Unreachable nodes.
  if (triggers.length === 1) {
    const reach = new Set<string>([triggers[0].id]);
    for (let changed = true; changed;) {
      changed = false;
      for (const e of wf.edges) if (reach.has(e.from) && !reach.has(e.to)) { reach.add(e.to); changed = true; }
    }
    for (const n of wf.nodes) if (!reach.has(n.id)) issues.push({ path: `nodes.${n.id}`, message: `Node "${n.id}" is unreachable from the trigger` });
  }
  return issues;
}

export function validateManifest(m: SenseManifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const need = (cond: boolean, path: string, message: string) => { if (!cond) issues.push({ path, message }); };
  need(ID_RE.test(m.id ?? ''), 'id', 'id must be lowercase letters, digits and dashes (3-64 chars)');
  need(SEMVER_RE.test(m.version ?? ''), 'version', 'version must be semver x.y.z');
  for (const k of ['name_ar', 'name_en', 'description_ar', 'description_en', 'author', 'icon'] as const) need(!!m[k]?.trim(), k, `${k} is required`);
  need((SENSE_CATEGORIES as readonly string[]).includes(m.category), 'category', 'unknown category');
  need(m.supported_devices?.length > 0 && m.supported_devices.every((d) => (DEVICE_KINDS as readonly string[]).includes(d)), 'supported_devices', 'must list known devices');
  need(Array.isArray(m.permissions) && m.permissions.every((p) => (PERMISSIONS as readonly string[]).includes(p)), 'permissions', 'unknown permission');
  need(new Set(m.permissions).size === m.permissions.length, 'permissions', 'duplicate permission');
  const lim = m.resource_limits;
  need(!!lim && lim.maxSteps >= 1 && lim.maxSteps <= 200 && lim.maxAiCalls >= 0 && lim.maxAiCalls <= 50 && lim.nodeTimeoutMs >= 100 && lim.totalTimeoutMs >= lim?.nodeTimeoutMs && lim.totalTimeoutMs <= 300_000, 'resource_limits', 'limits out of bounds');
  need(m.privacy_settings?.retention_days >= 0 && m.privacy_settings.retention_days <= 3650, 'privacy_settings.retention_days', 'retention out of range');
  if (m.workflow) {
    issues.push(...validateWorkflow(m.workflow).map((i) => ({ ...i, path: `workflow.${i.path}` })));
    // A Sense may not use a capability it did not declare.
    for (const p of requiredPermissions(m.workflow)) need(m.permissions.includes(p), 'permissions', `workflow uses "${p}" but the manifest does not declare it`);
    if (m.privacy_settings?.stores_media === false && m.workflow.nodes.some((n) => n.kind === 'action.save_record' && n.params?.includeMedia === true))
      issues.push({ path: 'privacy_settings.stores_media', message: 'workflow saves media but privacy_settings.stores_media is false' });
  }
  return issues;
}

/** Permissions added by an update: those need fresh user consent, they are never granted silently. */
export function addedPermissions(prev: Pick<SenseManifest, 'permissions'>, next: Pick<SenseManifest, 'permissions'>): Permission[] {
  return next.permissions.filter((p) => !prev.permissions.includes(p));
}

// ---------- execution ----------

export type StepStatus = 'ok' | 'skipped' | 'failed' | 'blocked';
export type StepLog = { nodeId: string; kind: NodeKind; status: StepStatus; startedAt: number; ms: number; output?: unknown; error?: string };
export type RunResult = { status: 'succeeded' | 'failed' | 'blocked'; steps: StepLog[]; outputs: Record<string, unknown>; aiCalls: number };

export type RunOptions = {
  granted: Permission[];
  adapters: Adapters;
  /** High-impact nodes call this; without it (or on false) they are blocked, never run. */
  approve?: (nodeId: string, kind: NodeKind, params: unknown) => Promise<boolean>;
  limits?: Partial<ResourceLimits>;
  settings?: Record<string, unknown>;
  now?: () => number;
};

function lookup(path: string, ctx: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), ctx);
}
/** `{{node.field}}` substitution. Values are inserted as plain text; they never become instructions. */
function render(v: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof v === 'string') return v.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p) => { const r = lookup(p, ctx); return r == null ? '' : String(r); });
  if (Array.isArray(v)) return v.map((x) => render(x, ctx));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, render(x, ctx)]));
  return v;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([p, new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms); })]).finally(() => clearTimeout(t));
}

function evalCondition(p: Record<string, unknown> | undefined, ctx: Record<string, unknown>): boolean {
  if (!p) return false;
  const left = lookup(String(p.left ?? ''), ctx);
  const right = p.right;
  switch (p.op) {
    case 'exists': return left != null && left !== '';
    case 'eq': return left === right;
    case 'neq': return left !== right;
    case 'contains': return typeof left === 'string' && typeof right === 'string' && left.toLowerCase().includes(right.toLowerCase());
    case 'gt': return typeof left === 'number' && typeof right === 'number' && left > right;
    case 'lt': return typeof left === 'number' && typeof right === 'number' && left < right;
    default: return false;
  }
}

export async function runWorkflow(manifest: Pick<SenseManifest, 'workflow' | 'resource_limits' | 'permissions'>, opts: RunOptions): Promise<RunResult> {
  const wf = manifest.workflow;
  const problems = validateWorkflow(wf);
  if (problems.length) throw new Error(`Invalid workflow: ${problems.map((p) => p.message).join('; ')}`);
  const limits = { ...DEFAULT_LIMITS, ...manifest.resource_limits, ...opts.limits };
  const now = opts.now ?? Date.now;
  const started = now();
  const ctx: Record<string, unknown> = { settings: opts.settings ?? {} };
  const steps: StepLog[] = [];
  const active = new Set<string>(); // nodes enabled to run
  const trigger = wf.nodes.find((n) => n.kind.startsWith('trigger.'))!;
  active.add(trigger.id);
  const done = new Set<string>();
  let aiCalls = 0;
  let final: RunResult['status'] = 'succeeded';

  const order = topoOrder(wf);
  for (const node of order) {
    if (!active.has(node.id)) { continue; }
    if (steps.length >= limits.maxSteps) { final = 'failed'; steps.push(fail(node, now(), 'maxSteps exceeded')); break; }
    if (now() - started > limits.totalTimeoutMs) { final = 'failed'; steps.push(fail(node, now(), 'totalTimeoutMs exceeded')); break; }
    const t0 = now();
    const spec = NODE_SPECS[node.kind];
    const log: StepLog = { nodeId: node.id, kind: node.kind, status: 'ok', startedAt: t0, ms: 0 };
    try {
      for (const p of spec.permissions) if (!manifest.permissions.includes(p) || !opts.granted.includes(p)) throw new PermissionError(p, node.id);
      if (spec.ai && ++aiCalls > limits.maxAiCalls) throw new Error('maxAiCalls exceeded');
      const params = render(node.params ?? {}, ctx) as Record<string, unknown>;
      if (spec.needsApproval) {
        const ok = opts.approve ? await opts.approve(node.id, node.kind, params) : false;
        if (!ok) { log.status = 'blocked'; log.error = 'Human approval required and not given'; steps.push(log); final = final === 'failed' ? 'failed' : 'blocked'; continue; }
      }
      let out: unknown;
      if (node.kind === 'logic.condition') {
        out = { result: evalCondition(params, ctx) };
      } else if (spec.adapter) {
        const fn = opts.adapters[spec.adapter] as ((...a: never[]) => Promise<unknown>) | undefined;
        if (!fn) throw new CapabilityError(spec.adapter, node.kind);
        out = await withTimeout(callAdapter(node.kind, fn, params), limits.nodeTimeoutMs, node.id);
      } else out = {};
      ctx[node.id] = out;
      log.output = out;
      done.add(node.id);
      // Enable successors.
      for (const e of wf.edges.filter((x) => x.from === node.id)) {
        if (node.kind === 'logic.condition') { if ((e.when === 'true') === (out as { result: boolean }).result && e.when) active.add(e.to); }
        else if (!e.when) active.add(e.to);
      }
    } catch (err) {
      log.status = 'failed';
      log.error = err instanceof Error ? err.message : String(err);
      final = 'failed';
      steps.push({ ...log, ms: now() - t0 });
      break; // fail fast: later steps depend on this one
    }
    log.ms = now() - t0;
    steps.push(log);
  }
  return { status: final, steps, outputs: Object.fromEntries(done.size ? [...done].map((id) => [id, ctx[id]]) : []), aiCalls };
}

function fail(node: WorkflowNode, t: number, error: string): StepLog { return { nodeId: node.id, kind: node.kind, status: 'failed', startedAt: t, ms: 0, error }; }

function topoOrder(wf: Workflow): WorkflowNode[] {
  const byId = new Map(wf.nodes.map((n) => [n.id, n]));
  const indeg = new Map(wf.nodes.map((n) => [n.id, 0]));
  for (const e of wf.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
  const q = wf.nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
  const out: WorkflowNode[] = [];
  while (q.length) {
    const id = q.shift()!;
    out.push(byId.get(id)!);
    for (const e of wf.edges) if (e.from === id) { indeg.set(e.to, indeg.get(e.to)! - 1); if (indeg.get(e.to) === 0) q.push(e.to); }
  }
  return out;
}

function callAdapter(kind: NodeKind, fn: (...a: never[]) => Promise<unknown>, p: Record<string, unknown>): Promise<unknown> {
  const f = fn as (...a: unknown[]) => Promise<unknown>;
  switch (kind) {
    case 'capture.image': return f();
    case 'ai.vision.describe': return f(String(p.image ?? ''), p.prompt as string | undefined);
    case 'ai.vision.ocr': return f(String(p.image ?? ''));
    case 'ai.ask': return f(String(p.prompt ?? ''));
    case 'action.speak': return f(String(p.text ?? '')).then(() => ({}));
    case 'action.notify': return f(String(p.title ?? ''), String(p.body ?? '')).then(() => ({}));
    case 'action.save_record': return f(p);
    case 'action.create_task': return f(String(p.title ?? ''));
    case 'data.memory_search': return f(String(p.query ?? '')).then((results) => ({ results }));
    default: return Promise.resolve({});
  }
}
