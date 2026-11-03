// Generates the short status sounds in assets/sounds (16-bit mono WAV).
// Run with: node scripts/make-earcons.js
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');

/** A sine note with a quick attack and exponential decay. */
function note(freq, ms, { gain = 0.5, decay = 6 } = {}) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const attack = Math.min(1, i / (RATE * 0.004));
    out[i] = Math.sin(2 * Math.PI * freq * t) * gain * attack * Math.exp((-decay * i) / n);
  }
  return out;
}

function silence(ms) {
  return new Float32Array(Math.round((RATE * ms) / 1000));
}

/** Filtered noise burst, for the shutter. */
function click(ms, gain = 0.6) {
  const n = Math.round((RATE * ms) / 1000);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = last * 0.6 + (Math.random() * 2 - 1) * 0.4;
    out[i] = last * gain * Math.exp((-8 * i) / n);
  }
  return out;
}

function concat(...parts) {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SOUNDS = {
  // mic opens: rising pair
  listen: concat(note(660, 70, { decay: 3 }), note(990, 110)),
  // mic closes, question sent: falling pair
  send: concat(note(990, 70, { decay: 3 }), note(660, 110)),
  // photo taken
  capture: concat(click(25), silence(30), click(35, 0.45)),
  // soft tick repeated while waiting for the answer
  think: note(1320, 45, { gain: 0.18, decay: 9 }),
  // something failed: low double buzz
  error: concat(note(220, 120, { gain: 0.55, decay: 2 }), silence(60), note(196, 160, { gain: 0.55, decay: 2 })),
  // all good / found it: rising arpeggio
  success: concat(note(784, 80, { decay: 3 }), note(988, 80, { decay: 3 }), note(1319, 180)),
  // glasses connection lost / back
  down: concat(note(880, 90, { decay: 3 }), note(587, 160)),
  up: concat(note(587, 90, { decay: 3 }), note(880, 160)),
  // sonar pings: off-center vs. straight ahead
  ping: note(740, 70, { gain: 0.45, decay: 5 }),
  pingAhead: note(1480, 70, { gain: 0.5, decay: 5 }),
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  fs.writeFileSync(path.join(OUT, `${name}.wav`), wav(samples));
}
console.log(`wrote ${Object.keys(SOUNDS).length} sounds to ${OUT}`);
