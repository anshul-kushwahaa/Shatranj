// Generates the game's sound effects as WAV files.
// Mirrors the tones the web version synthesizes with the Web Audio API.
// Run once with:  node make-sounds.js
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'assets', 'sounds');
const SR = 44100;

// [name, frequency, gain, duration(s)] — matches script.js playSound()
const SOUNDS = [
  ['move',     440, 0.20, 0.10],
  ['capture',  220, 0.40, 0.20],
  ['check',    660, 0.30, 0.30],
  ['castle',   520, 0.30, 0.15],
  ['gameover', 180, 0.50, 0.60],
];

function writeWav(name, freq, gain, dur) {
  const n = Math.floor(SR * dur);
  const data = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // exponential decay, like gain.exponentialRampToValueAtTime on the web
    const env = Math.pow(0.001 / gain, t / dur) * gain;
    // tiny fade-in avoids a click at the start
    const fade = Math.min(1, t / 0.005);
    const v = Math.sin(2 * Math.PI * freq * t) * env * fade;
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), i * 2);
  }

  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);        // PCM
  h.writeUInt16LE(1, 22);        // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);   // byte rate
  h.writeUInt16LE(2, 32);        // block align
  h.writeUInt16LE(16, 34);       // bits per sample
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);

  const file = path.join(OUT, `${name}.wav`);
  fs.writeFileSync(file, Buffer.concat([h, data]));
  console.log(`  ${name}.wav  ${freq}Hz  ${(fs.statSync(file).size / 1024).toFixed(1)} KB`);
}

fs.mkdirSync(OUT, { recursive: true });
console.log('Generating sounds:');
SOUNDS.forEach(s => writeWav(...s));
console.log('Done →', OUT);
