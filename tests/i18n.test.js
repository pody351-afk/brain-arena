// اختبارات اللغتين (عربي / English): تغطية الترجمة، كل الشاشات بالإنجليزي من غير عربي متبقي، الاتجاه، الحفظ، والمقاسات.
// التشغيل: NODE_PATH=$(npm root -g) node tests/i18n.test.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-')), 'data.json');
const { server } = require(path.join(ROOT, 'server', 'server.js'));

let pass = 0, fail = 0; const failures = [];
const check = (c, n, x = '') => { if (c) { pass++; console.log('PASS ', n); } else { fail++; failures.push(n); console.log('FAIL ', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 6000, step = 50) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(step); } return false; };

// نصوص بتفضل عربي في اللغتين (محتوى لعبة الكلمات، أسماء اللاعبين...) — مفاتيح استخرجها السكربت لكن مش للترجمة
const NOT_TRANSLATED = new Set(['حلم', 'قرب', 'عربي', 'بحار', 'ساحر', 'كتاب', 'كرسي', 'مكتبا', 'مدرسا', 'ملعبا', 'ب', 'ق', 'ل', 'و', '؟', '،', 'العربية']);

const URL = 'file://' + path.join(ROOT, 'index.html');
async function newPage(browser, { locale = 'en-US', vp = { width: 390, height: 844 }, q = '' } = {}) {
  const ctx = await browser.newContext({ locale, viewport: vp, hasTouch: true, isMobile: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message + ' @ ' + String(e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.dialogs = []; page.on('dialog', d => { page.dialogs.push(d.message()); d.accept(); });
  await page.goto(URL + q); await sleep(350);
  return page;
}
// كل نص عربي ظاهر (عقد نصوص + خصائص) برّه عناصر translate="no"
const arabicLeft = page => page.evaluate(() => {
  const AR = /[؀-ۿ]/, out = [];
  const skip = n => { for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) if (e.getAttribute && e.getAttribute('translate') === 'no') return true; return false; };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) { const n = w.currentNode; if (!/^(SCRIPT|STYLE)$/.test(n.parentElement.tagName) && AR.test(n.nodeValue) && !skip(n)) out.push(n.nodeValue.trim()); }
  for (const el of document.querySelectorAll('[aria-label],[placeholder],[title]')) for (const a of ['aria-label', 'placeholder', 'title']) { const v = el.getAttribute(a); if (v && AR.test(v) && !skip(el)) out.push(a + ':' + v); }
  return [...new Set(out)];
});
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const go = async (p, id) => { await p.evaluate(i => __mal3ab.App.show(i), id); await sleep(250); };

(async () => {
  /* ---------- 1. تغطية: كل نص عربي في الكود ليه ترجمة ---------- */
  cp.execFileSync('python3', [path.join(ROOT, 'scripts', 'extract-strings.py')], { cwd: ROOT });
  const keys = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'strings.json'), 'utf8')));
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'i18n-en.js'), 'utf8') + '\nthis.EN = I18N_EN;', ctx);
  const EN = ctx.EN;
  const junk = k => k.length > 300 || /\n|function|const |=>/.test(k) || /^PLAN /.test(k); // لخبطة من تحليل الكود مش نصوص حقيقية
  const missing = keys.filter(k => !junk(k) && !NOT_TRANSLATED.has(k) && !(k in EN));
  check(missing.length === 0, `كل النصوص العربية (${keys.length}) ليها ترجمة`, missing.slice(0, 15).join(' | '));
  const badPh = Object.keys(EN).filter(k => k.split('{}').length !== EN[k].split(/\{!?\}/).length);
  check(badPh.length === 0, 'عدد {} متطابق بين العربي والإنجليزي', badPh.join(' | '));
  const arInEn = Object.entries(EN).filter(([k, v]) => /[؀-ۿ]/.test(v) && v !== k).map(([k]) => k);
  check(arInEn.length === 0, 'مفيش حروف عربي جوه الترجمات الإنجليزية', arInEn.join(' | '));

  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const SRV = 'ws://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  /* ---------- 2. اللغة والاتجاه واختيار الجهاز ---------- */
  const A = await newPage(browser, { locale: 'ar-EG' });
  check(await A.evaluate(() => document.documentElement.dir === 'rtl' && document.documentElement.lang === 'ar'), 'جهاز عربي: اللعبة عربي ويمين لشمال');
  check(/ملعب المخ/.test(await A.locator('#home h1').innerText()) && await A.title() === 'ملعب المخ', 'العربي زي ما هو (العنوان)');
  check((await A.locator('#langQuick').innerText()) === 'EN', 'زرار اللغة السريع بيقول EN في العربي');
  const E = await newPage(browser, { locale: 'en-US', q: '?server=' + encodeURIComponent(SRV) });
  check(await E.evaluate(() => document.documentElement.dir === 'ltr' && document.getElementById('app').dir === 'ltr' && document.documentElement.lang === 'en'), 'جهاز إنجليزي: اللعبة إنجليزي ويسار لليمين');
  check(await E.title() === 'Brain Arena' && /Brain Arena/.test(await E.locator('#home h1').innerText()), 'العنوان بالإنجليزي');
  check((await E.locator('#langQuick').innerText()) === 'عربي', 'زرار اللغة السريع بيقول «عربي» في الإنجليزي');
  await E.locator('#langQuick').tap(); await sleep(600);
  check(await E.evaluate(() => document.documentElement.dir === 'rtl' && store.get('lang') === 'ar'), 'الزرار السريع بيبدّل للعربي ويحفظ الاختيار');
  await E.reload(); await sleep(400);
  check(await E.evaluate(() => document.documentElement.lang === 'ar'), 'الاختيار بيفضل بعد إعادة التحميل (حتى لو الجهاز إنجليزي)');
  await go(E, 'settings'); await E.tap('#langBtn'); await sleep(600);
  check(await E.evaluate(() => document.documentElement.lang === 'en' && store.get('lang') === 'en'), 'تبديل اللغة من الإعدادات');
  check((await E.evaluate(() => I18N.t('أحسن نتيجة ليك: 62'))) === 'Your best: 62', 'ترجمة جزئية: نص + رقم');
  check((await E.evaluate(() => I18N.t('جولة 3 / 5'))) === 'Round 3 / 5', 'قالب فيه أرقام');
  check((await E.evaluate(() => I18N.t('نص إنجليزي 42'))) === 'نص إنجليزي 42', 'نص مالوش ترجمة بيفضل زي ما هو (مفيش تخريب)');

  /* ---------- 3. كل الشاشات بالإنجليزي من غير عربي متبقي ---------- */
  await E.evaluate(() => { store.set('name', 'Sam'); });
  const left = {};
  const scan = async name => { const l = await arabicLeft(E); if (l.length) left[name] = l; };
  await E.reload(); await sleep(400); await scan('home');
  await go(E, 'map'); await scan('map');
  await go(E, 'profile'); await scan('profile');
  await go(E, 'settings'); await scan('settings');
  await go(E, 'quests'); await scan('quests');
  await go(E, 'online'); await scan('online');
  await go(E, 'social'); await sleep(500); await scan('social-join');
  await go(E, 'home');
  await E.evaluate(() => __mal3ab.App.dailySheet()); await sleep(300); await scan('daily-sheet'); await E.evaluate(() => __mal3ab.App.closeSheet());
  for (const g of ['speed', 'pop', 'mem', 'word']) {
    await E.evaluate(k => { __mal3ab.goHome(); __mal3ab.openGame(k); }, g); await sleep(900); await scan('game-' + g);
    await E.evaluate(k => __mal3ab.App.freeOver(__mal3ab.GAMES[k], { score: 123, note: '' }), g); await sleep(700); await scan('over-' + g);
  }
  // مستويات: ورقة بداية مستوى ونتيجة مستوى وزعيم
  await E.evaluate(() => { __mal3ab.goHome(); __mal3ab.App.show('map'); }); await sleep(300);
  const lv = await E.evaluate(() => { const b = document.querySelector('#map [data-lv], #map .lvl, #map button.node'); return b ? b.className : null; });
  await E.evaluate(() => { const App = __mal3ab.App; if (App.startLevel) App.startLevel(__mal3ab.LEVELS[0]); else if (App.openLevel) App.openLevel(__mal3ab.LEVELS[0]); }); await sleep(500); await scan('level-sheet');
  await E.evaluate(() => { __mal3ab.App.closeSheet && __mal3ab.App.closeSheet(); __mal3ab.goHome(); });
  // رسائل toast وحوارات
  await E.evaluate(() => { toast('خلّصت!'); }); await sleep(100); await scan('toast');
  check(Object.keys(left).length === 0, 'مفيش أي عربي متبقي في أي شاشة بالإنجليزي', JSON.stringify(left, null, 0).slice(0, 1200));
  await E.evaluate(() => confirm('تبلّغ عن Sam وتخفيه من عندك؟')); await sleep(100);
  check(E.dialogs.some(d => /Report/.test(d)), 'رسالة confirm بتتترجم', E.dialogs.join('|'));

  /* ---------- 4. اجتماعي بالإنجليزي: أسماء اللاعبين العربي ما بتتترجمش ---------- */
  const names = ['نور', 'ضيف', 'مريم'];
  for (let i = 0; i < names.length; i++) {
    const ws = new WebSocket(SRV); await new Promise(r => { ws.onopen = r; }); await sleep(60);
    const hex = n => Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    ws.send(JSON.stringify({ t: 's_auth', id: hex(16), secret: hex(32), name: names[i] })); await sleep(80);
    ws.send(JSON.stringify({ t: 's_submit', game: 'pop', score: 3000 - i * 100 })); await sleep(80); ws.close();
  }
  await go(E, 'social'); await E.fill('#scName', 'Sam'); await E.tap('#scJoin'); await until(() => E.locator('.sc-list li').count().then(n => n >= 3));
  const rows = await E.locator('.sc-list .nm').allInnerTexts();
  check(rows.some(r => r.includes('نور')) && rows.some(r => r.includes('ضيف')), 'أسماء اللاعبين بتفضل زي ما هي (حتى «ضيف» اللي هي كلمة مترجمة)', rows.join('|'));
  check(/Friends & Leaderboards|Leaderboard/.test(await E.locator('#social').innerText()) && !(await arabicLeft(E)).filter(x => !/^aria-label:Report /.test(x)).length, 'شاشة الترتيب بالإنجليزي من غير عربي (غير الأسماء)', (await arabicLeft(E)).join('|'));
  await E.locator('[data-tab="friends"]').tap(); await sleep(200);
  check(!(await arabicLeft(E)).filter(x => !/^aria-label:Report /.test(x)).length, 'تبويب الأصحاب بالإنجليزي', (await arabicLeft(E)).join('|'));

  /* ---------- 5. المقاسات ---------- */
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1000, height: 700 }]) {
    const P = await newPage(browser, { vp, q: '?server=' + encodeURIComponent(SRV) });
    const bad = [];
    for (const s of ['home', 'map', 'profile', 'settings', 'quests', 'online', 'social']) { await go(P, s); if (await overflow(P)) bad.push(s); }
    check(bad.length === 0, `الإنجليزي من غير سكرول أفقي ${vp.width}x${vp.height}`, bad.join(','));
    if (vp.width === 390) { await go(P, 'home'); await P.screenshot({ path: path.join(OUT, 'en-home.png') }); await go(P, 'settings'); await P.screenshot({ path: path.join(OUT, 'en-settings.png') }); }
    await P.context().close();
  }
  const errs = [A, E].flatMap(p => p.errors);
  check(errs.length === 0, 'مفيش أخطاء جافاسكربت', errs.join('|'));

  await browser.close(); server.close();
  console.log(`\n=== اللغتين: ${pass} نجح، ${fail} فشل ===`);
  if (fail) console.log('الفاشل:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
