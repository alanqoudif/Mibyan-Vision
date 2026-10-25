import { fetch } from 'expo/fetch';

import { getDeviceId } from '@/lib/storage';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const ENDPOINT = `${URL}/functions/v1/mata-helper`;

const headers = { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' };

/** Thrown when the other side ended the session or the code expired. */
export class HelperEnded extends Error {}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status === 404 || res.status === 410) throw new HelperEnded();
  if (!res.ok) throw new Error(`helper ${res.status}`);
  return (await res.json()) as T;
}

// ---------- the blind user's side ----------

export async function startSharing(): Promise<string> {
  return (await call<{ code: string }>({ action: 'start', device_id: getDeviceId() })).code;
}

/** Uploads the latest frame and returns messages newer than `after`. */
export function sendFrame(code: string, image: string | undefined, after: number) {
  return call<{ joined: boolean; messages: { id: number; body: string }[] }>({
    action: 'frame',
    code,
    image,
    after,
    device_id: getDeviceId(),
  });
}

export function stopSharing(code: string) {
  return call({ action: 'end', code, device_id: getDeviceId() }).catch(() => {});
}

// ---------- the helper's side ----------

export function joinSharing(code: string) {
  return call<{ ok: true }>({ action: 'join', code });
}

export function viewSharing(code: string) {
  return call<{ ended: boolean; frame?: string | null; frame_at?: string | null }>({ action: 'view', code });
}

export function sayToUser(code: string, body: string) {
  return call<{ ok: true }>({ action: 'say', code, body });
}

/** "12345678" → "1234 5678", and spaced digits for speech. */
export function formatCode(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export function spokenCode(code: string) {
  return code.split('').join(' ');
}
