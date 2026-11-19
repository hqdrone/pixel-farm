// Автотест в headless Chrome (playwright): npm i -D playwright && npx playwright install chromium
// Запуск: node tools/playtest.js            — все проверки
//         node tools/playtest.js persist migrate — только выбранные (play, persist, migrate, broken)
// dist/ отдаётся локальным http-сервером, чтобы работали service worker и manifest. Скриншоты → tools/shots/
const path = require('path'), fs = require('fs'), http = require('http'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist'), SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { chromium } = require('playwright');
const KEY = 'pixelfarm-en-v1';
const only = process.argv.slice(2);
const want = n => !only.length || only.includes(n);

const failures = [];
function check(ok, msg) { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) failures.push(msg); }
const build = env => execFileSync('node', [path.join(ROOT, 'build.js')], { env: { ...process.env, ...env }, stdio: 'pipe' });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.m4a': 'audio/mp4', '.aac': 'audio/aac' };
function serve() {
  const srv = http.createServer((req, res) => {
    let f = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (f.endsWith('/')) f += 'index.html';
    const file = path.join(DIST, f);
    if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

async function newPage(browser, errs) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)/.test(m.text())) errs.push(m.text()); });
  return { ctx, pg };
}

async function createProfile(pg, name, shot) {
  await pg.waitForSelector('.welcome');
  if (shot) await pg.screenshot({ path: SHOTS + '/s0_welcome.png' });
  await pg.fill('.welcome input', name);
  await pg.click('.av >> nth=2');
  await pg.click('button:has-text("Начать")');
  await pg.waitForSelector('.farmwrap');
}

// Проходит один урок темы sel до конца и возвращается на карту
async function play(pg, sel, tag, shots = true) {
  await pg.click(sel); await pg.waitForTimeout(300);
  for (let step = 0; step < 80; step++) {
    const st = await pg.evaluate(() => { if (typeof L === 'undefined' || !L || !document.querySelector('.stage')) return 'done'; return L.queue[L.pos].type; });
    if (st === 'done') break;
    const pos = await pg.evaluate(() => L.pos);
    if (shots && ['spell', 'memory', 'listen', 'see'].includes(st)) await pg.screenshot({ path: `${SHOTS}/t_${tag}_${st}.png` });
    if (st === 'memory') {
      const n = await pg.$$eval('.card', c => c.length);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const done = await pg.$$eval('.card', (c, [i, j]) => c[i].classList.contains('done') || c[j].classList.contains('done'), [i, j]);
        if (done) continue;
        await pg.click(`.card >> nth=${i}`); await pg.click(`.card >> nth=${j}`); await pg.waitForTimeout(950);
      }
      await pg.waitForTimeout(1500); continue;
    }
    await pg.evaluate(() => {
      const t = L.queue[L.pos];
      if (t.type === 'intro') { document.querySelectorAll('.btn.green')[0].click(); return; }
      if (t.type === 'listen' || t.type === 'see') {
        const els = [...document.querySelectorAll('.choice')];
        const lbl = t.type === 'see' ? (t.it.letter || t.it.en) : (t.it.letter || null);
        let target = els.find(e => e.textContent === lbl);
        if (!target) { const ref = itemCanvas(t.it, 10).toDataURL(); target = els.find(e => e.querySelector('canvas') && e.querySelector('canvas').toDataURL() === ref); }
        target.click(); return;
      }
      if (t.type === 'spell') { for (const ch of t.it.en) { const btn = [...document.querySelectorAll('.tile:not(.used)')].find(b => b.textContent === ch); btn.click(); } }
    });
    // ждём перехода к следующему заданию (переход теперь ждёт конца озвучки)
    await pg.waitForFunction(p => typeof L === 'undefined' || !L || L.pos !== p || !document.querySelector('.stage'), pos, { timeout: 15000 });
    await pg.waitForTimeout(150);
  }
  await pg.waitForTimeout(400);
  if (shots) await pg.screenshot({ path: `${SHOTS}/r_${tag}.png` });
  if (await pg.$('.chestbox')) await pg.click('.chestbox', { force: true });
  await pg.click('button:has-text("На ферму")'); await pg.waitForTimeout(600);
}

const stored = pg => pg.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

(async () => {
  build();
  const srv = await serve();
  const URL0 = `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  // 1. Первый запуск + все темы
  if (want('play')) {
    console.log('play: первый запуск и все темы');
    const errs = [];
    const { ctx, pg } = await newPage(browser, errs);
    await pg.goto(URL0); await pg.waitForTimeout(500);
    await createProfile(pg, 'Маша', true);
    check(await pg.evaluate(() => DB.profiles.length) === 1, 'при первом запуске создан ровно один профиль');
    await pg.screenshot({ path: SHOTS + '/s2.png' });
    await play(pg, '.topic >> nth=0', 'letters');
    check(await pg.$$eval('.topic.locked', e => e.length) === 0, 'все темы открыты с первого урока');
    const audio = await pg.evaluate(() => ({ n: Object.keys(AUDIO.files).length, played: clipsPlayed }));
    check(audio.n > 0 && audio.played > 0, `в уроке звучат записи, а не голос телефона (записей ${audio.n}, проиграно ${audio.played})`);
    await play(pg, '.topic >> nth=1', 'animals');
    await play(pg, '.topic >> nth=1', 'animals2');
    await play(pg, '.topic >> nth=2', 'food');
    await play(pg, '.topic >> nth=3', 'colors');
    await pg.waitForTimeout(1500);
    await pg.screenshot({ path: SHOTS + '/s5.png' });
    await pg.click('button:has-text("←")'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: SHOTS + '/s1_home.png' });
    check(!!(await pg.$('.hint')), 'на главной есть подсказка «Добавь на главный экран»');
    await pg.evaluate(() => showInstallHelp('ios')); await pg.waitForTimeout(200);
    await pg.screenshot({ path: SHOTS + '/s7_install_ios.png' });
    await pg.click('button:has-text("Понятно")');
    await pg.evaluate(() => showInstallHelp('android')); await pg.waitForTimeout(200);
    await pg.screenshot({ path: SHOTS + '/s7_install_android.png' });
    await pg.click('button:has-text("Понятно")');
    await pg.click('text=Для родителей'); await pg.waitForTimeout(300);
    await pg.screenshot({ path: SHOTS + '/s6.png', fullPage: true });
    check(errs.length === 0, 'нет ошибок в консоли: ' + JSON.stringify(errs));
    await ctx.close();
  }

  // 2. Сохранность: урок → пересборка → перезагрузка → прогресс на месте (и офлайн тоже)
  if (want('persist')) {
    console.log('persist: прогресс переживает обновление приложения');
    const errs = [];
    const { ctx, pg } = await newPage(browser, errs);
    await pg.goto(URL0);
    await createProfile(pg, 'Петя');
    await pg.waitForTimeout(2500);
    const audioReq = () => pg.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.includes('/audio/')).length);
    const n0 = await audioReq();
    check(n0 > 0 && n0 <= 10, `при открытии скачаны только общие фразы, а не все записи (${n0})`);
    await play(pg, '.topic >> nth=0', 'persist', false);
    const n1 = await audioReq();
    check(n1 > n0 && n1 < await pg.evaluate(() => Object.keys(AUDIO.files).length), `урок скачал записи своих слов (${n1 - n0})`);
    const before = await stored(pg);
    const words = Object.keys(before.profiles[0].words).length;
    check(before.profiles[0].stars > 0 && words > 0, `после урока есть звёзды (${before.profiles[0].stars}) и слова (${words})`);
    await pg.evaluate(() => navigator.serviceWorker.ready);
    check(await pg.evaluate(() => !!navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(r => !!r.active)), 'service worker установлен');

    build({ BUILD_ID: 'persist-test-2' });
    await pg.reload(); await pg.waitForSelector('.prof');
    check(await pg.evaluate(() => BUILD) === 'persist-test-2', 'после пересборки загружается новая версия (сначала сеть)');
    const after = await stored(pg);
    check(JSON.stringify(after.profiles) === JSON.stringify(before.profiles), 'после пересборки и перезагрузки прогресс тот же');
    check((await pg.textContent('.prof .name')) === 'Петя', 'профиль на главном экране');

    await ctx.setOffline(true);
    await pg.reload(); await pg.waitForSelector('.prof');
    check(await pg.evaluate(() => DB.profiles[0].stars) === before.profiles[0].stars, 'офлайн приложение открывается из кэша, прогресс на месте');
    check(await pg.evaluate(async () => { const it = BY_ID[Object.keys(DB.profiles[0].words)[0]]; return !!(await getClip(AUDIO.files['en|' + it.en])); }), 'офлайн записи пройденных слов берутся из кэша');
    await ctx.setOffline(false);
    check(await pg.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('pixelfarm-app-')).length) === 1, 'старый кэш приложения удалён');
    check(errs.length === 0, 'нет ошибок в консоли: ' + JSON.stringify(errs));
    await ctx.close();
    build();
  }

  // 3. Миграция v1 → текущая схема
  if (want('migrate')) {
    console.log('migrate: данные прототипа (v1) переносятся без потерь');
    const errs = [];
    const { ctx, pg } = await newPage(browser, errs);
    const v1raw = fs.readFileSync(path.join(__dirname, 'fixtures/v1.json'), 'utf8');
    const v1 = JSON.parse(v1raw);
    await pg.goto(URL0);
    await pg.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [KEY, v1raw]);
    await pg.reload(); await pg.waitForSelector('.prof');
    const d = await stored(pg);
    check(d.schemaVersion === 2, 'schemaVersion = 2 записан в хранилище');
    check(d.profiles.length === 2 && d.profiles[0].name === 'Маша', 'оба профиля на месте');
    check(d.profiles[0].stars === 57 && d.profiles[0].streak === 4, 'звёзды и серия сохранились');
    check(JSON.stringify(d.profiles[0].words) === JSON.stringify(v1.profiles[0].words), 'слова и ступени повторения сохранились');
    check(JSON.stringify(d.profiles[0].decor) === JSON.stringify(v1.profiles[0].decor), 'украшения фермы сохранились');
    check(d.settings.ruVoice === false && d.settings.unlockAll === true && d.settings.rate === 0.7, 'настройки сохранились');
    const backups = await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pixelfarm-en-backup-')).map(k => [k, localStorage.getItem(k)]));
    check(backups.length === 1 && backups[0][1] === v1raw, 'перед миграцией сделана копия исходных данных');
    await pg.screenshot({ path: SHOTS + '/s8_migrated.png' });
    await pg.reload(); await pg.waitForSelector('.prof');
    check(await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pixelfarm-en-backup-')).length) === 1, 'повторная загрузка не мигрирует второй раз');
    check(errs.length === 0, 'нет ошибок в консоли: ' + JSON.stringify(errs));
    await ctx.close();
  }

  // 4. Битые данные: сохраняются в резервную копию, приложение начинает заново
  if (want('broken')) {
    console.log('broken: битые данные не теряются');
    const errs = [];
    const { ctx, pg } = await newPage(browser, errs);
    await pg.goto(URL0);
    await pg.evaluate(k => { localStorage.clear(); localStorage.setItem(k, '{"profiles":[{"name":"Ма'); }, KEY);
    await pg.reload(); await pg.waitForSelector('.welcome');
    const backups = await pg.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('pixelfarm-en-backup-')).map(k => localStorage.getItem(k)));
    check(backups.length === 1 && backups[0] === '{"profiles":[{"name":"Ма', 'битые данные скопированы в pixelfarm-en-backup-…');
    check(errs.length === 0, 'нет ошибок в консоли: ' + JSON.stringify(errs));
    await ctx.close();
  }

  await browser.close(); srv.close();
  console.log(failures.length ? `\nПРОВАЛЕНО: ${failures.length}` : '\nВсе проверки пройдены ✓');
  process.exit(failures.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
