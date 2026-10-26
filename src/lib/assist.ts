import { fetch } from 'expo/fetch';

import type { Lang } from '@/lib/i18n';
import type { ModeId } from '@/lib/modes';
import { getDeviceId } from '@/lib/storage';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const ENDPOINT = `${URL}/functions/v1/mata-assist`;

const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

export type Turn = { role: 'user' | 'assistant'; content: string };

export type AssistRequest = {
  /** `frame` checks the aim before a photo; `guide` steers the user toward an object. */
  mode: ModeId | 'frame' | 'guide';
  image?: string; // base64 jpeg
  audio?: string; // base64 m4a
  text?: string;
  history?: Turn[];
  model?: 'smart' | 'fast';
  detail?: boolean;
  lang?: Lang;
  /** For `frame`: the mode the photo is for. */
  target?: ModeId;
  /** Remembered belongings, one line each (see lib/memory). */
  memory?: string[];
  /** Enrolled people for `people` mode (see lib/faces). */
  faces?: { name: string; image: string }[];
  faces_enabled?: boolean;
  /** The user's saved medicines for `meds` mode (see lib/meds). */
  meds?: { name: string; note: string; image: string }[];
  /** Clock positions and steps (default), or plain left/right. */
  directions?: 'clock' | 'simple';
  /** For `where`: the street address and nearby place names from GPS (see lib/place). */
  place?: string;
};

/** What the live-mode model answers when nothing worth saying has changed. */
export const SILENT = '<silent>';
/** Live-mode answers starting with this are urgent hazards. */
export const URGENT = '!';

/**
 * Streams the assistant's answer. `onDelta` receives raw text chunks as they arrive.
 * Resolves with the full raw text (which may start with a "§ question" line for voice input).
 */
export async function streamAssist(
  req: AssistRequest,
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...req, device_id: getDeviceId() }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(`assist ${res.status}: ${detail.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const delta: string = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        // keep-alive comment or partial line
      }
    }
  }
  return full;
}

const TAG = /<(seen|remember|face|med):([^>]*)>/g;

export type Tags = {
  seen: { item: string; place: string }[];
  remember: { label: string; note: string }[];
  faces: string[];
  meds: { name: string; note: string }[];
};

/**
 * The answer without the hidden memory/face/medicine tags, safe to show and speak while streaming:
 * a tag that hasn't closed yet is held back.
 */
export function visibleText(answer: string): string {
  const clean = answer.replace(TAG, '');
  const open = clean.lastIndexOf('<');
  return open !== -1 && !clean.includes('>', open) ? clean.slice(0, open) : clean;
}

export function parseTags(answer: string): Tags {
  const tags: Tags = { seen: [], remember: [], faces: [], meds: [] };
  for (const [, kind, raw] of answer.matchAll(TAG)) {
    const body = raw.trim();
    if (kind === 'seen') {
      for (const part of body.split(';')) {
        const [item, ...place] = part.split(' - ');
        if (item?.trim() && place.length) tags.seen.push({ item: item.trim(), place: place.join(' - ').trim() });
      }
    } else if (kind === 'remember' || kind === 'med') {
      const [label, ...note] = body.split('|');
      if (!label?.trim()) continue;
      if (kind === 'med') tags.meds.push({ name: label.trim(), note: note.join('|').trim() });
      else tags.remember.push({ label: label.trim(), note: note.join('|').trim() });
    } else if (body) {
      tags.faces.push(body);
    }
  }
  return tags;
}

/** Splits a raw answer into the transcribed question ("§ …" first line) and the spoken answer. */
export function splitAnswer(raw: string): { question: string | null; answer: string; pending: boolean } {
  const t = raw.replace(/^\s+/, '');
  if (!t.startsWith('§')) return { question: null, answer: t, pending: false };
  const nl = t.indexOf('\n');
  if (nl === -1) return { question: t.slice(1).trim(), answer: '', pending: true };
  return { question: t.slice(1, nl).trim(), answer: t.slice(nl + 1).replace(/^\s+/, ''), pending: false };
}

export type HistoryRow = { id: string; mode: ModeId; question: string | null; answer: string; created_at: string };

export async function fetchHistory(): Promise<HistoryRow[]> {
  const res = await fetch(`${ENDPOINT}?device_id=${getDeviceId()}`, { headers });
  if (!res.ok) throw new Error(`history ${res.status}`);
  const json = (await res.json()) as { items: HistoryRow[] };
  return json.items ?? [];
}

/**
 * Just the words in a short recording: streams an "ask" turn and stops as soon as the model's
 * "§ question" line is complete, before it starts answering.
 */
export async function transcribe(audio: string, lang: Lang): Promise<string | null> {
  const ctrl = new AbortController();
  const out = { raw: '', heard: null as string | null };
  try {
    await streamAssist(
      { mode: 'ask', audio, lang, model: 'fast', detail: false },
      (delta) => {
        out.raw += delta;
        const s = splitAnswer(out.raw);
        if (s.question && !s.pending) {
          out.heard = s.question;
          ctrl.abort();
        }
      },
      ctrl.signal,
    );
  } catch (e) {
    if (!out.heard) throw e;
  }
  return out.heard ?? splitAnswer(out.raw).question;
}
