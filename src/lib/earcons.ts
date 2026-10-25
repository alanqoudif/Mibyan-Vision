import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

/**
 * Short status sounds, so silence never has to mean "is it working?".
 * Each sound gets its own player, created on first use, so they can overlap with speech.
 */
const SOURCES = {
  listen: require('../../assets/sounds/listen.wav'),
  send: require('../../assets/sounds/send.wav'),
  capture: require('../../assets/sounds/capture.wav'),
  think: require('../../assets/sounds/think.wav'),
  error: require('../../assets/sounds/error.wav'),
  success: require('../../assets/sounds/success.wav'),
  down: require('../../assets/sounds/down.wav'),
  up: require('../../assets/sounds/up.wav'),
  ping: require('../../assets/sounds/ping.wav'),
  pingAhead: require('../../assets/sounds/pingAhead.wav'),
};

export type Earcon = keyof typeof SOURCES;

const THINK_EVERY_MS = 1100;

let enabled = true;
const players: Partial<Record<Earcon, AudioPlayer>> = {};
let thinkTimer: ReturnType<typeof setInterval> | null = null;

/** Mirrors the "sounds" setting. Sonar pings ignore it: they are the feature itself. */
export function setEnabled(on: boolean) {
  enabled = on;
  if (!on) stopThinking();
}

function playNow(name: Earcon) {
  try {
    const p = (players[name] ??= createAudioPlayer(SOURCES[name]));
    p.seekTo(0);
    p.play();
  } catch (e) {
    console.warn('earcon failed', name, e);
  }
}

export function play(name: Earcon) {
  if (enabled) playNow(name);
}

/** Sonar pings play even with status sounds off. */
export function ping(ahead: boolean) {
  playNow(ahead ? 'pingAhead' : 'ping');
}

/** A soft tick every second until `stopThinking`, so a slow answer doesn't sound like a hang. */
export function startThinking() {
  if (!enabled || thinkTimer) return;
  thinkTimer = setInterval(() => playNow('think'), THINK_EVERY_MS);
}

export function stopThinking() {
  if (thinkTimer) clearInterval(thinkTimer);
  thinkTimer = null;
}
