import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { readJSON, writeJSON } from '@/lib/storage';

/**
 * Emergency numbers the user saves themselves ("mom", "dad", a neighbour). Unlike trusted helpers
 * these are plain phone calls: no app needed on the other side. Saying "call mom" dials one when
 * no helper has that name. Stored on the phone only.
 */
export type EmergencyContact = { id: string; name: string; phone: string };

/** Saudi unified emergency number (police, ambulance, civil defence). */
export const EMERGENCY_SERVICES = '911';

let list: EmergencyContact[] = readJSON<EmergencyContact[]>('emergency', []);
const listeners = new Set<(l: EmergencyContact[]) => void>();

function commit(next: EmergencyContact[]) {
  list = next;
  writeJSON('emergency', list);
  listeners.forEach((l) => l(list));
}

/** Keeps digits and a leading +; returns null when it can't be a phone number. */
export function cleanPhone(raw: string) {
  const ascii = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  const phone = ascii.replace(/(?!^\+)[^\d]/g, '');
  return phone.replace(/\D/g, '').length >= 3 ? phone : null;
}

const DIGIT_WORDS: Record<string, string> = {
  صفر: '0',
  واحد: '1',
  اثنين: '2',
  اثنان: '2',
  ثنين: '2',
  ثلاثه: '3',
  ثلاث: '3',
  اربعه: '4',
  اربع: '4',
  خمسه: '5',
  خمس: '5',
  سته: '6',
  ست: '6',
  سبعه: '7',
  سبع: '7',
  ثمانيه: '8',
  ثمان: '8',
  تسعه: '9',
  تسع: '9',
  zero: '0',
  oh: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

/**
 * "Mom 055 123 4567" (or the digits said as words) → { name: 'Mom', phone: '0551234567' }.
 * Used by the spoken setup, where the transcript may spell digits out.
 */
export function contactFromSpeech(text: string): { name: string; phone: string } | null {
  const tokens = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .split(/[\s,،.]+/)
    .filter(Boolean)
    .map((raw) => {
      const n = normalize(raw);
      const digit = /^\+?[\d-]+$/.test(raw) ? raw : (DIGIT_WORDS[n] ?? DIGIT_WORDS[n.replace(/^و/, '')]);
      return { raw, n, digit };
    });
  const phone = cleanPhone(tokens.map((x) => x.digit ?? '').join(''));
  if (!phone) return null;
  const name = tokens
    .filter((x) => !x.digit && !FILLER.test(x.n))
    .map((x) => x.raw)
    .join(' ');
  return { name, phone };
}

const FILLER = /^(رقم|رقمه|رقمها|الرقم|اسمه|اسمها|هو|هي|و|حق|number|is|and|their|his|her)$/;

export function addEmergency(name: string, phone: string) {
  commit([...list, { id: `e${Date.now()}`, name: name.trim(), phone }]);
}

export function removeEmergency(id: string) {
  commit(list.filter((e) => e.id !== id));
}

export function useEmergency() {
  const [value, setValue] = useState(list);
  useEffect(() => {
    listeners.add(setValue);
    return () => {
      listeners.delete(setValue);
    };
  }, []);
  return value;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/^ال/, '');
}

const SERVICES = /(الاسعاف|اسعاف|الطوارئ|طوارئ|الشرطه|الدفاع المدني|ambulance|emergency|police|911)/;

/** The phone number named in `text` ("call dad"), including the emergency services. */
export function phoneIn(text: string): string | undefined {
  const q = normalize(text);
  const saved = list.find((e) => q.includes(normalize(e.name)));
  if (saved) return saved.phone;
  if (SERVICES.test(q)) return EMERGENCY_SERVICES;
}

export function dial(phone: string) {
  return Linking.openURL(`tel:${phone}`).catch(() => {});
}
