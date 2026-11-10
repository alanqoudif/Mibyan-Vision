import { fetch } from 'expo/fetch';
import type { SFSymbol } from 'expo-symbols';

import type { PlaceKind } from '@/lib/commands';
import type { Lang } from '@/lib/i18n';

import { Glasses } from '../../modules/mubayan-glasses';

/**
 * "The nearest restaurant / pharmacy / mosque": places around the user, ranked by straight-line
 * distance, with a sentence ready to speak. Apple Maps' search on iOS builds that have it (fast,
 * good Arabic names); OpenStreetMap's Overpass servers otherwise (free, but often slow or busy).
 */
export type Coords = { latitude: number; longitude: number };
export type NearbyPlace = { id: string; name: string; coords: Coords; meters: number; bearing: number; street?: string };

type KindInfo = { query: string; apple: string[]; icon: SFSymbol; ar: { one: string; many: string }; en: { one: string; many: string } };

export const KINDS: Record<PlaceKind, KindInfo> = {
  restaurant: { apple: ['MKPOICategoryRestaurant'], query: 'nwr["amenity"~"^(restaurant|fast_food|food_court)$"]', icon: 'fork.knife', ar: { one: 'مطعم', many: 'مطاعم' }, en: { one: 'restaurant', many: 'restaurants' } },
  cafe: { apple: ['MKPOICategoryCafe'], query: 'nwr["amenity"="cafe"]', icon: 'cup.and.saucer.fill', ar: { one: 'كوفي', many: 'كوفيهات' }, en: { one: 'café', many: 'cafés' } },
  pharmacy: { apple: ['MKPOICategoryPharmacy'], query: 'nwr["amenity"="pharmacy"]', icon: 'cross.case.fill', ar: { one: 'صيدلية', many: 'صيدليات' }, en: { one: 'pharmacy', many: 'pharmacies' } },
  mosque: { apple: [], query: 'nwr["amenity"="place_of_worship"]["religion"="muslim"]', icon: 'building.columns.fill', ar: { one: 'مسجد', many: 'مساجد' }, en: { one: 'mosque', many: 'mosques' } },
  hospital: { apple: ['MKPOICategoryHospital'], query: 'nwr["amenity"~"^(hospital|clinic)$"]', icon: 'cross.fill', ar: { one: 'مستشفى أو مستوصف', many: 'مستشفيات ومستوصفات' }, en: { one: 'hospital or clinic', many: 'hospitals and clinics' } },
  atm: { apple: ['MKPOICategoryATM', 'MKPOICategoryBank'], query: 'nwr["amenity"~"^(atm|bank)$"]', icon: 'banknote.fill', ar: { one: 'صراف', many: 'صرافات' }, en: { one: 'ATM', many: 'ATMs' } },
  fuel: { apple: ['MKPOICategoryGasStation'], query: 'nwr["amenity"="fuel"]', icon: 'fuelpump.fill', ar: { one: 'محطة', many: 'محطات' }, en: { one: 'gas station', many: 'gas stations' } },
  grocery: { apple: ['MKPOICategoryFoodMarket'], query: 'nwr["shop"~"^(supermarket|convenience|grocery)$"]', icon: 'cart.fill', ar: { one: 'بقالة', many: 'بقالات' }, en: { one: 'grocery store', many: 'grocery stores' } },
};

/** Public Overpass servers; the main one is often busy, so the next is tried on any failure. */
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const RADII = [1500, 5000];
const MAX = 6;

function haversine(a: Coords, b: Coords) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bearingTo(a: Coords, b: Coords) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude));
  const x = Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const PER_REQUEST_MS = 9000;

/**
 * Asks every server at once and takes the first good answer: a person waiting on a spoken
 * reply shouldn't sit through one busy server timing out before the next is tried.
 */
async function overpass(query: string, signal?: AbortSignal): Promise<{ elements?: OsmElement[] }> {
  const ctrls = ENDPOINTS.map(() => new AbortController());
  const cancelAll = () => ctrls.forEach((c) => c.abort());
  signal?.addEventListener('abort', cancelAll);
  const timer = setTimeout(cancelAll, PER_REQUEST_MS);
  try {
    return await Promise.any(
      ENDPOINTS.map(async (url, i) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'MibyanVision/1.0' },
          body: `data=${encodeURIComponent(query)}`,
          signal: ctrls[i].signal,
        });
        if (!res.ok) throw new Error(`nearby ${res.status}`);
        return (await res.json()) as { elements?: OsmElement[] };
      }),
    );
  } catch {
    if (signal?.aborted) throw new Error('aborted');
    throw new Error('nearby failed');
  } finally {
    clearTimeout(timer);
    cancelAll();
    signal?.removeEventListener('abort', cancelAll);
  }
}

async function findOsm(kind: PlaceKind, from: Coords, lang: Lang, signal?: AbortSignal): Promise<NearbyPlace[]> {
  for (const radius of RADII) {
    const q = `[out:json][timeout:8];(${KINDS[kind].query}(around:${radius},${from.latitude},${from.longitude}););out center 60;`;
    const json = await overpass(q, signal);
    const places = (json.elements ?? []).flatMap((e): NearbyPlace[] => {
      const lat = e.lat ?? e.center?.lat;
      const lon = e.lon ?? e.center?.lon;
      if (lat === undefined || lon === undefined) return [];
      const t = e.tags ?? {};
      const name = (lang === 'ar' ? t['name:ar'] ?? t.name : t['name:en'] ?? t.name) ?? t.brand ?? '';
      const coords = { latitude: lat, longitude: lon };
      return [{ id: `${e.type}${e.id}`, name, coords, meters: haversine(from, coords), bearing: bearingTo(from, coords), street: t['addr:street'] }];
    });
    // Named places first within a similar distance: "a restaurant" is less useful than "Al Baik".
    places.sort((a, b) => a.meters + (a.name ? 0 : 150) - (b.meters + (b.name ? 0 : 150)));
    if (places.length) return places.slice(0, MAX);
  }
  return [];
}

const appleSearch = typeof Glasses?.searchPlaces === 'function' ? Glasses.searchPlaces.bind(Glasses) : null;

async function findApple(kind: PlaceKind, from: Coords, lang: Lang): Promise<NearbyPlace[]> {
  const info = KINDS[kind];
  for (const radius of RADII) {
    const found = await appleSearch!(info[lang].one, info.apple, from.latitude, from.longitude, radius);
    const places = found.map((p, i): NearbyPlace => {
      const coords = { latitude: p.latitude, longitude: p.longitude };
      return { id: `apple${i}-${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`, name: p.name, coords, meters: haversine(from, coords), bearing: bearingTo(from, coords), street: p.street || undefined };
    });
    // Apple ranks by relevance; the user asked for the nearest.
    const near = places.filter((p) => p.meters <= radius * 1.2).sort((a, b) => a.meters - b.meters);
    if (near.length) return near.slice(0, MAX);
  }
  return [];
}

export async function findNearby(kind: PlaceKind, from: Coords, lang: Lang, signal?: AbortSignal): Promise<NearbyPlace[]> {
  if (appleSearch) {
    try {
      const found = await findApple(kind, from, lang);
      if (found.length || signal?.aborted) return found;
    } catch (e) {
      console.warn('apple place search failed', e);
    }
  }
  return findOsm(kind, from, lang, signal);
}

const DIRS_AR = ['الشمال', 'الشمال الشرقي', 'الشرق', 'الجنوب الشرقي', 'الجنوب', 'الجنوب الغربي', 'الغرب', 'الشمال الغربي'];
const DIRS_EN = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

/**
 * Where it is from the user: as a clock position when the phone's heading is known
 * ("at 2 o'clock"), otherwise as a compass direction.
 */
export function directionText(bearing: number, heading: number | null, lang: Lang, clock: boolean) {
  if (heading !== null && clock) {
    const rel = (bearing - heading + 360) % 360;
    const hour = Math.round(rel / 30) % 12 || 12;
    return lang === 'ar' ? `على الساعة ${hour}` : `at ${hour} o'clock`;
  }
  if (heading !== null) {
    const rel = (bearing - heading + 360) % 360;
    if (rel < 30 || rel > 330) return lang === 'ar' ? 'قدامك' : 'ahead of you';
    if (rel > 150 && rel < 210) return lang === 'ar' ? 'وراك' : 'behind you';
    return rel < 180 ? (lang === 'ar' ? 'على يمينك' : 'to your right') : lang === 'ar' ? 'على يسارك' : 'to your left';
  }
  const i = Math.round(bearing / 45) % 8;
  return lang === 'ar' ? `باتجاه ${DIRS_AR[i]}` : `to the ${DIRS_EN[i]}`;
}

export function distanceText(m: number, lang: Lang) {
  if (m < 1000) {
    const r = m < 100 ? Math.round(m / 10) * 10 : Math.round(m / 50) * 50;
    return lang === 'ar' ? `${Math.max(r, 10)} متر` : `${Math.max(r, 10)} m`;
  }
  const km = (m / 1000).toFixed(1).replace(/\.0$/, '');
  return lang === 'ar' ? `${km} كيلو` : `${km} km`;
}

/** Walking time at ~1.1 m/s, a relaxed pace with a cane or a guide. */
export function walkText(m: number, lang: Lang) {
  const min = Math.max(1, Math.round(m / 1.1 / 60));
  if (min > 60) return '';
  return lang === 'ar' ? `${min === 1 ? 'دقيقة' : min === 2 ? 'دقيقتين' : `${min} دقايق`} مشي` : `${min} min walk`;
}

/** The spoken answer: the nearest one in full, then the next two in brief. */
export function nearbySpeech(kind: PlaceKind, places: NearbyPlace[], heading: number | null, lang: Lang, clock: boolean) {
  const k = KINDS[kind][lang];
  if (!places.length) return lang === 'ar' ? `ما لقيت ${k.one} قريب منك.` : `I couldn't find a ${k.one} near you.`;
  const [first, ...rest] = places;
  const label = (p: NearbyPlace) => p.name || k.one;
  const walk = walkText(first.meters, lang);
  const head =
    lang === 'ar'
      ? `أقرب ${k.one}: ${label(first)}، على بعد ${distanceText(first.meters, lang)}${walk ? `، تقريباً ${walk}` : ''}، ${directionText(first.bearing, heading, lang, clock)}${first.street ? `، في ${first.street}` : ''}.`
      : `The nearest ${k.one} is ${label(first)}, ${distanceText(first.meters, lang)} away${walk ? `, about a ${walk}` : ''}, ${directionText(first.bearing, heading, lang, clock)}${first.street ? `, on ${first.street}` : ''}.`;
  const more = rest.slice(0, 2).map((p) => `${label(p)} ${lang === 'ar' ? 'على بعد' : ''} ${distanceText(p.meters, lang)}`.replace(/\s+/g, ' '));
  if (!more.length) return head;
  return `${head} ${lang === 'ar' ? `وبعده: ${more.join('، و')}.` : `Next: ${more.join(', and ')}.`}`;
}
