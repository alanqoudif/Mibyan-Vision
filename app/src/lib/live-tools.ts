import * as Location from 'expo-location';

import type { PlaceKind } from '@/lib/commands';
import type { Lang } from '@/lib/i18n';
import { KINDS, directionText, distanceText, findNearby, walkText } from '@/lib/nearby';
import { currentPosition, describePlace } from '@/lib/place';

import { Glasses } from '../../modules/mubayan-glasses';

/**
 * Live mode's tools: Gemini asks, the phone answers with what only it knows. Results are short,
 * already in the user's language and direction style, so the model can read them out as given.
 */
export type ToolCall = { id: string; name: string; args?: Record<string, unknown> };
type Response = { id: string; name: string; response: Record<string, unknown> };

async function heading(): Promise<number | null> {
  try {
    const h = await Promise.race([Location.getHeadingAsync(), new Promise<null>((r) => setTimeout(() => r(null), 1200))]);
    if (!h) return null;
    const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
    return v >= 0 ? v : null;
  } catch {
    return null;
  }
}

/** Takes a sharp photo (glasses first, else the phone) and gives its `file://` uri. */
export type PhotoTaker = () => Promise<string | undefined>;

async function answer(call: ToolCall, lang: Lang, clock: boolean, takePhoto?: PhotoTaker): Promise<Record<string, unknown>> {
  if (call.name === 'take_photo') {
    // The live video is too small to read; a full photo read on the phone is not.
    const uri = takePhoto ? await takePhoto() : undefined;
    if (!uri) return { error: lang === 'ar' ? 'ما قدرت آخذ صورة' : "Couldn't take a photo" };
    const text = Glasses ? await Glasses.recognizeText(uri, ['ar-SA', 'en-US']).catch(() => '') : '';
    return text.trim() ? { text: text.trim().slice(0, 3000) } : { text: '', note: lang === 'ar' ? 'ما فيه كلام واضح في الصورة' : 'No readable text in the photo' };
  }
  if (call.name === 'get_location') {
    const place = await describePlace(lang);
    return place ? { location: place } : { error: lang === 'ar' ? 'ما قدرت أحدد الموقع، خله يسمح للتطبيق بالموقع' : 'Location unavailable; ask them to allow location access' };
  }
  if (call.name === 'find_nearby') {
    const kind = String(call.args?.kind ?? '') as PlaceKind;
    if (!(kind in KINDS)) return { error: `unknown kind ${kind}` };
    const [pos, h] = await Promise.all([currentPosition(), heading()]);
    if (!pos) return { error: lang === 'ar' ? 'ما قدرت أحدد الموقع' : 'Location unavailable' };
    const found = await findNearby(kind, { latitude: pos.coords.latitude, longitude: pos.coords.longitude }, lang);
    if (!found.length) return { places: [], note: lang === 'ar' ? `ما فيه ${KINDS[kind].ar.one} قريب` : `No ${KINDS[kind].en.one} nearby` };
    return {
      places: found.slice(0, 3).map((p) => ({
        name: p.name || KINDS[kind][lang].one,
        distance: distanceText(p.meters, lang),
        walk: walkText(p.meters, lang) || undefined,
        direction: directionText(p.bearing, h, lang, clock),
        street: p.street,
      })),
    };
  }
  return { error: `unknown tool ${call.name}` };
}

/** Answers every call in a `toolCall` event; a failing one reports its error instead of hanging the turn. */
export async function answerToolCalls(calls: ToolCall[], lang: Lang, clock: boolean, takePhoto?: PhotoTaker): Promise<{ functionResponses: Response[] }> {
  const functionResponses = await Promise.all(
    calls.map(async (call): Promise<Response> => {
      try {
        return { id: call.id, name: call.name, response: await answer(call, lang, clock, takePhoto) };
      } catch (e) {
        return { id: call.id, name: call.name, response: { error: e instanceof Error ? e.message : String(e) } };
      }
    }),
  );
  return { functionResponses };
}
