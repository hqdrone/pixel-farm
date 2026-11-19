// Записывает озвучку всех слов и фраз приложения встроенным голосом macOS → audio/*.aac + audio/index.json.
// Формат: AAC 32 кбит/с моно в ADTS (.aac) без контейнера m4a: m4a добавлял ~4 КБ пустого места к каждому файлу.
// Слово ≈ 2,5 КБ, со своей медленной версией ≈ 5,5 КБ → 1000 слов ≈ 5–6 МБ.
// Запускать на Mac после добавления новых слов:  node tools/record-audio.js
//   уже записанные фразы пропускаются; при смене голоса или с --force перезаписывается всё.
//   VOICE="Ava (Premium)" node tools/record-audio.js --force — выбрать голос вручную.
// Голос получше: Системные настройки → Универсальный доступ → Устный контент → Системный голос →
//   Управлять голосами → English (US) → скачать Ava/Zoe (Premium или Enhanced). Скрипт возьмёт его сам.
// Записи лежат в репозитории (GitHub Actions работает на Linux, там нет `say`), build.js копирует их в dist/.
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'audio');
const force = process.argv.includes('--force');

// ---- что говорит приложение: берём прямо из src/app.html ----
const src = fs.readFileSync(path.join(ROOT, 'src/app.html'), 'utf8');
const grab = re => { const m = src.match(re); if (!m) throw new Error('не найдено в app.html: ' + re); return m[0]; };
const sandbox = {};
vm.runInNewContext(grab(/const ITEMS = \[[\s\S]*?\n\];/) + '\n' + grab(/const PRAISE = \[.*\];/) + '\nthis.ITEMS=ITEMS; this.PRAISE=PRAISE;', sandbox);
const { ITEMS, PRAISE } = sandbox;

// key: «язык|текст» — так приложение ищет запись. en-slow — медленно, для задания «собери слово».
const phrases = new Map();
const add = (lang, text, opts = {}) => phrases.set(lang + '|' + text, { lang, text, ...opts });
for (const it of ITEMS) {
  if (it.letter) {
    add('en', it.letter, { letter: true });
    add('en', `${it.letter} is for ${it.ex}`, { letter: true });
  } else {
    add('en', it.en);
    add('en-slow', it.en);
  }
}
PRAISE.forEach(p => add('en', p));
add('ru', 'Урок пройден!');

// ---- голос ----
const voices = execFileSync('say', ['-v', '?'], { encoding: 'utf8' }).split('\n')
  .map(l => l.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/)).filter(Boolean).map(m => ({ name: m[1].trim(), lang: m[2] }));
const enUS = voices.filter(v => v.lang === 'en_US');
const EN = process.env.VOICE || (enUS.find(v => /Premium/.test(v.name)) || enUS.find(v => /Enhanced/.test(v.name)) ||
  enUS.find(v => v.name === 'Samantha') || enUS[0]).name;
const RU = (voices.find(v => v.lang === 'ru_RU' && /Premium|Enhanced/.test(v.name)) || voices.find(v => v.lang === 'ru_RU') || {}).name;
console.log('Голос:', EN, '| русский:', RU || 'нет');

// ---- запись ----
fs.mkdirSync(OUT, { recursive: true });
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const indexFile = path.join(OUT, 'index.json');
const old = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : { files: {} };
const tmp = path.join(os.tmpdir(), 'pixelfarm-say.wav');
// голос сменился (например, скачан Premium) → перезаписать всё
const redo = force || old.voice !== EN || (old.voiceRu || null) !== (RU || null);
if (redo && !force && old.voice) console.log(`Голос сменился (${old.voice} → ${EN}), перезаписываю всё`);

// ---- WAV: say пишет 16 бит моно 22050 Гц; склейка нужна для фраз «A is for apple» ----
function sayWav(text, voice, rate) {
  execFileSync('say', ['-v', voice, '-r', String(rate), '--file-format=WAVE', '--data-format=LEI16@22050', '-o', tmp, text]);
  const b = fs.readFileSync(tmp); let o = 12;
  while (o < b.length) { const id = b.toString('ascii', o, o + 4), n = b.readUInt32LE(o + 4); if (id === 'data') return Buffer.from(b.subarray(o + 8, o + 8 + n)); o += 8 + n + (n & 1); }
  throw new Error('say: в WAV нет данных');
}
function writeWav(pcm, f) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(22050, 24); h.writeUInt32LE(44100, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(f, Buffer.concat([h, pcm]));
}
const silence = ms => Buffer.alloc(Math.round(22050 * ms / 1000) * 2);
// Название буквы. Важно: «A» голос читает как «capital A», «ay» — как «eye».
// Строчная буква отдельно — это её название («эй», «би»), проверено для всех 26 букв (Ava, Zoe, Samantha).
const letterName = L => L.toLowerCase();

const files = {};
let made = 0, kept = 0;
for (const [key, p] of phrases) {
  if (p.lang === 'ru' && !RU) continue;
  const name = (p.lang === 'ru' ? 'ru-' + crypto.createHash('sha1').update(p.text).digest('hex').slice(0, 8)
    : (p.lang === 'en-slow' ? 'slow-' : '') + slug(p.text)) + '.aac';
  const file = path.join(OUT, name);
  if (!redo && old.files[key] && fs.existsSync(file)) { files[key] = old.files[key]; kept++; continue; }
  const voice = p.lang === 'ru' ? RU : EN;
  const rate = p.lang === 'en-slow' ? 85 : p.lang === 'ru' ? 175 : 140; // слов в минуту: спокойно для начинающих
  let pcm;
  const m = p.letter && p.text.match(/^([A-Z])( .+)?$/);
  if (m && !m[2]) pcm = sayWav(letterName(m[1]), voice, rate);                       // «A» → «эй»
  else if (m) pcm = Buffer.concat([sayWav(letterName(m[1]), voice, rate), silence(120), sayWav(m[2].trim(), voice, rate)]); // «эй» + «is for apple»
  else pcm = sayWav(p.text, voice, rate);
  writeWav(pcm, tmp);
  execFileSync('afconvert', ['-f', 'adts', '-d', 'aac', '-b', '32000', tmp, file]);
  const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
  files[key] = name + '?v=' + hash; // ?v= — чтобы телефон скачал запись заново после перезаписи
  made++;
}
// записи, которые больше не нужны, удаляем
const used = new Set(Object.values(files).map(f => f.split('?')[0]));
for (const f of fs.readdirSync(OUT)) if (/\.(m4a|aac)$/.test(f) && !used.has(f)) fs.unlinkSync(path.join(OUT, f));
fs.writeFileSync(indexFile, JSON.stringify({ voice: EN, voiceRu: RU || null, files }, null, 1) + '\n');
const size = [...used].reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`Записано: ${made}, без изменений: ${kept}, всего ${used.size} файлов, ${Math.round(size / 1024)} КБ → audio/`);
