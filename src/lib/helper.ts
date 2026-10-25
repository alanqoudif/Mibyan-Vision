import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { fetch } from 'expo/fetch';
import { useEffect, useState } from 'react';

import type { Lang } from '@/lib/i18n';
import { getDeviceId, readJSON, writeJSON } from '@/lib/storage';

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

/**
 * Opens a sharing session. With `notify`, those trusted helpers ("all" or one contact id) get a
 * notification that opens the view directly; `notified` names the ones it reached.
 */
export async function startSharing(notify?: 'all' | number) {
  const res = await call<{ code: string; notified?: string[] }>({ action: 'start', device_id: getDeviceId(), notify });
  return { code: res.code, notified: res.notified ?? [] };
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

// ---------- trusted helpers (the blind user's side) ----------

export type Contact = { id: number; name: string; reachable: boolean };

/** Kept on disk too, so "call mom" can be matched before the list has loaded. */
let contacts: Contact[] = readJSON<Contact[]>('contacts', []);
const listeners = new Set<(c: Contact[]) => void>();

function setContacts(next: Contact[]) {
  contacts = next;
  writeJSON('contacts', next);
  listeners.forEach((l) => l(next));
}

export async function refreshContacts() {
  const res = await call<{ contacts: Contact[] }>({ action: 'contacts', device_id: getDeviceId() });
  setContacts(res.contacts);
  return res.contacts;
}

export function useContacts() {
  const [list, setList] = useState(contacts);
  useEffect(() => {
    listeners.add(setList);
    refreshContacts().catch(() => {});
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

/** A 6-digit code the helper enters once in their own copy of the app. */
export async function createInvite() {
  return (await call<{ code: string }>({ action: 'invite', device_id: getDeviceId() })).code;
}

export async function removeContact(id: number) {
  await call({ action: 'remove', id, device_id: getDeviceId() });
  setContacts(contacts.filter((c) => c.id !== id));
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/^ال/, '');
}

/** The trusted helper named in `text` ("call mom to see with me"), if any. */
export function contactIn(text: string): Contact | undefined {
  const q = normalize(text);
  return contacts.find((c) => q.includes(normalize(c.name)));
}

// ---------- trusted helpers (the helper's side) ----------

/** The Expo push token for this device, asking for notification permission if needed. */
export async function pushToken(): Promise<string | null> {
  try {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (e) {
    console.warn('push token failed', e);
    return null;
  }
}

/**
 * Becomes a trusted helper. `helperName` is what they call you ("Mom"), `ownerName` what you
 * call them; it's shown in the notification when they need you.
 */
export async function acceptInvite(code: string, helperName: string, ownerName: string, lang: Lang) {
  const token = await pushToken();
  await call({
    action: 'accept',
    code,
    helper_name: helperName,
    owner_name: ownerName,
    push_token: token,
    lang,
    device_id: getDeviceId(),
  });
  return { notifications: !!token };
}

export async function listHelping() {
  return (await call<{ people: { id: number; name: string }[] }>({ action: 'helping', device_id: getDeviceId() })).people;
}

export function leaveHelping(id: number) {
  return call({ action: 'leave', id, device_id: getDeviceId() });
}

/** Push tokens can change; helpers send the current one whenever they open the helper screen. */
export async function syncPushToken() {
  const token = await pushToken();
  if (token) await call({ action: 'token', push_token: token, device_id: getDeviceId() }).catch(() => {});
}
