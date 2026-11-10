import { useSyncExternalStore } from 'react';

import { readJSON, writeJSON } from '@/lib/storage';

/** What one Sense run did on this phone. Kept locally; the account only stores records the user approved. */
export type RunEntry = {
  id: string;
  senseId: string;
  name: string;
  at: number;
  status: 'succeeded' | 'failed' | 'blocked';
  /** Where the image came from, if the run captured one. */
  source?: 'meta_glasses' | 'phone_camera' | 'uploaded_image' | 'demo_session';
  summary: string;
  flagged?: boolean;
  steps: { nodeId: string; kind: string; status: string; error?: string }[];
};

const MAX = 100;
let entries: RunEntry[] = readJSON<RunEntry[]>('runlog', []);
const listeners = new Set<(e: RunEntry[]) => void>();

function commit(next: RunEntry[]) {
  entries = next;
  writeJSON('runlog', entries);
  listeners.forEach((l) => l(entries));
}

export function addRun(e: Omit<RunEntry, 'id' | 'at'>) {
  const entry: RunEntry = { ...e, id: `run${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
  commit([entry, ...entries].slice(0, MAX));
  return entry;
}

export function clearRuns() {
  commit([]);
}

export function getRuns() {
  return entries;
}

const subscribe = (l: () => void) => {
  const fn = () => l();
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function useRuns(): RunEntry[] {
  return useSyncExternalStore(subscribe, () => entries);
}
