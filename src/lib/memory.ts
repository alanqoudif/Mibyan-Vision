import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import type { Tags } from '@/lib/assist';
import type { Lang } from '@/lib/i18n';
import { readJSON, writeJSON } from '@/lib/storage';

/**
 * Visual memory, kept on the phone only. Two kinds of entries:
 * - `remember`: the user said "remember this is my medicine"; kept until deleted, with a photo.
 * - `seen`: belongings the model noticed in passing; only the latest sighting per item is kept.
 * Sent as text with conversation and find requests so "where are my keys?" can be answered.
 */
export type MemoryItem = {
  id: string;
  kind: 'remember' | 'seen';
  label: string;
  note: string;
  at: number;
  photo?: string;
};

const MAX_REMEMBER = 100;
const MAX_SEEN = 60;
const DIR = new Directory(Paths.document, 'memory');

let items: MemoryItem[] = readJSON<MemoryItem[]>('memory', []);
const listeners = new Set<(items: MemoryItem[]) => void>();

function commit(next: MemoryItem[]) {
  items = next;
  writeJSON('memory', items);
  listeners.forEach((l) => l(items));
}

function key(label: string) {
  return label.trim().toLowerCase().replace(/^ال/, '');
}

function savePhoto(id: string, base64?: string) {
  if (!base64) return undefined;
  try {
    if (!DIR.exists) DIR.create();
    const f = new File(DIR, `${id}.jpg`);
    f.create();
    f.write(base64, { encoding: 'base64' });
    return f.uri;
  } catch (e) {
    console.warn('memory photo failed', e);
    return undefined;
  }
}

function deletePhoto(item: MemoryItem) {
  try {
    if (item.photo) new File(item.photo).delete();
  } catch {}
}

/** Stores what an answer's hidden tags asked for. */
export function recordTags(tags: Tags, photo?: string) {
  if (!tags.seen.length && !tags.remember.length) return;
  const now = Date.now();
  let next = [...items];
  for (const r of tags.remember) {
    const id = `r${now}${Math.random().toString(36).slice(2, 6)}`;
    next.unshift({ id, kind: 'remember', label: r.label, note: r.note, at: now, photo: savePhoto(id, photo) });
  }
  for (const s of tags.seen) {
    const k = key(s.item);
    next = next.filter((m) => m.kind !== 'seen' || key(m.label) !== k);
    next.unshift({ id: `s${now}${Math.random().toString(36).slice(2, 6)}`, kind: 'seen', label: s.item, note: s.place, at: now });
  }
  const remembered = next.filter((m) => m.kind === 'remember');
  const seen = next.filter((m) => m.kind === 'seen');
  remembered.slice(MAX_REMEMBER).forEach(deletePhoto);
  commit([...remembered.slice(0, MAX_REMEMBER), ...seen.slice(0, MAX_SEEN)].sort((a, b) => b.at - a.at));
}

/** One line per entry, newest first, for the model. */
export function memoryNotes(lang: Lang): string[] {
  return items.slice(0, 40).map((m) => {
    const when = ago(m.at, lang);
    if (lang === 'en') return `${m.label}: ${m.note} (${m.kind === 'remember' ? 'they asked you to remember this, ' : 'seen '}${when})`;
    return `${m.label}: ${m.note} (${m.kind === 'remember' ? 'طلب منك تتذكره ' : 'شفته '}${when})`;
  });
}

export function forget(id: string) {
  const item = items.find((m) => m.id === id);
  if (item) deletePhoto(item);
  commit(items.filter((m) => m.id !== id));
}

export function forgetAll() {
  items.forEach(deletePhoto);
  commit([]);
}

export function useMemory() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

export function ago(at: number, lang: Lang) {
  const mins = Math.round((Date.now() - at) / 60000);
  const h = Math.round(mins / 60);
  const d = Math.round(h / 24);
  if (lang === 'en') {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    if (h < 24) return `${h} h ago`;
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  if (mins < 1) return 'الحين';
  if (mins < 60) return `قبل ${mins} دقيقة`;
  if (h < 24) return `قبل ${h} ساعة`;
  return d === 1 ? 'أمس' : `قبل ${d} أيام`;
}
