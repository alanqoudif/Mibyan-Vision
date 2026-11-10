import type { SFSymbol } from 'expo-symbols';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import {
  BUILTIN_SENSES,
  type Permission,
  type SenseCategory,
  type SenseManifest,
  type ShiftRecord,
} from '@mibyan/shared/sense';

import { readJSON, writeJSON } from '@/lib/storage';
import { fetchInstalled, visionClient, type InstalledSense } from '@/lib/vision';

/* ------------------------------------------------------------------ display categories */

export type DisplayCategory = 'accessibility' | 'everyday' | 'productivity' | 'industry' | 'education' | 'developer' | 'ai';
export const DISPLAY_CATEGORIES: DisplayCategory[] = ['accessibility', 'everyday', 'productivity', 'industry', 'education', 'developer', 'ai'];

const CATEGORY_MAP: Record<SenseCategory, DisplayCategory> = {
  accessibility: 'accessibility',
  personal: 'everyday',
  translation: 'everyday',
  productivity: 'productivity',
  industry: 'industry',
  maintenance: 'industry',
  safety: 'industry',
  education: 'education',
  developer: 'developer',
  automation: 'ai',
};
export const displayCategory = (m: SenseManifest): DisplayCategory => CATEGORY_MAP[m.category] ?? 'everyday';

/** One consistent icon + hue per category. Hues are used as tints on dark/light surfaces, never as text. */
export const CATEGORY_STYLE: Record<DisplayCategory, { icon: SFSymbol; hue: string }> = {
  accessibility: { icon: 'figure.wave', hue: '#8B5CF6' },
  everyday: { icon: 'sun.max.fill', hue: '#F5B544' },
  productivity: { icon: 'checkmark.circle.fill', hue: '#34D17A' },
  industry: { icon: 'wrench.and.screwdriver.fill', hue: '#38D5F0' },
  education: { icon: 'book.fill', hue: '#F472B6' },
  developer: { icon: 'chevron.left.forwardslash.chevron.right', hue: '#818CF8' },
  ai: { icon: 'sparkles', hue: '#D9C3A0' },
};

const ICONS: Record<string, SFSymbol> = {
  eye: 'eye.fill',
  text: 'text.viewfinder',
  wrench: 'wrench.and.screwdriver.fill',
  note: 'note.text',
};
export const senseIcon = (m: SenseManifest): SFSymbol => ICONS[m.icon] ?? CATEGORY_STYLE[displayCategory(m)].icon;

export const senseName = (m: SenseManifest, lang: 'ar' | 'en') => (lang === 'ar' ? m.name_ar : m.name_en);
export const senseDesc = (m: SenseManifest, lang: 'ar' | 'en') => (lang === 'ar' ? m.description_ar : m.description_en);

/** Starting packs, built only from Senses that exist in the catalog. */
export const PACKS: { id: 'accessibility' | 'work' | 'everyday'; senses: string[] }[] = [
  { id: 'accessibility', senses: ['scene-narrator', 'read-anything'] },
  { id: 'work', senses: ['equipment-inspection', 'shift-note'] },
  { id: 'everyday', senses: ['scene-narrator', 'read-anything'] },
];

/** Experience chosen in onboarding → Senses recommended first. */
export const EXPERIENCE_SENSES: Record<'everyday' | 'accessibility' | 'work' | 'developer', string[]> = {
  everyday: ['read-anything', 'scene-narrator'],
  accessibility: ['scene-narrator', 'read-anything'],
  work: ['equipment-inspection', 'shift-note'],
  developer: ['scene-narrator', 'shift-note'],
};

/* ------------------------------------------------------------------ errors */

export const isOfflineError = (m: string | null | undefined) => !!m && /network request failed|failed to fetch|offline|timed out/i.test(m);
export const isMissingTable = (m: string | null | undefined) => !!m && /does not exist|schema cache|42P01|PGRST205/i.test(m);
const msg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

export async function currentUserId(): Promise<string | null> {
  if (!visionClient) return null;
  const { data } = await visionClient.auth.getSession();
  return data.session?.user.id ?? null;
}

/* ------------------------------------------------------------------ catalog (marketplace) */

type CatalogState = { items: SenseManifest[]; source: 'account' | 'local'; loading: boolean; error: string | null };
let catalog: CatalogState = {
  items: readJSON<SenseManifest[] | null>('catalog-cache', null) ?? BUILTIN_SENSES,
  source: 'local',
  loading: false,
  error: null,
};
const catalogListeners = new Set<() => void>();
const setCatalog = (p: Partial<CatalogState>) => {
  catalog = { ...catalog, ...p };
  catalogListeners.forEach((l) => l());
};

export async function refreshCatalog() {
  if (!visionClient || !(await currentUserId())) {
    setCatalog({ items: BUILTIN_SENSES, source: 'local', error: null, loading: false });
    return;
  }
  setCatalog({ loading: true });
  try {
    const senses = await visionClient.from('vision_senses').select('id,latest_version');
    if (senses.error) throw new Error(senses.error.message);
    const rows = senses.data ?? [];
    if (!rows.length) throw new Error('catalog is empty');
    const ver = await visionClient.from('vision_sense_versions').select('sense_id,version,manifest').in('sense_id', rows.map((r) => r.id));
    if (ver.error) throw new Error(ver.error.message);
    const items = rows.flatMap((r) => {
      const v = (ver.data ?? []).find((x) => x.sense_id === r.id && x.version === r.latest_version);
      return v ? [v.manifest as SenseManifest] : [];
    });
    if (!items.length) throw new Error('catalog has no published versions');
    writeJSON('catalog-cache', items);
    setCatalog({ items, source: 'account', error: null, loading: false });
  } catch (e) {
    // Keep what we have (cache or built-ins) and say why it is not live.
    setCatalog({ source: 'local', error: msg(e), loading: false });
  }
}

export function useCatalog() {
  const s = useSyncExternalStore((l) => { catalogListeners.add(l); return () => catalogListeners.delete(l); }, () => catalog);
  return { ...s, refresh: refreshCatalog };
}

/* ------------------------------------------------------------------ installed Senses */

type InstalledState = { items: InstalledSense[]; synced: boolean; loading: boolean; error: string | null; offline: boolean; ready: boolean };
let installed: InstalledState = {
  items: readJSON<InstalledSense[]>('installed-cache', []),
  synced: false,
  loading: false,
  error: null,
  offline: false,
  ready: false,
};
const installedListeners = new Set<() => void>();
const setInstalled = (p: Partial<InstalledState>) => {
  installed = { ...installed, ...p };
  installedListeners.forEach((l) => l());
};
const localKey = 'local-installed';

export async function refreshInstalled() {
  const uid = await currentUserId();
  if (!uid) {
    // Signed out: installs live on this phone only.
    setInstalled({ items: readJSON<InstalledSense[]>(localKey, []), synced: false, loading: false, error: null, offline: false, ready: true });
    return;
  }
  setInstalled({ loading: true });
  try {
    const items = await fetchInstalled();
    writeJSON('installed-cache', items);
    setInstalled({ items, synced: true, loading: false, error: null, offline: false, ready: true });
  } catch (e) {
    const m = msg(e);
    setInstalled({ loading: false, error: m, offline: isOfflineError(m), synced: false, ready: true });
  }
}

export const getInstalledIds = () => installed.items.map((i) => i.manifest.id);

export function useInstalledSenses() {
  const s = useSyncExternalStore((l) => { installedListeners.add(l); return () => installedListeners.delete(l); }, () => installed);
  return { ...s, refresh: refreshInstalled };
}

/** Called once from the root layout: loads on launch, on sign-in/out and when the app returns to the foreground. */
export function useSixthBootstrap() {
  useEffect(() => {
    void refreshInstalled();
    void refreshCatalog();
    const sub = visionClient?.auth.onAuthStateChange(() => { void refreshInstalled(); void refreshCatalog(); });
    const app = AppState.addEventListener('change', (st) => { if (st === 'active') void refreshInstalled(); });
    return () => { sub?.data.subscription.unsubscribe(); app.remove(); };
  }, []);
}

/** Installs with exactly the permissions the user approved. Signed in → saved to the account; otherwise this phone only. */
export async function installSense(m: SenseManifest, granted: Permission[], enable: boolean): Promise<{ synced: boolean }> {
  const uid = await currentUserId();
  if (uid && visionClient) {
    const { error } = await visionClient.from('vision_sense_installations').upsert(
      { user_id: uid, sense_id: m.id, version: m.version, enabled: enable, granted_permissions: granted, settings: {}, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,sense_id' },
    );
    if (error) throw new Error(error.message);
    await refreshInstalled();
    return { synced: true };
  }
  const list = readJSON<InstalledSense[]>(localKey, []).filter((x) => x.manifest.id !== m.id);
  list.push({ manifest: m, enabled: enable, granted, settings: {}, version: m.version });
  writeJSON(localKey, list);
  await refreshInstalled();
  return { synced: false };
}

export async function uninstallSense(id: string) {
  const uid = await currentUserId();
  if (uid && visionClient) {
    const { error } = await visionClient.from('vision_sense_installations').delete().eq('sense_id', id);
    if (error) throw new Error(error.message);
  } else {
    writeJSON(localKey, readJSON<InstalledSense[]>(localKey, []).filter((x) => x.manifest.id !== id));
  }
  await refreshInstalled();
}

export async function setEnabled(id: string, enabled: boolean) {
  const uid = await currentUserId();
  const before = installed.items;
  // Optimistic: the switch moves at once; a failure rolls it back and surfaces the error.
  setInstalled({ items: before.map((x) => (x.manifest.id === id ? { ...x, enabled } : x)) });
  try {
    if (uid && visionClient) {
      const { error } = await visionClient.from('vision_sense_installations').update({ enabled, updated_at: new Date().toISOString() }).eq('sense_id', id);
      if (error) throw new Error(error.message);
    } else {
      writeJSON(localKey, readJSON<InstalledSense[]>(localKey, []).map((x) => (x.manifest.id === id ? { ...x, enabled } : x)));
    }
  } catch (e) {
    setInstalled({ items: before });
    throw e;
  }
}

export async function saveSettings(id: string, settings: Record<string, unknown>) {
  const uid = await currentUserId();
  if (uid && visionClient) {
    const { error } = await visionClient.from('vision_sense_installations').update({ settings, updated_at: new Date().toISOString() }).eq('sense_id', id);
    if (error) throw new Error(error.message);
  } else {
    writeJSON(localKey, readJSON<InstalledSense[]>(localKey, []).map((x) => (x.manifest.id === id ? { ...x, settings } : x)));
  }
  await refreshInstalled();
}

/* ------------------------------------------------------------------ shifts, records, handovers */

export type Shift = { id: string; title: string; started_at: string; ended_at: string | null };
export type RecordRow = {
  id: string;
  shift_id: string | null;
  sense_id: string | null;
  type: ShiftRecord['type'];
  text: string;
  equipment_id: string | null;
  flagged: boolean;
  consented: boolean;
  source: 'device' | 'phone' | 'upload' | 'demo';
  created_at: string;
};
export type HandoverRow = { id: string; shift_id: string; content: Record<string, unknown>; status: 'draft' | 'approved'; approved_at: string | null; created_at: string };

function need() {
  if (!visionClient) throw new Error('NO_BACKEND');
  return visionClient;
}
function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function getActiveShift(): Promise<Shift | null> {
  const c = need();
  const rows = unwrap(await c.from('vision_shifts').select('id,title,started_at,ended_at').is('ended_at', null).order('started_at', { ascending: false }).limit(1));
  return (rows?.[0] as Shift | undefined) ?? null;
}
export async function startShift(title: string): Promise<Shift> {
  const c = need();
  const uid = await currentUserId();
  if (!uid) throw new Error('NO_BACKEND');
  const rows = unwrap(await c.from('vision_shifts').insert({ user_id: uid, title: title.trim().slice(0, 120) }).select('id,title,started_at,ended_at'));
  return rows![0] as Shift;
}
export async function endShift(id: string) {
  const c = need();
  unwrap(await c.from('vision_shifts').update({ ended_at: new Date().toISOString() }).eq('id', id).select('id'));
}
export async function listShifts(limit = 10): Promise<Shift[]> {
  const c = need();
  return (unwrap(await c.from('vision_shifts').select('id,title,started_at,ended_at').order('started_at', { ascending: false }).limit(limit)) ?? []) as Shift[];
}
export async function listRecords(opts: { shiftId?: string; limit?: number } = {}): Promise<RecordRow[]> {
  const c = need();
  let q = c.from('vision_records').select('id,shift_id,sense_id,type,text,equipment_id,flagged,consented,source,created_at').order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (opts.shiftId) q = q.eq('shift_id', opts.shiftId);
  return (unwrap(await q) ?? []) as RecordRow[];
}
export async function addRecord(r: { shiftId?: string | null; senseId?: string; type: RecordRow['type']; text: string; flagged?: boolean; consented: boolean; source: RecordRow['source'] }): Promise<string> {
  const c = need();
  const uid = await currentUserId();
  if (!uid) throw new Error('NO_BACKEND');
  const rows = unwrap(await c.from('vision_records').insert({
    user_id: uid, shift_id: r.shiftId ?? null, sense_id: r.senseId ?? null, type: r.type, text: r.text.slice(0, 4000),
    flagged: !!r.flagged, consented: r.consented, source: r.source,
  }).select('id'));
  return (rows![0] as { id: string }).id;
}
export async function listHandovers(limit = 10): Promise<HandoverRow[]> {
  const c = need();
  return (unwrap(await c.from('vision_handovers').select('id,shift_id,content,status,approved_at,created_at').order('created_at', { ascending: false }).limit(limit)) ?? []) as HandoverRow[];
}
export async function saveHandoverDraft(shiftId: string, content: object): Promise<HandoverRow> {
  const c = need();
  const uid = await currentUserId();
  if (!uid) throw new Error('NO_BACKEND');
  const rows = unwrap(await c.from('vision_handovers').insert({ user_id: uid, shift_id: shiftId, content, status: 'draft' }).select('id,shift_id,content,status,approved_at,created_at'));
  return rows![0] as HandoverRow;
}
export async function approveHandover(id: string) {
  const c = need();
  unwrap(await c.from('vision_handovers').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id).select('id'));
}

export const toShiftRecord = (r: RecordRow, authorId = 'me'): ShiftRecord => ({
  id: r.id, type: r.type, at: r.created_at, authorId, text: r.text, equipmentId: r.equipment_id ?? undefined, consented: r.consented, flagged: r.flagged,
});

/** Opens Vision Studio on the web. Base URL is configurable; no URL is invented when it is not set. */
export const STUDIO_URL = process.env.EXPO_PUBLIC_STUDIO_URL ?? '';

export async function markRecordDone(id: string) {
  const c = need();
  unwrap(await c.from('vision_records').update({ type: 'task_done' }).eq('id', id).select('id'));
}
