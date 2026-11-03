import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { readJSON, writeJSON } from '@/lib/storage';

/**
 * The user's own medicines, saved by saying "save this as my blood pressure medicine" in the
 * medicine check. Each keeps a photo of the box; before taking a pill the user shows a box and
 * the model compares it with these ("yes, that's your blood pressure one" / "no, careful").
 * Photos stay on the phone and are only sent with medicine checks.
 */
export type Med = { id: string; name: string; note: string; photo: string; at: number };

const MAX_MEDS = 12;
/** Reference photos sent per check; more makes the request slow. */
const MAX_REFS = 8;
const DIR = new Directory(Paths.document, 'meds');

let meds: Med[] = readJSON<Med[]>('meds', []);
const listeners = new Set<(m: Med[]) => void>();

function commit(next: Med[]) {
  meds = next;
  writeJSON('meds', meds);
  listeners.forEach((l) => l(meds));
}

function key(name: string) {
  return name.trim().toLowerCase().replace(/^(دواء|علاج) /, '');
}

/** Saves (or replaces, by name) a medicine with the photo it was shown in. */
export function addMed(name: string, note: string, base64: string) {
  try {
    if (!DIR.exists) DIR.create();
    const id = `m${Date.now()}`;
    const f = new File(DIR, `${id}.jpg`);
    f.create();
    f.write(base64, { encoding: 'base64' });
    const k = key(name);
    meds.filter((m) => key(m.name) === k).forEach((m) => removeFile(m.photo));
    const rest = meds.filter((m) => key(m.name) !== k);
    rest.slice(MAX_MEDS - 1).forEach((m) => removeFile(m.photo));
    commit([{ id, name, note, photo: f.uri, at: Date.now() }, ...rest].slice(0, MAX_MEDS));
  } catch (e) {
    console.warn('save medicine failed', e);
  }
}

export function removeMed(id: string) {
  const med = meds.find((m) => m.id === id);
  if (med) removeFile(med.photo);
  commit(meds.filter((m) => m.id !== id));
}

/** Names, notes and photos for a medicine check, newest first. */
export async function medRefs(): Promise<{ name: string; note: string; image: string }[]> {
  const out: { name: string; note: string; image: string }[] = [];
  for (const m of meds.slice(0, MAX_REFS)) {
    try {
      out.push({ name: m.name, note: m.note, image: await new File(m.photo).base64() });
    } catch {}
  }
  return out;
}

export function useMeds() {
  const [list, setList] = useState(meds);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

function removeFile(uri: string) {
  try {
    new File(uri).delete();
  } catch {}
}
