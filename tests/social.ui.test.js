// اختبارات واجهة المرحلة E (الأصحاب والترتيب) على سيرفر محلي حقيقي.
// التشغيل: NODE_PATH=$(npm root -g) node tests/social.ui.test.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mal3ab-ui-')), 'data.json');
const { server } = require(path.join(ROOT, 'server', 'server.js'));

let pass = 0, fail = 0; const failures = [];
const check = (c, n, x = '') => { if (c) { pass++; console.log('PASS ', n); } else { fail++; failures.push(n); console.log('FAIL ', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000, step = 50) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(step); } return false; };
let SRV, PORT;
async function player(browser, name, vp = { width: 390, height: 844 }, q = true) {
  const ctx = await browser.newContext({ locale: 'ar-EG', viewport: vp, hasTouch: true, isMobile: true });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  page.toasts = []; await page.exposeFunction('__toast', t => page.toasts.push(t));
  await page.goto('file://' + path.join(ROOT, 'index.html') + (q ? '?server=' + encodeURIComponent(SRV) : '')); await sleep(300);
  await page.evaluate(() => { const o = toast; window.toast = t => { window.__toast(t); o(t); }; });
  if (name) await page.evaluate(n => store.set('name', n), name);
  return page;
}
const health = () => fetch(`http://127.0.0.1:${PORT}/`).then(r => r.json());
const openSocial = async p => { if (!(await p.locator('#home').isVisible())) { await p.locator('#nav [data-go="home"]').tap(); await sleep(150); } await p.tap('#socialBtn'); await sleep(200); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
const myCode = p => p.evaluate(() => __mal3ab.Social.me && __mal3ab.Social.me.code);

let errsExtra = [];
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port; SRV = `ws://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();

  /* ---------- قبل الانضمام ---------- */
  const A = await player(browser, 'أحمد');
  check(await A.locator('#socialBtn').isVisible(), 'زرار «الأصحاب والترتيب» ظاهر في الرئيسية');
  await A.evaluate(() => __mal3ab.Social.submit('pop', 500)); await sleep(300);
  check((await health()).players === 0 && await A.evaluate(() => !__mal3ab.Social.ws), 'من غير انضمام: مفيش أي حاجة بتتبعت للسيرفر');
  await openSocial(A);
  const intro = await A.locator('#social').innerText();
  check(/اللي هيتبعت للسيرفر/.test(intro) && /مفيش إيميل/.test(intro) && await A.locator('#scJoin').isVisible(), 'شاشة الانضمام بتشرح اللي هيتبعت');
  check(await A.locator('#scName').inputValue() === 'أحمد', 'الاسم المحفوظ بيتملّى لوحده');

  /* ---------- الانضمام ---------- */
  await A.evaluate(() => { Progress.data.best.pop = 1200; Progress.data.best.speed = 40; });
  await A.tap('#scJoin');
  check(await until(() => A.locator('#scCode').isVisible()), 'بعد الانضمام: كود الصاحب ظاهر');
  const codeA = await myCode(A);
  check(/^[A-Z2-9]{6}$/.test(codeA), 'كود الصاحب 6 حروف', codeA);
  check((await health()).players === 1, 'السيرفر سجّل لاعب واحد');
  check(await until(async () => (await A.locator('.sc-list li').count()) >= 1), 'أحسن نتايج الجهاز دخلت الترتيب (فرقع)');
  check(/1200/.test(await A.locator('.sc-list li.me').innerText()) && /انت/.test(await A.locator('.sc-list li.me').innerText()), 'صفّي متعلّم ونقطي 1200');
  check(await A.evaluate(() => store.get('social_on') === true && /^[a-f0-9]{32}$/.test(store.get('psecret'))), 'الجهاز حفظ الانضمام والسر محليًا');
  check(!(await A.content()).includes(await A.evaluate(() => store.get('psecret'))), 'السر مش ظاهر في الصفحة');

  /* ---------- لاعب تاني + الأصحاب ---------- */
  const B = await player(browser, 'منى');
  await openSocial(B); await B.tap('#scJoin');
  await until(() => B.locator('#scCode').isVisible());
  const codeB = await myCode(B);
  check(codeB && codeB !== codeA, 'منى انضمت بكود مختلف');
  await A.locator('[data-tab="friends"]').tap(); await sleep(100);
  await A.fill('#scAdd', 'zz'); await A.tap('#scAddBtn');
  check(A.toasts.some(t => /6 حروف/.test(t)), 'كود قصير = رسالة');
  await A.fill('#scAdd', 'AAAAAA'); await A.tap('#scAddBtn');
  check(await until(() => A.toasts.some(t => /مفيش لاعب/.test(t)), 3000), 'كود مش موجود = رسالة واضحة');
  await A.fill('#scAdd', codeA); await A.tap('#scAddBtn');
  check(await until(() => A.toasts.some(t => /ده كودك/.test(t)), 3000), 'ما تضيفش نفسك');
  await A.fill('#scAdd', codeB.toLowerCase()); await A.tap('#scAddBtn');
  check(await until(() => A.toasts.some(t => /الطلب اتبعت/.test(t)), 3000), 'أحمد بعت طلب لمنى (والكود صغير اتقبل)');
  await B.locator('[data-tab="friends"]').tap();
  check(await until(() => B.locator('[data-acc]').count().then(n => n === 1)), 'الطلب ظهر عند منى لايف من غير refresh');
  check(/أحمد/.test(await B.locator('.sc-reqs').innerText()), 'اسم أحمد ظاهر في الطلب');
  check(await B.locator('.sc-dot').count() === 1, 'عداد الطلبات على التبويب');
  await B.tap('[data-acc]');
  check(await until(() => B.locator('.sc-friends li').count().then(n => n === 1)), 'منى قبلت وأحمد ظهر في أصحابها');
  await A.locator('[data-tab="friends"]').tap();
  check(await until(() => A.locator('.sc-friends li').count().then(n => n === 1)), 'أحمد شاف منى في أصحابه لايف');
  check(/فرقع: 1200/.test(await B.locator('.sc-friends li').innerText()), 'منى شايفة أحسن نتيجة لأحمد');

  /* ---------- لعب فعلي بيحدّث الترتيب ---------- */
  await B.evaluate(() => { const g = GAMES.pop; __mal3ab.App.openGame('pop'); setTimeout(() => {}, 0); });
  await sleep(300);
  await B.evaluate(() => __mal3ab.App.freeOver(GAMES.pop, { score: 2500 }));
  await sleep(500);
  check(await B.evaluate(() => Progress.data.best.pop) === 2500, 'منى سجلت 2500 محليًا');
  await B.evaluate(() => __mal3ab.goHome()); await openSocial(B);
  await B.locator('[data-tab="board"]').tap();
  await B.locator('[data-sg="pop"]').tap();
  check(await until(async () => /2500/.test(await B.locator('.sc-list li').first().innerText().catch(() => ''))), 'بعد نهاية اللعب النتيجة اتبعتت تلقائي ومنى الأولى');
  const rows = await B.locator('.sc-list li').allInnerTexts();
  check(rows.length === 2 && /منى/.test(rows[0]) && /أحمد/.test(rows[1]), 'الترتيب: منى 2500 ثم أحمد 1200', rows.join('|'));
  await B.locator('[data-ss="friends"]').tap();
  check(await until(async () => (await B.locator('.sc-list li').count()) === 2), 'ترتيب الأصحاب');
  await B.locator('[data-ss="week"]').tap();
  check(await until(async () => (await B.locator('.sc-list li').count()) === 2), 'الترتيب الأسبوعي');
  await B.locator('[data-sg="mem"]').tap();
  check(await until(() => B.locator('#social .note-box').first().innerText().then(t => /لسه محدش/.test(t)).catch(() => false)), 'لعبة من غير نتايج = رسالة فاضية مفهومة');

  // نتيجة أقل ما تنزلش الأحسن
  await B.evaluate(() => __mal3ab.Social.submit('pop', 100)); await sleep(400);
  await B.locator('[data-ss="all"]').tap(); await B.locator('[data-sg="pop"]').tap();
  check(await until(async () => /2500/.test(await B.locator('.sc-list li').first().innerText().catch(() => ''))), 'نتيجة أقل ما بتنزّلش الأحسن');

  /* ---------- حذف صاحب ---------- */
  B.on('dialog', d => d.accept());
  await B.locator('[data-tab="friends"]').tap(); await B.tap('.sc-x');
  check(await until(() => B.locator('.sc-friends li').count().then(n => n === 0)), 'منى شالت أحمد');
  await A.locator('[data-tab="friends"]').tap();
  check(await until(() => A.locator('.sc-friends li').count().then(n => n === 0)), 'وأحمد اتشال عنده لايف');

  /* ---------- مطالب Apple: اسم مسيء، بلاغ، حذف حساب ---------- */
  {
    const F = await player(browser, 'شرموط');
    await openSocial(F); await F.tap('#scJoin');
    check(await until(() => F.toasts.some(t => /الاسم ده مش مناسب/.test(t)), 5000) && await F.evaluate(() => store.get('social_on') === false), 'اسم مسيء: رسالة والانضمام ما بيتمش');
    await F.fill('#scName', 'فريد'); await F.tap('#scJoin'); await until(() => F.locator('#scCode').isVisible());
    const G = await player(browser, 'جمال');
    await openSocial(G); await G.tap('#scJoin'); await until(() => G.locator('#scCode').isVisible());
    await F.evaluate(() => __mal3ab.Social.submit('speed', 50)); await G.evaluate(() => __mal3ab.Social.submit('speed', 60));
    await sleep(400);
    await G.locator('[data-sg="speed"]').tap();
    check(await until(async () => (await G.locator('.sc-list li').count()) === 3), 'ثلاث لاعبين في ترتيب أسرع مخ');
    check(await G.locator('.sc-list li.me .sc-flag').count() === 0 && await G.locator('.sc-list li:not(.me) .sc-flag').count() === 2, 'زرار البلاغ على صفوف التانيين بس');
    G.on('dialog', d => d.accept()); F.on('dialog', d => d.accept());
    await G.tap('.sc-flag');
    check(await until(() => G.toasts.some(t => /اختفى من عندك/.test(t)), 4000), 'رسالة تأكيد البلاغ');
    check(await until(async () => (await G.locator('.sc-list li').count()) === 2), 'اللاعب المبلّغ عنه اختفى من ترتيبي');
    await F.locator('[data-sg="speed"]').tap();
    check(await until(async () => (await F.locator('.sc-list li').count()) === 2), 'الحظر من الجهتين: هو كمان ما بيشوفنيش');
    await F.locator('[data-tab="friends"]').tap();
    check(await F.locator('#scDelete').isVisible() && /بلّغ عن لاعب/.test(await F.locator('#social').innerText()), 'زرار حذف الحساب وشرح البلاغ ظاهرين');
    const before = (await health()).players;
    await F.tap('#scDelete');
    check(await until(async () => (await health()).players === before - 1), 'حذف الحساب مسح اللاعب من السيرفر');
    check(await until(() => F.locator('#scJoin').isVisible()) && await F.evaluate(() => store.get('social_on') === false && store.get('psecret') === ''), 'والجهاز رجع لشاشة الانضمام ومسح الهوية');
    check(await G.evaluate(() => 1) && await until(async () => { await G.evaluate(() => __mal3ab.Social.send({ t: 's_board', game: 'speed', scope: 'all' })); await sleep(150); return (await G.locator('.sc-list li').count()) === 2; }), 'الترتيب عند الباقيين متحدّث');
    errsExtra = [F, G];
  }

  /* ---------- مقاسات وإتاحة ---------- */
  for (const vp of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 900, height: 700 }]) {
    await A.setViewportSize(vp); await sleep(150);
    await A.locator('[data-tab="board"]').tap(); await sleep(150);
    check(!(await overflow(A)), `الترتيب من غير سكرول أفقي ${vp.width}x${vp.height}`);
    await A.locator('[data-tab="friends"]').tap(); await sleep(150);
    check(!(await overflow(A)), `الأصحاب من غير سكرول أفقي ${vp.width}x${vp.height}`);
  }
  await A.setViewportSize({ width: 390, height: 844 });
  await A.locator('[data-tab="board"]').tap(); await sleep(300);
  await A.screenshot({ path: path.join(OUT, 'social-board.png') });
  const small = await A.evaluate(() => [...document.querySelectorAll('#social button')].filter(b => b.offsetParent && (b.getBoundingClientRect().height < 40)).map(b => b.className + ':' + Math.round(b.getBoundingClientRect().height)));
  check(small.length === 0, 'كل الزراير 40px أو أكتر في الطول', small.join());
  await A.locator('#home, #nav [data-go="home"]').first().tap().catch(() => {});
  await A.evaluate(() => __mal3ab.goHome()); await sleep(200);
  check(!(await overflow(A)), 'الرئيسية بـ4 زراير من غير سكرول أفقي');
  await A.screenshot({ path: path.join(OUT, 'home-4btn.png') });

  /* ---------- حساب مش مطابق + من غير سيرفر ---------- */
  const C = await player(browser, 'كريم');
  await openSocial(C); await C.tap('#scJoin'); await until(() => C.locator('#scCode').isVisible());
  await C.evaluate(() => { store.set('psecret', 'a'.repeat(32)); __mal3ab.Social.close(); });
  await C.evaluate(() => __mal3ab.goHome()); await openSocial(C);
  check(await until(() => C.toasts.some(t => /مش مطابق لجهازك/.test(t)), 5000), 'سر مش مطابق = رسالة واضحة');
  const D = await player(browser, 'سلمى', undefined, false);
  await D.evaluate(() => { __mal3ab.Online.base = ''; });
  await openSocial(D);
  check(/السيرفر لسه ما اشتغلش/.test(await D.locator('#social').innerText()), 'من غير سيرفر: رسالة واضحة');
  const E = await player(browser, 'نور', undefined, false);
  await E.evaluate(() => { __mal3ab.Online.base = 'ws://127.0.0.1:1'; });
  await openSocial(E); await E.tap('#scJoin');
  check(await until(() => E.toasts.some(t => /مش قادرين نوصل/.test(t)), 8000) && await E.evaluate(() => store.get('social_on') === false), 'السيرفر مش متاح: رسالة والانضمام ما بيتسجلش');

  const errs = [A, B, C, D, E, ...errsExtra].flatMap(p => p.errors);
  check(errs.length === 0, 'مفيش أخطاء جافاسكربت', errs.join('|'));

  await browser.close(); server.close();
  console.log(`\n=== المرحلة E (واجهة): ${pass} نجح، ${fail} فشل ===`);
  if (fail) console.log('الفاشل:', failures.join(' | '));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
