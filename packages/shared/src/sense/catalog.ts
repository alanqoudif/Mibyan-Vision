import { DEFAULT_LIMITS, type SenseManifest, type Workflow } from './sense.ts';

const base = {
  version: '1.0.0',
  author: 'Mibyan',
  kind: 'builtin' as const,
  supported_devices: ['meta_glasses', 'phone_camera', 'uploaded_image', 'demo_session'] as SenseManifest['supported_devices'],
  triggers: ['manual', 'voice'] as SenseManifest['triggers'],
  settings_schema: [],
  resource_limits: DEFAULT_LIMITS,
};

const sceneNarrator: Workflow = {
  nodes: [
    { id: 'start', kind: 'trigger.manual' },
    { id: 'shot', kind: 'capture.image' },
    { id: 'look', kind: 'ai.vision.describe', params: { image: '{{shot.imageRef}}', prompt: 'Describe the scene briefly for a blind user. State only what is visible; say when unsure.' } },
    { id: 'say', kind: 'action.speak', params: { text: '{{look.text}}' } },
  ],
  edges: [{ from: 'start', to: 'shot' }, { from: 'shot', to: 'look' }, { from: 'look', to: 'say' }],
};

const equipmentInspection: Workflow = {
  nodes: [
    { id: 'start', kind: 'trigger.manual' },
    { id: 'shot', kind: 'capture.image' },
    { id: 'look', kind: 'ai.vision.describe', params: { image: '{{shot.imageRef}}', prompt: 'List visible damage, corrosion, leaks, missing parts and warning indicators on this equipment. Separate what is directly visible from what you infer. Do not certify safety.' } },
    { id: 'prior', kind: 'data.memory_search', params: { query: 'previous inspection of this equipment' } },
    { id: 'found', kind: 'logic.condition', params: { left: 'look.text', op: 'contains', right: 'damage' } },
    { id: 'record', kind: 'action.save_record', params: { type: 'inspection', observation: '{{look.text}}', image: '{{shot.imageRef}}', flagged: true } },
    { id: 'alert', kind: 'action.notify', params: { title: 'Possible equipment issue', body: '{{look.text}}' } },
    { id: 'clean', kind: 'action.save_record', params: { type: 'inspection', observation: '{{look.text}}', flagged: false } },
  ],
  edges: [
    { from: 'start', to: 'shot' }, { from: 'shot', to: 'look' }, { from: 'look', to: 'prior' }, { from: 'prior', to: 'found' },
    { from: 'found', to: 'record', when: 'true' }, { from: 'record', to: 'alert' }, { from: 'found', to: 'clean', when: 'false' },
  ],
};

const readAnything: Workflow = {
  nodes: [
    { id: 'start', kind: 'trigger.manual' },
    { id: 'shot', kind: 'capture.image' },
    { id: 'text', kind: 'ai.vision.ocr', params: { image: '{{shot.imageRef}}' } },
    { id: 'say', kind: 'action.speak', params: { text: '{{text.text}}' } },
  ],
  edges: [{ from: 'start', to: 'shot' }, { from: 'shot', to: 'text' }, { from: 'text', to: 'say' }],
};

const shiftNote: Workflow = {
  nodes: [
    { id: 'start', kind: 'trigger.manual' },
    { id: 'note', kind: 'action.save_record', params: { type: 'observation', observation: '{{settings.note}}' } },
    { id: 'say', kind: 'action.speak', params: { text: 'Saved to the shift log.' } },
  ],
  edges: [{ from: 'start', to: 'note' }, { from: 'note', to: 'say' }],
};

export const BUILTIN_SENSES: SenseManifest[] = [
  {
    ...base, id: 'scene-narrator', name_ar: 'سارد المشهد', name_en: 'Scene Narrator',
    description_ar: 'يصف ما تلتقطه الكاميرا بصوت واضح.', description_en: 'Describes what the camera captures, out loud.',
    icon: 'eye', category: 'accessibility', inputs: ['image'], outputs: ['speech'],
    permissions: ['camera', 'speech_out'], workflow: sceneNarrator,
    model_requirements: { vision: true }, privacy_settings: { stores_media: false, retention_days: 0, requires_consent: false },
  },
  {
    ...base, id: 'read-anything', name_ar: 'اقرأ أي شيء', name_en: 'Read Anything',
    description_ar: 'يقرأ النصوص من اللافتات والقوائم والمستندات.', description_en: 'Reads signs, menus and documents.',
    icon: 'text', category: 'accessibility', inputs: ['image'], outputs: ['speech'],
    permissions: ['camera', 'speech_out'], workflow: readAnything,
    model_requirements: { ocr: true }, privacy_settings: { stores_media: false, retention_days: 0, requires_consent: false },
  },
  {
    ...base, id: 'equipment-inspection', name_ar: 'فحص المعدات', name_en: 'Equipment Inspection',
    description_ar: 'يحلل صور المعدات ويسجل الملاحظات المرئية. لا يصدر شهادة سلامة.', description_en: 'Analyzes equipment photos and records visible findings. Does not certify safety.',
    icon: 'wrench', category: 'maintenance', inputs: ['image'], outputs: ['record', 'notification'],
    permissions: ['camera', 'store_write', 'memory_read', 'notifications'], workflow: equipmentInspection,
    model_requirements: { vision: true }, privacy_settings: { stores_media: true, retention_days: 90, requires_consent: true },
  },
  {
    ...base, id: 'shift-note', name_ar: 'ملاحظة الوردية', name_en: 'Shift Note',
    description_ar: 'يحفظ ملاحظة صريحة طلبها المستخدم في سجل الوردية.', description_en: 'Saves a note the user explicitly asked for into the shift log.',
    icon: 'note', category: 'industry', inputs: ['text'], outputs: ['record', 'speech'],
    permissions: ['store_write', 'speech_out'], workflow: shiftNote,
    model_requirements: {}, privacy_settings: { stores_media: false, retention_days: 90, requires_consent: true },
    settings_schema: [{ key: 'note', type: 'string', label_en: 'Note', label_ar: 'الملاحظة' }],
  },
];
