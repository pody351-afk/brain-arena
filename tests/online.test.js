// اختبارات المرحلة D: سيرفر حقيقي على الجهاز + متصفحين منفصلين (لاعبين) بيلعبوا ماتشات كاملة ضد بعض.
// التشغيل: NODE_PATH=$(npm root -g) node tests/online.test.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });
const { server, rooms } = require(path.join(ROOT, 'server', 'server.js'));

let pass = 0, fail = 0; const failures = [];
const check = (c, n, x = '') => { if (c) { pass++; console.log('PASS ', n); } else { fail++; failures.push(n); console.log('FAIL ', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000, step = 50) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(step); } return false; };

let PORT, SRV;
async function player(browser, name, vp = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ locale: 'ar-EG', viewport: vp, hasTouch: true, isMobile: true }); // كل لاعب في متصفح لوحده (تخزين منفصل)
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  page.toasts = [];
  await page.exposeFunction('__toast', t => page.toasts.push(t));
  await page.goto('file://' + path.join(ROOT, 'index.html') + '?server=' + encodeURIComponent(SRV)); await sleep(300);
  await page.evaluate(() => { const o = toast; window.toast = t => { window.__toast(t); o(t); }; });
  if (name) await page.evaluate(n => store.set('name', n), name);
  return page;
}
const typeWord = (page, w) => page.evaluate(w => { for (const ch of w) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true })); }, w);
const state = p => p.evaluate(() => __mal3ab.Online.state);
async function openOnline(p) {
  if (await p.locator('#online').isVisible()) return;
  if (!(await p.locator('#home').isVisible())) { await p.locator('#nav [data-go="home"]').tap(); await sleep(150); }
  await p.tap('#onlineBtn'); await sleep(150);
}
async function makeRoom(p, game = 'word') {
  await openOnline(p);
  if (game !== 'word') await p.locator(`[data-game="${game}"]`).tap();
  await p.tap('#onCreate');
  await until(async () => (await state(p)) === 'waiting');
  return p.evaluate(() => __mal3ab.Online.code);
}
async function joinRoom(p, code) { await openOnline(p); await p.fill('#onCode', code); await p.tap('#onJoin'); }

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port; SRV = `ws://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();

  /* ---------- 1. السيرفر لوحده ---------- */
  {
    const mk = () => new Promise(r => { const ws = new WebSocket(SRV); ws.msgs = []; ws.onmessage = e => ws.msgs.push(JSON.parse(e.data)); ws.onclose = () => { ws.closed = true; }; ws.onopen = () => r(ws); });
    const a = await mk(), b = await mk(), c = await mk();
    a.send(JSON.stringify({ t: 'create', game: 'nope', name: 'x' })); await sleep(80);
    check(a.msgs.some(m => m.t === 'error' && m.code === 'bad_game'), 'السيرفر: لعبة مش موجودة = رفض');
    a.send(JSON.stringify({ t: 'create', game: 'word', name: '<b>أحمد</b>\u0000 اسم طويل جدا جدا جدا', v: '9' })); await sleep(80);
    const code = a.msgs.find(m => m.t === 'room').code;
    check(/^[A-HJ-NP-Z2-9]{4}$/.test(code), 'السيرفر: كود الأوضة 4 حروف من غير الحروف اللي بتتلخبط', code);
    b.send(JSON.stringify({ t: 'join', code, name: 'منى', v: '8' })); await sleep(80);
    check(b.msgs.some(m => m.t === 'error' && m.code === 'version'), 'السيرفر: نسخة مختلفة = رفض');
    b.send(JSON.stringify({ t: 'join', code: 'ZZZZ', name: 'منى', v: '9' })); await sleep(80);
    check(b.msgs.some(m => m.t === 'error' && m.code === 'no_room'), 'السيرفر: كود غلط = "مفيش أوضة"');
    b.send(JSON.stringify({ t: 'join', code, name: 'منى', v: '9' })); await sleep(80);
    const st = b.msgs.find(m => m.t === 'start');
    check(st && a.msgs.some(m => m.t === 'start' && m.seed === st.seed), 'السيرفر: الاتنين بياخدوا start بنفس الـ seed');
    check(st && !/[<>\u0000]/.test(st.names[0]) && st.names[0].length <= 16 && st.names[0].startsWith('b'), 'السيرفر: الأسماء بتتنضف وبتتقص (16 حرف)', st && st.names[0]);
    c.send(JSON.stringify({ t: 'join', code, name: 'تالت', v: '9' })); await sleep(80);
    check(c.msgs.some(m => m.t === 'error' && m.code === 'room_full'), 'السيرفر: لاعب تالت = "الأوضة مليانة"');
    a.send(JSON.stringify({ t: 'score', v: 50 })); a.send(JSON.stringify({ t: 'score', v: 20 })); a.send(JSON.stringify({ t: 'score', v: 999999 })); await sleep(80);
    const opps = b.msgs.filter(m => m.t === 'opp').map(m => m.v);
    check(opps.join() === '50', 'السيرفر: النقط ما بتقلّش، والأرقام المستحيلة بتترفض', opps.join());
    a.send('{مش json'); a.send(JSON.stringify({ t: 'what' })); await sleep(50);
    check(!a.closed, 'السيرفر: رسالة بايظة ما بتوقعش حاجة');
    a.send('x'.repeat(5000)); await sleep(200);
    check(a.closed, 'السيرفر: رسالة ضخمة = بيقفل الاتصال ده بس');
    await sleep(100);
    check(b.msgs.some(m => m.t === 'left'), 'السيرفر: لما لاعب يقفل، التاني بيعرف');
    b.close(); c.close(); await sleep(150);
    check(!rooms.has(code), 'السيرفر: الأوضة الفاضية بتتمسح');
    // 40 رسالة ورا بعض: الزيادة بتتجاهل من غير ما يقع
    const d = await mk(); for (let i = 0; i < 40; i++) d.send(JSON.stringify({ t: 'create', game: 'word', name: 'x' })); await sleep(200);
    check(d.msgs.filter(m => m.t === 'room').length <= 30 && !d.closed, 'السيرفر: حد أقصى للرسايل في الثانية', d.msgs.filter(m => m.t === 'room').length);
    d.close();
    const res = await fetch(`http://127.0.0.1:${PORT}/`).then(r => r.json());
    check(res.ok && res.name === 'mal3ab-server', 'السيرفر: صفحة الصحة بترد');
  }

  /* ---------- 2. من غير سيرفر ---------- */
  {
    const ctx = await browser.newContext({ locale: 'ar-EG', viewport: { width: 390, height: 844 } }); await ctx.route(/fonts\./, r => r.abort());
    const p = await ctx.newPage(); await p.goto('file://' + path.join(ROOT, 'index.html')); await sleep(250);
    await p.evaluate(() => { __mal3ab.Online.base = ''; }); // نمثّل نسخة من غير سيرفر
    await p.tap('#onlineBtn').catch(() => p.click('#onlineBtn')); await sleep(150);
    check((await p.innerText('#online')).includes('لسه ما اشتغلش') && await p.locator('#onCreate').isDisabled() && await p.locator('#onJoin').isDisabled(), 'من غير سيرفر: رسالة واضحة والزراير مقفولة');
    const bad = await p.evaluate(() => { __mal3ab.Online.base = null; history.replaceState(null, '', location.pathname + '?server=wss://evil.example.com'); return __mal3ab.Online.serverUrl(); });
    check(bad === 'wss://mal3ab-server.onrender.com', 'الأمان: ?server= بيقبل localhost بس، وغير كده بيستخدم سيرفرنا', bad);
    await ctx.close();
  }

  /* ---------- 3. ماتش كلمات كامل بين لاعبين ---------- */
  const A = await player(browser, 'أحمد'), B = await player(browser, 'منى');
  {
    await openOnline(B); await B.fill('#onName', ''); await B.evaluate(() => store.set('name', ''));
    await B.tap('#onCreate'); await sleep(100);
    check(B.toasts.includes('اكتب اسمك الأول') && (await state(B)) === 'menu', 'الشاشة: لازم تكتب اسمك الأول');
    await B.fill('#onName', 'منى');
    const code = await makeRoom(A, 'word');
    check(code && (await A.innerText('.on-code')).replace(/\s/g, '') === code, 'الشاشة: الكود ظاهر كبير عند صاحب الأوضة', code);
    await A.screenshot({ path: path.join(OUT, 'on-waiting.png') });
    await joinRoom(B, code.toLowerCase());
    check(await until(async () => (await state(A)) === 'countdown' && (await state(B)) === 'countdown', 3000), 'الماتش: الاتنين دخلوا العد التنازلي مع بعض');
    check(await until(async () => (await state(A)) === 'play' && (await state(B)) === 'play', 6000), 'الماتش: الاتنين بدأوا يلعبوا');
    const la = await A.evaluate(() => WordGame.s.puzzle.l.join('')), lb = await B.evaluate(() => WordGame.s.puzzle.l.join(''));
    const words = await A.evaluate(() => WordGame.s.puzzle.w.slice());
    check(la && la === lb && words.length >= 5, 'الماتش: نفس اللغز بالظبط عند الاتنين', la + ' / ' + lb);
    check(await A.locator('#vs').isVisible() && (await A.innerText('#vs')).includes('منى'), 'الماتش: نقط المنافس ظاهرة فوق');
    await typeWord(A, words[0]); await sleep(600);
    const ptsA = await A.evaluate(() => WordGame.s.score);
    check(await until(async () => (await B.innerText('#vs')).includes(String(ptsA)), 2000), 'الماتش: نقط أحمد وصلت لمنى لايف', await B.innerText('#vs'));
    await A.screenshot({ path: path.join(OUT, 'on-play.png') });
    // منى تخلّص اللغز كله: الماتش يخلص للاتنين
    for (const w of words) { await typeWord(B, w); await sleep(40); }
    check(await until(async () => (await state(A)) === 'over' && (await state(B)) === 'over', 6000), 'الماتش: لما منى خلّصت اللغز، الماتش خلص للاتنين');
    const ra = await A.innerText('#sheetBox'), rb = await B.innerText('#sheetBox');
    check(rb.includes('كسبت') && ra.includes('خسرت'), 'النتيجة: منى كسبت وأحمد خسر', ra.replace(/\n/g, ' ') + ' || ' + rb.replace(/\n/g, ' '));
    const sb = await B.evaluate(() => WordGame.s.score);
    check(ra.includes(String(sb)) && ra.includes(String(ptsA)), 'النتيجة: النقط الصح ظاهرة عند الاتنين');
    await B.screenshot({ path: path.join(OUT, 'on-result.png') });
    check(await B.evaluate(() => !!__mal3ab.Meta.data.ach.a_online1) && !(await A.evaluate(() => !!__mal3ab.Meta.data.ach.a_online1)), 'الإنجازات: «كسبت صاحبك» للي كسب بس');
    check(await B.evaluate(() => __mal3ab.Meta.data.stats.words) === words.length, 'المهام: كلمات الماتش اتحسبت');

    /* ---------- 4. ماتش تاني، وبعدين حد يخرج في النص ---------- */
    await A.tap('#onAgain'); await sleep(200);
    check((await B.toasts).some(t => t.includes('عايز ماتش تاني')) && (await A.innerText('#onAgain')).includes('مستنيين'), 'ماتش تاني: منى عرفت إن أحمد عايز يعيد');
    await B.tap('#onAgain');
    check(await until(async () => (await state(A)) === 'play' && (await state(B)) === 'play', 7000), 'ماتش تاني: بدأ للاتنين');
    check(await A.evaluate(() => WordGame.s.score) === 0 && (await A.innerText('#vs')).includes('0'), 'ماتش تاني: النقط بدأت من صفر');
    await A.tap('#backBtn'); await sleep(400);
    check((await state(A)) === 'menu' && await A.locator('#online').isVisible(), 'الخروج: أحمد رجع لشاشة الأونلاين');
    check(await until(async () => (await B.innerText('#sheetBox').catch(() => '')).includes('خرج'), 3000) && (await state(B)) === 'menu', 'الخروج: منى عرفت إن أحمد خرج والماتش اتلغى');
    check(await B.evaluate(() => !WordGame.s.alive || WordGame.s.stopped), 'الخروج: لعبة منى وقفت');
    await B.evaluate(() => __mal3ab.App.closeSheet());

    /* ---------- 5. ماتش أسرع مخ لحد ما الوقت يخلص ---------- */
    const code2 = await makeRoom(B, 'speed');
    await joinRoom(A, code2);
    check(await until(async () => (await state(A)) === 'play' && (await state(B)) === 'play', 7000), 'أسرع مخ: الماتش بدأ');
    check((await A.innerText('#hudInfo')).includes('صح: 0') && !(await A.innerText('#hudInfo')).includes('/'), 'أسرع مخ: من غير هدف (سباق نقط)');
    // أحمد يجاوب 3 صح، ومنى ولا حاجة، وبعدين الوقت يخلص عند الاتنين
    for (let i = 0; i < 3; i++) { await A.evaluate(() => { const b = [...document.querySelectorAll('#sbAns .ans')].find(x => { const q = SpeedBrain.q; return q.answers.find(a => a.label === x.textContent).correct; }); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }); await sleep(400); }
    await A.evaluate(() => { SpeedBrain.s.time = 0.05; }); await B.evaluate(() => { SpeedBrain.s.time = 0.05; });
    check(await until(async () => (await state(A)) === 'over' && (await state(B)) === 'over', 6000), 'أسرع مخ: الوقت خلص والنتيجة طلعت');
    check((await A.innerText('#sheetBox')).includes('كسبت') && (await B.innerText('#sheetBox')).includes('خسرت'), 'أسرع مخ: أحمد (3 صح) كسب');
    await A.tap('#onExit'); await sleep(300);
    check(await until(async () => (await B.innerText('#sheetBox').catch(() => '')).includes('خرج'), 3000), 'الخروج من شاشة النتيجة: التاني بيعرف');
    await B.evaluate(() => __mal3ab.App.closeSheet());

    /* ---------- 6. أخطاء وحالات تانية من الواجهة ---------- */
    await joinRoom(A, 'QQQQ');
    check(await until(async () => A.toasts.some(t => t.includes('مفيش أوضة'))), 'الواجهة: كود غلط = رسالة واضحة');
    await joinRoom(A, 'AB');
    check(A.toasts.includes('الكود 4 حروف/أرقام'), 'الواجهة: كود ناقص = رسالة قبل ما يتصل');
    // صاحب الأوضة يخرج من الشاشة قبل ما حد يدخل: الأوضة تتقفل
    const code3 = await makeRoom(A, 'word');
    await A.locator('#nav [data-go="home"]').tap(); await sleep(300);
    check((await state(A)) === 'menu' && await until(async () => !rooms.has(code3), 2000), 'الواجهة: لو سبت شاشة الانتظار الأوضة بتتقفل');
    await joinRoom(B, code3);
    check(await until(async () => B.toasts.some(t => t.includes('مفيش أوضة'))), 'الواجهة: محدش يقدر يدخل أوضة اتقفلت');
    // السيرفر يقع في نص الماتش
    const code4 = await makeRoom(A, 'word'); await joinRoom(B, code4);
    await until(async () => (await state(A)) === 'play');
    for (const ws of [...require(path.join(ROOT, 'server', 'server.js')).wss.clients]) ws.terminate();
    check(await until(async () => (await state(A)) === 'menu' && A.toasts.some(t => t.includes('اتقطع'))), 'الاتصال: لو السيرفر وقع، اللاعب بيرجع للقايمة برسالة');
    check(await A.locator('#online').isVisible() && await A.locator('#play').isHidden(), 'الاتصال: اللعبة وقفت والشاشة رجعت');
    check(!A.errors.length && !B.errors.length, 'الواجهة: من غير أخطاء JS', A.errors.concat(B.errors).join(' | '));
  }
  await A.context().close(); await B.context().close();

  /* ---------- 7. المقاسات ---------- */
  for (const [nm, vp] of [['موبايل صغير 320', { width: 320, height: 640 }], ['عرضي', { width: 844, height: 390 }]]) {
    const P1 = await player(browser, 'أحمد', vp), P2 = await player(browser, 'منى', vp);
    await openOnline(P1); await sleep(100);
    const wide = await P1.evaluate(() => document.scrollingElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll('#online *')].some(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }));
    await P1.screenshot({ path: path.join(OUT, `on-menu-${vp.width}.png`) });
    check(!wide, `المقاسات (${nm}): شاشة الأونلاين جوه الشاشة`);
    const c = await makeRoom(P1, 'word'); await joinRoom(P2, c);
    await until(async () => (await state(P1)) === 'play');
    const v = await P1.evaluate(() => { const r = document.querySelector('#vs').getBoundingClientRect(), t = document.querySelector('.wd-tools').getBoundingClientRect(); return r.height > 0 && r.top >= 0 && t.bottom <= innerHeight + 1; });
    await P1.screenshot({ path: path.join(OUT, `on-play-${vp.width}.png`) });
    check(v, `المقاسات (${nm}): شريط المنافس والزراير ظاهرين وقت اللعب`);
    await P1.context().close(); await P2.context().close();
  }

  await browser.close(); server.close();
  console.log(`\n=== المرحلة D (أونلاين): ${pass} نجح، ${fail} فشل ===`);
  if (fail) { console.log('الفاشلة:\n- ' + failures.join('\n- ')); process.exit(1); }
  process.exit(0);
})().catch(e => { console.log('CRASH', e.stack || e); process.exit(1); });
