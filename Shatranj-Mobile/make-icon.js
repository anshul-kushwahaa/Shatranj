// Generates the app icons — a gold chess pawn on the app's dark navy.
// Pure Node (zlib PNG encoder), no image libraries needed.
// Run once with:  node make-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, 'assets');
const NAVY = [26, 26, 46];      // #1a1a2e
const GOLD = [226, 185, 111];   // #e2b96f
const WHITE = [255, 255, 255];

// ── PNG encoding ──────────────────────────────
let _tbl = null;
function crcTable() {
  if (_tbl) return _tbl;
  _tbl = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    _tbl[n] = c;
  }
  return _tbl;
}
function crc32(buf) {
  const t = crcTable();
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;           // 8-bit, RGBA
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;              // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── The pawn, described in a 0..1 square ──────
function inPawn(x, y) {
  const ax = Math.abs(x - 0.5);
  // head
  const dx = x - 0.5, dy = y - 0.275;
  if (dx * dx + dy * dy <= 0.135 * 0.135) return true;
  // collar
  if (y >= 0.395 && y <= 0.452 && ax <= 0.125) return true;
  // body — flares out toward the base
  if (y > 0.452 && y <= 0.705) {
    const t = (y - 0.452) / (0.705 - 0.452);
    if (ax <= 0.095 + 0.10 * Math.pow(t, 1.8)) return true;
  }
  // base — rounded bottom corners
  if (y > 0.705 && y <= 0.805 && ax <= 0.265) {
    const r = 0.035;
    if (y > 0.805 - r && ax > 0.265 - r) {
      const cx = 0.265 - r, cy = 0.805 - r;
      return (ax - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    return true;
  }
  return false;
}
// rounded-square mask for the background
function inRounded(x, y, r) {
  const ax = Math.abs(x - 0.5), ay = Math.abs(y - 0.5), lim = 0.5 - r;
  if (ax <= lim || ay <= lim) return ax <= 0.5 && ay <= 0.5;
  return (ax - lim) ** 2 + (ay - lim) ** 2 <= r * r;
}

// ── Render ────────────────────────────────────
function render(file, size, { bg, fg, scale = 1, radius = 0 }) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4;                                   // supersampling for smooth edges
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let fgHits = 0, bgHits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          if (bg && (radius > 0 ? inRounded(u, v, radius) : true)) bgHits++;
          const shx = (u - 0.5) / scale + 0.5, shy = (v - 0.5) / scale + 0.5;
          if (inPawn(shx, shy)) fgHits++;
        }
      }
      const n = SS * SS;
      const fgA = fgHits / n, bgA = bgHits / n;
      // composite pawn over background
      const a = Math.max(fgA, bg ? bgA : 0);
      let r, g, b;
      if (a === 0) { r = g = b = 0; }
      else if (!bg) { r = fg[0]; g = fg[1]; b = fg[2]; }
      else {
        const w = fgA;                              // pawn coverage wins
        r = fg[0] * w + bg[0] * (1 - w);
        g = fg[1] * w + bg[1] * (1 - w);
        b = fg[2] * w + bg[2] * (1 - w);
      }
      const i = (py * size + px) * 4;
      buf[i] = Math.round(r); buf[i+1] = Math.round(g); buf[i+2] = Math.round(b);
      buf[i+3] = Math.round(a * 255);
    }
  }
  const p = path.join(OUT, file);
  fs.writeFileSync(p, encodePng(size, size, buf));
  console.log(`  ${file.padEnd(30)} ${size}×${size}  ${(fs.statSync(p).size/1024).toFixed(1)} KB`);
}

console.log('Generating icons:');
render('icon.png',                      1024, { bg: NAVY, fg: GOLD, scale: 0.78 });
render('favicon.png',                     64, { bg: NAVY, fg: GOLD, scale: 0.80 });
render('splash-icon.png',                512, { bg: null, fg: GOLD, scale: 0.90 });
render('android-icon-foreground.png',   1024, { bg: null, fg: GOLD, scale: 0.58 });
render('android-icon-monochrome.png',   1024, { bg: null, fg: WHITE, scale: 0.58 });
render('android-icon-background.png',   1024, { bg: NAVY, fg: NAVY, scale: 0.0001 });
console.log('Done →', OUT);
