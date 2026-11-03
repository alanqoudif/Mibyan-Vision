import { File, Paths } from 'expo-file-system';

/** Tiny JSON-on-disk store (no AsyncStorage needed, works in Expo Go). */
export function readJSON<T>(name: string, fallback: T): T {
  try {
    const f = new File(Paths.document, `${name}.json`);
    return f.exists ? (JSON.parse(f.textSync()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(name: string, value: unknown) {
  try {
    const f = new File(Paths.document, `${name}.json`);
    if (!f.exists) f.create();
    f.write(JSON.stringify(value));
  } catch (e) {
    console.warn('storage write failed', e);
  }
}

let cachedId: string | null = null;

/** Anonymous per-install id used to group a user's sessions in the database. */
export function getDeviceId(): string {
  if (cachedId) return cachedId;
  const saved = readJSON<{ id?: string }>('device', {});
  if (saved.id) return (cachedId = saved.id);
  const id = Array.from({ length: 24 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
  writeJSON('device', { id });
  return (cachedId = id);
}
