/**
 * Sense Handover: turns consented shift records into an evidence-backed summary.
 * Deterministic on purpose. Every statement carries the ids of the records that support it,
 * and a model-written narrative may only be layered on top of these items, never replace them.
 */

export type ShiftRecordType = 'observation' | 'inspection' | 'task_done' | 'task_pending' | 'issue';

export type ShiftRecord = {
  id: string;
  type: ShiftRecordType;
  at: string; // ISO timestamp
  authorId: string;
  text: string;
  equipmentId?: string;
  /** Only records the worker explicitly approved for sharing may enter a handover. */
  consented: boolean;
  evidenceIds?: string[]; // media assets
  flagged?: boolean;
};

export type HandoverItem = { text: string; equipmentId?: string; sourceIds: string[]; evidenceIds: string[] };
export type Handover = {
  shiftId: string;
  generatedAt: string;
  completed: HandoverItem[];
  pending: HandoverItem[];
  concerns: HandoverItem[];
  excluded: number; // records left out for lack of consent
  status: 'draft'; // a human must review and approve before it is final
};

const item = (r: ShiftRecord): HandoverItem => ({ text: r.text, equipmentId: r.equipmentId, sourceIds: [r.id], evidenceIds: r.evidenceIds ?? [] });
const byTime = (a: ShiftRecord, b: ShiftRecord) => a.at.localeCompare(b.at);

export function buildHandover(shiftId: string, records: ShiftRecord[], now: () => Date = () => new Date()): Handover {
  const usable = records.filter((r) => r.consented).sort(byTime);
  return {
    shiftId,
    generatedAt: now().toISOString(),
    completed: usable.filter((r) => r.type === 'task_done').map(item),
    pending: usable.filter((r) => r.type === 'task_pending').map(item),
    concerns: usable.filter((r) => r.type === 'issue' || (r.type === 'inspection' && r.flagged)).map(item),
    excluded: records.length - usable.length,
    status: 'draft',
  };
}

export type Answer = { answer: string; sourceIds: string[]; grounded: boolean };

/** Answers a question from the handover only. With no supporting record it says so rather than guessing. */
export function answerFromHandover(h: Handover, question: string): Answer {
  const q = question.toLowerCase();
  const pick = (items: HandoverItem[], label: string): Answer | null => {
    if (!items.length) return { answer: `No ${label} were recorded in this shift.`, sourceIds: [], grounded: true };
    return { answer: items.map((i) => `- ${i.text}`).join('\n'), sourceIds: items.flatMap((i) => i.sourceIds), grounded: true };
  };
  if (/(unfinished|pending|left|remaining|لم ينته|متبقي|باقي)/.test(q)) return pick(h.pending, 'pending tasks')!;
  if (/(attention|concern|issue|problem|machine|مشكلة|تحتاج)/.test(q)) return pick(h.concerns, 'concerns')!;
  if (/(done|completed|happened|what happened|أنجز|صار)/.test(q)) {
    const all = [...h.completed, ...h.pending, ...h.concerns];
    if (!all.length) return { answer: 'No consented records exist for this shift.', sourceIds: [], grounded: true };
    return {
      answer: [`Completed: ${h.completed.length}`, `Pending: ${h.pending.length}`, `Concerns: ${h.concerns.length}`].join(' · '),
      sourceIds: all.flatMap((i) => i.sourceIds),
      grounded: true,
    };
  }
  return { answer: 'I can only answer about completed work, pending work or concerns recorded in this handover.', sourceIds: [], grounded: false };
}
