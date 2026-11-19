// Проверка спрайтов: размеры 16x16 + лист превью tools/sprite-sheet.html (открыть в браузере)
const path = require('path'), fs = require('fs');
const { PALETTE, SPRITES } = require(path.join(__dirname, '../src/sprites.js'));
let bad = 0, cells = '';
for (const [name, s] of Object.entries(SPRITES)) {
  const rows = s.rows.map(r => s.sym ? r + [...r].reverse().join('') : r);
  if (rows.length !== 16) { console.error(name, 'строк:', rows.length); bad++; }
  rows.forEach((r, i) => { if (r.length !== 16) { console.error(name, 'строка', i, 'длина', r.length); bad++; } });
  let px = '';
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    const c = ch === 'X' ? '#e43b44' : (PALETTE[ch] || '#ff00ff');
    px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
  }));
  cells += `<figure><svg viewBox="0 0 16 16" width="160" height="160" shape-rendering="crispEdges">${px}</svg><figcaption>${name}</figcaption></figure>`;
}
fs.writeFileSync(path.join(__dirname, 'sprite-sheet.html'),
  `<!doctype html><meta charset=utf-8><style>body{background:#e8f4d8;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;text-align:center}</style>${cells}`);
console.log(bad ? `Ошибок: ${bad}` : 'Все спрайты 16x16 ✓', '→ tools/sprite-sheet.html');
process.exit(bad ? 1 : 0);
