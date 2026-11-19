// Проверка спрайтов и контента: размеры 16x16, у каждого слова есть спрайт, у буквы — глиф 5x7,
// id не повторяются. Лист превью → tools/sprite-sheet.html (открыть и оценить глазами).
const path = require('path'), fs = require('fs');
const { PALETTE, SPRITES, LETTERS5x7 } = require(path.join(__dirname, '../src/sprites.js'));
const { TOPICS, ITEMS } = require(path.join(__dirname, '../src/content.js'));
let bad = 0, cells = '';
const err = (...a) => { console.error(...a); bad++; };
for (const [name, s] of Object.entries(SPRITES)) {
  const rows = s.rows.map(r => s.sym ? r + [...r].reverse().join('') : r);
  if (rows.length !== 16) err(name, 'строк:', rows.length);
  rows.forEach((r, i) => { if (r.length !== 16) err(name, 'строка', i, 'длина', r.length); });
  let px = '';
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === '.') return;
    if (ch !== 'X' && !PALETTE[ch]) err(name, 'нет цвета', ch);
    const c = ch === 'X' ? '#e43b44' : (PALETTE[ch] || '#ff00ff');
    px += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c}"/>`;
  }));
  cells += `<figure><svg viewBox="0 0 16 16" width="160" height="160" shape-rendering="crispEdges">${px}</svg><figcaption>${name}</figcaption></figure>`;
}
const ids = new Set(), topics = new Set(TOPICS.map(t => t.id));
for (const t of TOPICS) if (!SPRITES[t.icon]) err('тема', t.id, 'нет иконки', t.icon);
for (const it of ITEMS) {
  if (ids.has(it.id)) err('повтор id', it.id); ids.add(it.id);
  if (!topics.has(it.topic)) err(it.id, 'нет темы', it.topic);
  if (!SPRITES[it.sprite]) err(it.id, 'нет спрайта', it.sprite);
  if (it.letter && !LETTERS5x7[it.letter]) err(it.id, 'нет глифа 5x7');
  if (it.letter && !it.exRu) err(it.id, 'нет exRu');
}
for (const t of TOPICS) { const n = ITEMS.filter(i => i.topic === t.id).length; if (n < 4) err('в теме', t.id, 'меньше 4 слов:', n); }
fs.writeFileSync(path.join(__dirname, 'sprite-sheet.html'),
  `<!doctype html><meta charset=utf-8><style>body{background:#e8f4d8;font-family:sans-serif;display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;text-align:center}</style>${cells}`);
console.log(bad ? `Ошибок: ${bad}` : `Спрайты 16x16 ✓, контент ✓ (${TOPICS.length} тем, ${ITEMS.length} слов)`, '→ tools/sprite-sheet.html');
process.exit(bad ? 1 : 0);
