// Сборка: src/app.html + src/sprites.js + src/content.js → dist/index.html (один самодостаточный файл),
// плюс PWA-файлы: manifest.json, sw.js, иконки PNG (рисуются из спрайта, без картинок в репозитории).
const fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const root = __dirname, dist = path.join(root, 'dist');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const sprites = read('src/sprites.js');
const app = read('src/app.html');
if (!app.includes('/*SPRITES*/')) throw new Error('В src/app.html нет метки /*SPRITES*/');

const content = read('src/content.js');
if (!app.includes('/*CONTENT*/')) throw new Error('В src/app.html нет метки /*CONTENT*/');
let html = app.replace('/*SPRITES*/', () => sprites).replace('/*CONTENT*/', () => content);
// Версия сборки: хэш содержимого (или BUILD_ID из окружения, им пользуется тест сохранности)
const BUILD = process.env.BUILD_ID || crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
html = html.replace('__BUILD__', BUILD);

fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.writeFileSync(path.join(dist, 'sw.js'), read('src/sw.js').replace('__BUILD__', BUILD));
fs.writeFileSync(path.join(dist, 'manifest.json'), read('src/manifest.json'));
fs.writeFileSync(path.join(dist, '.nojekyll'), ''); // GitHub Pages: отдать файлы как есть
fs.rmSync(path.join(dist, 'audio'), { recursive: true, force: true }); // озвучку записями убрали

// ---- иконки: спрайт кошки на траве, PNG кодируется вручную (zlib есть в Node) ----
const { PALETTE, SPRITES } = require(path.join(root, 'src/sprites.js'));
function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }
function crc32(buf) {
  let c, crc = ~0;
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function iconPNG(size, spriteName) {
  const s = SPRITES[spriteName];
  const rows = s.sym ? s.rows.map(r => r + [...r].reverse().join('')) : s.rows;
  const scale = Math.floor(size * 0.6 / 16), off = Math.floor((size - 16 * scale) / 2);
  const cell = Math.max(1, Math.round(size / 12)); // клетка травы, как фон приложения
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let col = ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) ? [0x77, 0xc0, 0x4b] : [0x7e, 0xc8, 0x50];
      const sx = Math.floor((x - off) / scale), sy = Math.floor((y - off) / scale);
      if (sx >= 0 && sx < 16 && sy >= 0 && sy < 16 && x >= off && y >= off) {
        const ch = rows[sy][sx];
        if (ch !== '.') col = hex(ch === 'X' ? '#e43b44' : PALETTE[ch]);
      }
      raw.set(col, y * (size * 3 + 1) + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2; // 8 бит, RGB
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]])
  fs.writeFileSync(path.join(dist, file), iconPNG(size, 'cat'));

console.log('OK → dist/ (index.html, sw.js, manifest.json, иконки), версия', BUILD);
