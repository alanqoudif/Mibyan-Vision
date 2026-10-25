import { Directory, File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { readJSON, writeJSON } from '@/lib/storage';

/**
 * Meta's Wearables Acceptable Use Policy forbids identifying people by their face through the
 * glasses unless Meta approves the (accessibility) app first. Keep this off until that
 * approval is in writing; while false, the setting is hidden and nothing is sent.
 */
export const FACES_ALLOWED = false;

/**
 * People the user enrolled, with consent, by saying "save this person as …" in People mode.
 * Reference photos stay on the phone and are only sent along with People requests.
 */
export type Face = { id: string; name: string; photo: string; at: number };

const MAX_FACES = 5;
const DIR = new Directory(Paths.document, 'faces');

let faces: Face[] = readJSON<Face[]>('faces', []);
const listeners = new Set<(f: Face[]) => void>();

function commit(next: Face[]) {
  faces = next;
  writeJSON('faces', faces);
  listeners.forEach((l) => l(faces));
}

export function addFace(name: string, base64: string) {
  try {
    if (!DIR.exists) DIR.create();
    const id = `f${Date.now()}`;
    const f = new File(DIR, `${id}.jpg`);
    f.create();
    f.write(base64, { encoding: 'base64' });
    const replaced = faces.filter((x) => x.name === name);
    replaced.forEach((x) => removeFile(x.photo));
    commit([{ id, name, photo: f.uri, at: Date.now() }, ...faces.filter((x) => x.name !== name)].slice(0, MAX_FACES));
  } catch (e) {
    console.warn('save face failed', e);
  }
}

export function removeFace(id: string) {
  const face = faces.find((f) => f.id === id);
  if (face) removeFile(face.photo);
  commit(faces.filter((f) => f.id !== id));
}

/** Reference photos for a People request. */
export async function faceRefs(): Promise<{ name: string; image: string }[]> {
  const out: { name: string; image: string }[] = [];
  for (const f of faces) {
    try {
      out.push({ name: f.name, image: await new File(f.photo).base64() });
    } catch {}
  }
  return out;
}

export function useFaces() {
  const [list, setList] = useState(faces);
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
