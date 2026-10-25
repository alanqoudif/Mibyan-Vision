import * as Location from 'expo-location';

import type { Lang } from '@/lib/i18n';

const TIMEOUT_MS = 6000;

/** Asks for location access once; resolves false if refused. */
export async function locationAllowed() {
  try {
    return (await Location.requestForegroundPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Where the phone is, recent enough to trust; `undefined` without permission or a fix. */
export async function currentPosition(): Promise<Location.LocationObject | undefined> {
  if (!(await locationAllowed())) return undefined;
  try {
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 30_000, requiredAccuracy: 80 });
    if (recent) return recent;
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<undefined>((r) => setTimeout(() => r(undefined), TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.warn('location failed', e);
    return undefined;
  }
}

/**
 * A one-line description of where the user is, for "where am I": place or building name,
 * street, district and city from Apple's reverse geocoder, plus how precise the fix is.
 * The model combines it with what the glasses see (shop signs, entrances).
 */
export async function describePlace(lang: Lang): Promise<string | undefined> {
  const pos = await currentPosition();
  if (!pos) return undefined;
  try {
    const [a] = await Location.reverseGeocodeAsync(pos.coords);
    if (!a) return undefined;
    const street = [a.street, a.streetNumber].filter(Boolean).join(' ');
    const parts = [a.name !== a.street && a.name !== street ? a.name : null, street, a.district, a.city]
      .filter((p): p is string => !!p)
      .filter((p, i, all) => all.indexOf(p) === i);
    if (!parts.length) return undefined;
    const meters = Math.round(pos.coords.accuracy ?? 0);
    const precision = meters ? (lang === 'en' ? ` (accurate to about ${meters} m)` : ` (الدقة تقريبًا ${meters} متر)`) : '';
    return parts.join(lang === 'en' ? ', ' : '، ') + precision;
  } catch (e) {
    console.warn('reverse geocode failed', e);
    return undefined;
  }
}
