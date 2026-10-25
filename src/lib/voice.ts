import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

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

function discard(file: File | null) {
  try {
    file?.delete();
  } catch {}
}

async function next() {
  const item = queue.shift();
  if (!item) {
    busy = false;
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
  queue.push({ text, opts, clip: fetchClip(text, opts.rate ?? 1) });
  if (!busy) next();
}

/** Stops playback and drops everything queued; pending `onDone` callbacks never fire. */
export function stop() {
  gen += 1;
  for (const item of queue) item.clip.then(discard);
  queue = [];
  busy = false;
  onClipEnd = null;
  player?.pause();
  Speech.stop();
}
