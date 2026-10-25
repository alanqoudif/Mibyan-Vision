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

type Item = { text: string; opts: SpeakOptions; clip: Promise<File | null> };

/**
 * Natural cloud voice (the `mata-tts` edge function) with the device voice as fallback.
 * Clips are fetched as soon as they're queued, so the next sentence is ready while
 * the current one plays. Mirrors the bits of `expo-speech` the app uses.
 */
// ---------- VoiceOver ----------
// With VoiceOver on, two voices would talk over each other (and VoiceOver's own rate, which
// blind users tune, would be ignored). So answers go out as VoiceOver announcements instead.

let screenReader = false;
let preferScreenReader = true;
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

/**
 * The device voice, which starts instantly: for short live-mode and guidance lines.
 * `interrupt` cuts off whatever is being said first.
 */
export function speakNow(text: string, opts: SpeakOptions & { interrupt?: boolean } = {}) {
  if (opts.interrupt) stop();
  if (viaScreenReader()) return announce(text, opts.onDone);
  const done = () => opts.onDone?.();
  Speech.speak(text, { language: opts.language ?? 'ar-SA', rate: opts.rate, onDone: done, onStopped: done, onError: done });
}

// ---------- cloud voice ----------

let gen = 0;
let seq = 0;
let queue: Item[] = [];
let busy = false;
let player: AudioPlayer | null = null;
let onClipEnd: (() => void) | null = null;

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

async function fetchClip(text: string, rate: number): Promise<File | null> {
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
  try {
    file?.delete();
  } catch {}
}

async function next() {
  const item = queue.shift();
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
    Speech.speak(item.text, { language: item.opts.language ?? 'ar-SA', rate: item.opts.rate, onDone: done, onError: done });
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
  for (const item of queue) item.clip.then(discard);
  queue = [];
  busy = false;
  release();
  Speech.stop();
  stopAnnouncements();
}
