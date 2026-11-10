import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { AccessibilityInfo, Platform } from 'react-native';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const ENDPOINT = `${URL}/functions/v1/mata-tts`;
const FETCH_TIMEOUT_MS = 8000;

export type SpeakOptions = { language?: string; rate?: number; onDone?: () => void };

/** `now`: a `speakNow` line, whose `onDone` still fires when it's cut off (callers await it). */
type Item = { text: string; opts: SpeakOptions; clip: Promise<File | null>; now?: boolean };

/**
 * Natural cloud voice (the `mata-tts` edge function) with the device voice as fallback.
 * Clips are fetched as soon as they're queued, so the next sentence is ready while
 * the current one plays. Mirrors the bits of `expo-speech` the app uses.
 */
// ---------- VoiceOver ----------
// With VoiceOver on, two voices would talk over each other (and VoiceOver's own rate, which
// blind users tune, would be ignored). So answers go out as VoiceOver announcements instead.

let screenReader = false;
// The app's own AI voice by default; VoiceOver's voice only when the user picks it.
let preferScreenReader = false;
AccessibilityInfo.isScreenReaderEnabled().then((on) => (screenReader = on));
AccessibilityInfo.addEventListener('screenReaderChanged', (on) => (screenReader = on));

/** Mirrors the "use VoiceOver's voice" setting. */
export function setPreferScreenReader(on: boolean) {
  preferScreenReader = on;
}

function viaScreenReader() {
  return Platform.OS === 'ios' && screenReader && preferScreenReader;
}

let announcements: { text: string; done: () => void }[] = [];
AccessibilityInfo.addEventListener('announcementFinished', ({ announcement }) => {
  const i = announcements.findIndex((a) => a.text === announcement);
  if (i === -1) return;
  const [a] = announcements.splice(i, 1);
  a.done();
});

function announce(text: string, onDone?: () => void) {
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    onDone?.();
  };
  // VoiceOver doesn't always report back (e.g. the user swiped away); don't hang on it.
  const timer = setTimeout(done, 3000 + text.length * 120);
  announcements.push({ text, done });
  AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
}

/** Like `Speech.stop()` firing `onStopped`, cut-off announcements still report done. */
function stopAnnouncements() {
  const cut = announcements;
  announcements = [];
  cut.forEach((a) => a.done());
  if (viaScreenReader()) AccessibilityInfo.announceForAccessibility(' ');
}

// ---------- device voice ----------
// iOS ships a basic voice per language; an Enhanced one sounds far more natural and starts just
// as fast, so use it whenever the user has downloaded one.

let bestVoices: Record<string, string> = {};
Speech.getAvailableVoicesAsync()
  .then((voices) => {
    for (const v of voices) {
      const lang = v.language.slice(0, 2);
      if (v.quality === Speech.VoiceQuality.Enhanced || !bestVoices[lang]) bestVoices[lang] = v.identifier;
    }
  })
  .catch(() => {});

/** The backup voice follows the text, so English read on request isn't spoken by the Arabic voice. */
function languageOf(text: string, wanted = 'ar-SA') {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (arabic > latin) return wanted.startsWith('ar') ? wanted : 'ar-SA';
  if (latin > arabic) return wanted.startsWith('ar') ? 'en-US' : wanted;
  return wanted;
}

function deviceSpeak(text: string, opts: SpeakOptions, done: () => void) {
  const language = languageOf(text, opts.language);
  const voice = bestVoices[language.slice(0, 2)];
  Speech.speak(text, { language, voice, rate: opts.rate, onDone: done, onStopped: done, onError: done });
}

/**
 * Short guidance and live-mode lines ("turn a little right"): the same AI voice as answers,
 * cut in front of the queue. These phrases repeat a lot, so their clips are kept and replay
 * instantly. `interrupt` cuts off whatever is being said first.
 */
export function speakNow(text: string, opts: SpeakOptions & { interrupt?: boolean } = {}) {
  if (opts.interrupt) stop();
  if (viaScreenReader()) return announce(text, opts.onDone);
  queue.unshift({ text, opts, clip: fetchClip(text, opts.rate ?? 1, true), now: true });
  if (!busy) next();
}

// ---------- cloud voice ----------

let gen = 0;
let seq = 0;
let queue: Item[] = [];
let busy = false;
let player: AudioPlayer | null = null;
let onClipEnd: (() => void) | null = null;
let current: Item | null = null;

// Clips of short repeated lines, by rate and text.
const CACHE_MAX = 60;
const cache = new Map<string, File>();
const cached = new Set<string>();

function getPlayer() {
  if (!player) {
    player = createAudioPlayer();
    player.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish || s.error) {
        const cb = onClipEnd;
        onClipEnd = null;
        cb?.();
      }
    });
  }
  return player;
}

async function fetchClip(text: string, rate: number, keep = false): Promise<File | null> {
  const key = `${rate}|${text}`;
  const hit = cache.get(key);
  if (hit?.exists) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ANON}`, apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speed: rate }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const file = new File(Paths.cache, `tts-${++seq}.mp3`);
    await file.write(new Uint8Array(await res.arrayBuffer()));
    if (keep && text.length <= 120) {
      cache.set(key, file);
      cached.add(file.uri);
      if (cache.size > CACHE_MAX) {
        const [oldKey, old] = cache.entries().next().value!;
        cache.delete(oldKey);
        cached.delete(old.uri);
        try {
          old.delete();
        } catch {}
      }
    }
    return file;
  } catch (e) {
    console.warn('cloud voice failed, using device voice', e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Frees the player so it stops holding the iOS audio session (the mic needs it next). */
function release() {
  onClipEnd = null;
  player?.remove();
  player = null;
}

function discard(file: File | null) {
  if (file && cached.has(file.uri)) return;
  try {
    file?.delete();
  } catch {}
}

async function next() {
  const item = queue.shift();
  current = item ?? null;
  if (!item) {
    busy = false;
    release();
    return;
  }
  busy = true;
  const myGen = gen;
  const file = await item.clip;
  if (myGen !== gen) return discard(file);

  const done = () => {
    discard(file);
    if (myGen !== gen) return;
    item.opts.onDone?.();
    next();
  };

  if (!file) {
    deviceSpeak(item.text, item.opts, done);
    return;
  }
  const p = getPlayer();
  onClipEnd = done;
  p.replace({ uri: file.uri });
  p.play();
}

export function speak(text: string, opts: SpeakOptions = {}) {
  if (viaScreenReader()) return announce(text, opts.onDone);
  queue.push({ text, opts, clip: fetchClip(text, opts.rate ?? 1) });
  if (!busy) next();
}

/**
 * Stops playback and drops everything queued. Queued cloud clips never call `onDone`; lines
 * from `speakNow` and VoiceOver announcements do, as if they had finished.
 */
export function stop() {
  gen += 1;
  const cut = [current, ...queue].filter((i): i is Item => !!i?.now);
  for (const item of queue) item.clip.then(discard);
  queue = [];
  current = null;
  cut.forEach((i) => i.opts.onDone?.());
  busy = false;
  release();
  Speech.stop();
  stopAnnouncements();
}
