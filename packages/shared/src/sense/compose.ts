import { DEFAULT_LIMITS, requiredPermissions, validateManifest, type SenseCategory, type SenseManifest, type ValidationIssue, type WorkflowEdge, type WorkflowNode } from './sense.ts';

/**
 * Sixth Sense Composer (rules mode). Turns a plain-language description into a proposed,
 * validated Sense that the user can review and edit. It matches keywords; it does NOT use a
 * language model, and says so in `mode`. The proposal always passes validateManifest or throws.
 */
export type Composition = { manifest: SenseManifest; mode: 'rules'; matched: string[]; notes: string[] };

const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));

export function composeFromDescription(description: string, opts: { author?: string; now?: () => number } = {}): Composition {
  const raw = description.trim();
  if (raw.length < 8) throw new Error('Describe what the Sense should do (at least a few words).');
  if (raw.length > 500) throw new Error('Description is too long (500 characters max).');
  const t = raw.toLowerCase();
  const matched: string[] = [];
  const notes: string[] = [];
  const nodes: WorkflowNode[] = [{ id: 'start', kind: 'trigger.manual' }];
  const edges: WorkflowEdge[] = [];
  let last = 'start';
  const add = (n: WorkflowNode, when?: 'true' | 'false') => { nodes.push(n); edges.push({ from: last, to: n.id, when }); last = n.id; };

  const wantsRead = has(t, 'read', 'text', 'sign', 'menu', 'اقرأ', 'نص', 'لافتة');
  const wantsCamera = wantsRead || has(t, 'inspect', 'photo', 'picture', 'camera', 'look', 'describe', 'scene', 'equipment', 'machine', 'فحص', 'صورة', 'كاميرا', 'وصف', 'معدات', 'ماكينة', 'آلة');
  const wantsFlag = has(t, 'damage', 'defect', 'corrosion', 'leak', 'broken', 'ضرر', 'تلف', 'خلل', 'تسرب', 'صدأ');
  const wantsRecord = has(t, 'record', 'report', 'save', 'log', 'سجل', 'تقرير', 'احفظ');
  const wantsSpeak = has(t, 'speak', 'say', 'tell', 'aloud', 'صوت', 'قل', 'انطق') || wantsRead || has(t, 'describe', 'وصف');
  const wantsNotify = has(t, 'notify', 'alert', 'warn', 'نبه', 'نبّه', 'إشعار', 'تنبيه');

  if (wantsCamera) { add({ id: 'shot', kind: 'capture.image' }); matched.push('camera'); }
  else notes.push('No camera step was added because the description does not mention seeing anything.');

  if (wantsCamera) {
    if (wantsRead) { add({ id: 'text', kind: 'ai.vision.ocr', params: { image: '{{shot.imageRef}}' } }); matched.push('read text'); }
    else {
      add({ id: 'look', kind: 'ai.vision.describe', params: { image: '{{shot.imageRef}}', prompt: `Task from the Sense author: ${raw}\nReport only what is visible; separate observation from inference; say when unsure.` } });
      matched.push('describe image');
    }
  }
  const out = wantsRead && wantsCamera ? 'text.text' : wantsCamera ? 'look.text' : '';

  if (wantsFlag && out) {
    const keyword = has(t, 'corrosion', 'صدأ') ? 'corrosion' : has(t, 'leak', 'تسرب') ? 'leak' : 'damage';
    add({ id: 'found', kind: 'logic.condition', params: { left: out, op: 'contains', right: keyword } });
    matched.push(`condition: ${keyword}`);
    add({ id: 'record', kind: 'action.save_record', params: { type: 'inspection', observation: `{{${out}}}`, flagged: true } }, 'true');
    last = 'record';
    if (wantsNotify || wantsFlag) { add({ id: 'alert', kind: 'action.notify', params: { title: 'Possible issue', body: `{{${out}}}` } }); matched.push('notify'); }
    nodes.push({ id: 'clean', kind: 'action.save_record', params: { type: 'inspection', observation: `{{${out}}}`, flagged: false } });
    edges.push({ from: 'found', to: 'clean', when: 'false' });
    matched.push('save record');
  } else {
    if (wantsRecord || (!wantsSpeak && out)) { add({ id: 'record', kind: 'action.save_record', params: { type: 'observation', observation: out ? `{{${out}}}` : '{{settings.note}}' } }); matched.push('save record'); }
    if (wantsNotify) { add({ id: 'alert', kind: 'action.notify', params: { title: 'Sense result', body: out ? `{{${out}}}` : 'Done' } }); matched.push('notify'); }
    if (wantsSpeak) { add({ id: 'say', kind: 'action.speak', params: { text: out ? `{{${out}}}` : 'Done.' } }); matched.push('speak'); }
  }
  if (nodes.length === 1) throw new Error('Could not find any action in that description. Try mentioning what to look at and what to do with it.');
  if (wantsFlag) notes.push('Flagging uses a keyword match on the model\'s text, a simple check, not a safety judgement.');

  const tick = (opts.now ?? Date.now)();
  const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  const id = `u-${slug || 'sense'}-${(tick % 1_679_616).toString(36)}`.replace(/-+/g, '-');
  const category: SenseCategory = wantsFlag || has(t, 'equipment', 'machine', 'معدات') ? 'maintenance' : wantsRead ? 'accessibility' : 'personal';
  const title = raw.length > 40 ? `${raw.slice(0, 37)}…` : raw;
  const manifest: SenseManifest = {
    id, kind: 'flow', name_ar: title, name_en: title, description_ar: raw, description_en: raw, icon: 'sparkles', category,
    version: '0.1.0', author: opts.author ?? 'user', supported_devices: ['meta_glasses', 'phone_camera', 'uploaded_image', 'demo_session'],
    triggers: ['manual'], inputs: wantsCamera ? ['image'] : ['text'], outputs: [], permissions: [], settings_schema: [],
    workflow: { nodes, edges }, model_requirements: { vision: wantsCamera && !wantsRead, ocr: wantsRead },
    privacy_settings: { stores_media: false, retention_days: wantsRecord || wantsFlag ? 90 : 0, requires_consent: wantsRecord || wantsFlag },
    resource_limits: DEFAULT_LIMITS,
  };
  manifest.permissions = requiredPermissions(manifest.workflow);
  manifest.outputs = [wantsSpeak && 'speech', (wantsRecord || wantsFlag) && 'record', (wantsNotify || wantsFlag) && 'notification'].filter(Boolean) as string[];
  const issues: ValidationIssue[] = validateManifest(manifest);
  if (issues.length) throw new Error(`Composer produced an invalid Sense: ${issues.map((i) => i.message).join('; ')}`);
  return { manifest, mode: 'rules', matched, notes };
}
