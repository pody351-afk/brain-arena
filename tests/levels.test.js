// اختبارات المرحلة B: المستويات، التقدّم، الزعماء، الأنواع الجديدة، وقابلية حل مراحل فرقع.
// التشغيل: node tests/levels.test.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output'); fs.mkdirSync(OUT, { recursive: true });
const PAGE = path.join(ROOT, 'index.html');
// بنختبر index.html نفسه زي ما GitHub بيعرضه بالظبط (من غير غلاف)
const URL = 'file://' + PAGE;
let pass = 0, fail = 0; const failures = [];
const check = (c, n, x = '') => { if (c) { pass++; console.log('PASS ', n); } else { fail++; failures.push(n); console.log('FAIL ', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, vp = { width: 390, height: 844 }, mobile = true) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage(); page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/net::|ERR_FAILED/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(URL); return page;
}

// حل أي سؤال من أسرع مخ من الشاشة بس (مستقل عن كود اللعبة)
const SOLVE = () => {
  const prompt = document.querySelector('#sbPrompt').textContent;
  const ans = [...document.querySelectorAll('#sbAns .ans')], labels = ans.map(b => b.textContent);
  const odd = [...document.querySelectorAll('.odd button')];
  const ev = t => { const m = t.replace('−', '-').replace('×', '*').match(/(\d+)\s*([-+*])\s*(\d+)/); const a = +m[1], b = +m[3]; return m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b; };
  const inkName = () => ({ 'rgb(255, 90, 95)': 'أحمر', 'rgb(77, 141, 255)': 'أزرق', 'rgb(61, 220, 132)': 'أخضر', 'rgb(255, 210, 63)': 'أصفر' })[getComputedStyle(document.querySelector('.word')).color];
  if (odd.length) { const c = odd.map(b => b.style.background); return { type: 'odd', sel: '.odd button', index: c.findIndex(x => c.filter(y => y === x).length === 1) }; }
  if (prompt.includes('صح ولا غلط')) { const [l, r] = document.querySelector('.eq').textContent.split('='); return { type: 'tf', index: labels.indexOf(ev(l) === +r.trim() ? 'صح' : 'غلط') }; }
  if (prompt.includes('معنى')) return { type: 'meaning', index: labels.indexOf(document.querySelector('.word').textContent) };
  if (prompt.includes('لون')) return { type: 'stroop', index: labels.indexOf(inkName()) };
  if (prompt.includes('أكبر')) { const v = labels.map(ev); return { type: 'bigger', index: v.indexOf(Math.max(...v)) }; }
  if (prompt.includes('أصغر')) { const v = labels.map(ev); return { type: 'smaller', index: v.indexOf(Math.min(...v)) }; }
  if (prompt.includes('الناقص')) {
    const t = document.querySelector('.eq').textContent.replace('−', '-').replace('×', '*'); const m = t.match(/(\d+)\s*([-+*])\s*\?\s*=\s*(\d+)/);
    const a = +m[1], r = +m[3], b = m[2] === '+' ? r - a : m[2] === '-' ? a - r : r / a;
    return { type: 'missing', index: labels.indexOf(String(b)) };
  }
  if (prompt.includes('النمط')) {
    const s = [...document.querySelectorAll('.seq span:not(.q)')].map(x => +x.textContent), n = s.length, cands = new Set();
    const d = s.map((v, i) => i ? v - s[i - 1] : null).slice(1);
    if (d.every(x => x === d[0])) cands.add(s[n - 1] + d[0]);
    if (s[0] && s.every((v, i) => !i || v === s[i - 1] * (s[1] / s[0]))) cands.add(s[n - 1] * (s[1] / s[0]));
    if (d[0] === d[2] && d[1] !== d[0]) cands.add(s[n - 1] + d[1]);
    const rt = s.map(Math.sqrt); if (rt.every((v, i) => Number.isInteger(v) && (!i || v === rt[i - 1] + 1))) cands.add((rt[n - 1] + 1) ** 2);
    if (s.every((v, i) => i < 2 || v === s[i - 1] + s[i - 2])) cands.add(s[n - 1] + s[n - 2]);
    const hits = labels.map((l, i) => cands.has(+l) ? i : -1).filter(i => i >= 0);
    return { type: 'pattern', index: hits.length === 1 ? hits[0] : -1, seq: s.join(','), labels: labels.join(',') };
  }
  return { type: 'unknown', index: -1 };
};
async function answerRight(page) {
  const s = await page.evaluate(SOLVE);
  if (s.index >= 0) await page.locator(s.sel || '#sbAns .ans').nth(s.index).dispatchEvent('pointerdown');
  return s;
}

async function testData(browser) {
  console.log('\n--- بيانات المستويات ---');
  const page = await newPage(browser);
  const d = await page.evaluate(() => {
    const { LEVELS, WORLDS } = __mal3ab;
    const sig = L => L.boss ? 'boss' + L.n : L.game + ':' + JSON.stringify(L.game === 'speed' ? [L.cfg.types, L.cfg.goal, L.cfg.time] : L.game === 'mem' ? [L.cfg.variant, L.cfg.size, L.cfg.count] : L.game === 'word' ? [L.cfg.p, L.cfg.need] : [L.cfg.goal, L.cfg.moves]);
    const sigs = LEVELS.filter(L => !L.boss).map(sig);
    const kinds = new Set(LEVELS.filter(L => !L.boss).map(L => L.game + ':' + (L.game === 'speed' ? L.cfg.types.join('+') : L.game === 'mem' ? L.cfg.variant : L.game === 'word' ? WORD_PUZZLES[L.cfg.p].l : L.cfg.goal.type)));
    let consecutiveSame = 0; for (let i = 1; i < LEVELS.length; i++) if (sig(LEVELS[i]) === sig(LEVELS[i - 1])) consecutiveSame++;
    const types = new Set(LEVELS.filter(L => L.game === 'speed').flatMap(L => L.cfg.types));
    const memV = new Set(LEVELS.filter(L => L.game === 'mem').map(L => L.cfg.variant));
    const popG = new Set(LEVELS.filter(L => L.game === 'pop').map(L => L.cfg.goal.type));
    return { n: LEVELS.length, worlds: WORLDS.length, bosses: LEVELS.filter(L => L.boss).map(L => L.n).join(','), nums: LEVELS.every((L, i) => L.n === i + 1),
      goals: LEVELS.every(L => L.goal && L.goal.length > 10), distinct: new Set(sigs).size, total: sigs.length, kinds: kinds.size, consecutiveSame,
      types: [...types].length, memV: [...memV].join(','), popG: [...popG].join(','),
      cover: WORLDS.every((w, i) => (i === 0 ? w.from === 1 : w.from === WORLDS[i - 1].to + 1)) && WORLDS[WORLDS.length - 1].to === LEVELS.length,
      xpOk: LEVELS.every(L => L.xpStar > 0 && L.xpFirst > 0), maxXP: LEVELS.reduce((a, L) => a + L.xpStar * 3 + L.xpFirst, 0) + WORLDS.reduce((a, w) => a + w.bonus, 0) };
  });
  console.log('   ', JSON.stringify(d));
  check(d.n === 110 && d.nums, 'المستويات: 110 مستوى مترقمين من 1 لـ 110 (100 + عالم الكلمات)');
  check(d.worlds === 9 && d.cover, 'العوالم: 9 عوالم بتغطي المستويات من غير فراغات');
  check(d.bosses === '10,20,30,40,50,60,70,80,90,100,110', 'الزعماء: كل 10 مستويات');
  check(d.goals, 'كل مستوى ليه هدف مكتوب');
  check(d.distinct === d.total, `كل المستويات العادية مختلفة عن بعض (${d.distinct}/${d.total})`);
  check(d.consecutiveSame === 0, 'مفيش مستويين ورا بعض متطابقين');
  check(d.kinds >= 25, `تنوّع أنواع التحديات (${d.kinds} نوع مختلف)`);
  check(d.types === 8 && d.memV.split(',').length === 4 && d.popG.split(',').length === 4, 'كل أنواع الأسئلة والذاكرة وأهداف فرقع مستخدمة');
  check(d.xpOk, 'كل مستوى ليه XP');
  // كل مستوى بيفتح ويشتغل من غير أخطاء (بما فيهم أجزاء الزعماء)
  const bad = await page.evaluate(async () => {
    const { LEVELS, GAMES } = __mal3ab; const errs = [];
    for (const L of LEVELS) for (const p of L.parts) {
      try { GAMES[p.game].start(p.cfg, { end() {} }); await new Promise(r => setTimeout(r, 15)); GAMES[p.game].stop(); } catch (e) { errs.push(L.n + ':' + p.game + ':' + e.message); }
    }
    __mal3ab.App.show('home'); return errs;
  });
  check(bad.length === 0 && page.errors.length === 0, 'كل الـ 110 مستوى (و33 جزء زعيم) بيبدأوا من غير أخطاء', bad.concat(page.errors).join(' | '));
  await page.context().close();
}

async function testSpeedTypes(browser) {
  console.log('\n--- أنواع أسئلة أسرع مخ ---');
  const page = await newPage(browser);
  for (const t of ['tf', 'bigger', 'smaller', 'stroop', 'meaning', 'odd', 'missing', 'pattern']) {
    let ok = 0, n = 0, badEx = '', base = 0;
    for (const b of [0, 4, 9]) {
      await page.evaluate(([t, b]) => { __mal3ab.App.enterPlay('test'); __mal3ab.GAMES.speed.start({ mode: 'level', types: [t], goal: 999, time: 999, base: b, bonus: false }, { end() {} }); }, [t, b]);
      for (let i = 0; i < 25; i++) {
        const c0 = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
        const s = await answerRight(page); n++;
        await page.waitForFunction(() => !__mal3ab.GAMES.speed.s.lock, null, { timeout: 2000 }).catch(() => {});
        const c1 = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
        if (s.index >= 0 && c1 === c0 + 1) ok++; else if (!badEx) badEx = JSON.stringify(s);
      }
      await page.evaluate(() => __mal3ab.GAMES.speed.stop());
    }
    check(ok === n, `أسرع مخ «${t}»: ${ok}/${n} إجابة صح اتحسبت صح (بصعوبات مختلفة)`, badEx);
  }
  // عدم التكرار: في 40 سؤال ورا بعض، مفيش سؤال بيتكرر خلال آخر 15
  const rep = await page.evaluate(() => { const G = __mal3ab.GAMES.speed; G.start({ mode: 'level', types: ['tf', 'bigger'], goal: 999, time: 999, base: 0 }, { end() {} }); const seen = []; let dup = 0; for (let i = 0; i < 40; i++) { const q = G.makeQuestion(); if (seen.slice(-15).includes(q.sig)) dup++; seen.push(q.sig); } G.stop(); return dup; });
  check(rep === 0, 'أسرع مخ: مفيش سؤال بيتكرر خلال آخر 15 سؤال', String(rep));
  check(page.errors.length === 0, 'أسرع مخ: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testPopSolvable(browser) {
  console.log('\n--- قابلية حل مراحل فرقع (محاكاة لاعب بسيط) ---');
  const page = await newPage(browser);
  await page.addScriptTag({ path: path.join(__dirname, 'pop-bot.js') });
  const res = await page.evaluate(() => {
    const out = [];
    for (const L of __mal3ab.LEVELS) for (const p of L.parts) if (p.game === 'pop') {
      const st = __popStats(p.cfg, 100, L.n + 77); // seed مختلف عن أداة المعايرة
      out.push({ n: L.n, boss: !!L.boss, goal: p.cfg.goal.type + (p.cfg.goal.k != null ? p.cfg.goal.k : '') + ':' + p.cfg.goal.n, moves: p.cfg.moves, ...st });
    }
    return out;
  });
  for (const r of res) console.log(`   مستوى ${String(r.n).padStart(3)}${r.boss ? ' (زعيم)' : '       '} ${r.goal.padEnd(12)} حركات ${String(r.moves).padStart(2)} → فوز ${(r.win * 100).toFixed(0).padStart(3)}% · 3 نجوم ${(r.three * 100).toFixed(0).padStart(3)}% · متوسط الحركات الفاضلة ${r.avgLeft}`);
  const weak = res.filter(r => r.win < 0.8);
  check(weak.length === 0, `فرقع: كل المراحل (${res.length}) لاعب بسيط من غير تخطيط بيكسبها 80% أو أكتر`, weak.map(r => r.n + ':' + Math.round(r.win * 100) + '%').join(' '));
  const no3 = res.filter(r => r.three === 0);
  check(no3.length === 0, 'فرقع: 3 نجوم ممكنة في كل مرحلة', no3.map(r => r.n).join(' '));
  fs.writeFileSync(path.join(OUT, 'pop-balance.json'), JSON.stringify(res, null, 1));
  await page.context().close();
}

async function playMemLevel(page) {
  // يلعب جولات مستوى افتكر صح لحد ما يخلص
  for (let k = 0; k < 6; k++) {
    const done = await page.evaluate(() => !__mal3ab.GAMES.mem.s.alive);
    if (done) return;
    await page.waitForFunction(() => { const s = __mal3ab.GAMES.mem.s; return s.phase === 'input' || !s.alive; }, null, { timeout: 15000 });
    const info = await page.evaluate(() => { const G = __mal3ab.GAMES.mem, s = G.s; return { alive: s.alive, numbers: !!s.digits && G.cfg.variant === 'numbers', digits: s.digits, exp: s.variant && s.variant !== 'squares' ? G.expected() : [...s.targets] }; });
    if (!info.alive) return;
    if (info.numbers) { for (const d of info.digits) await page.locator('#memPad button', { hasText: new RegExp('^' + d + '$') }).dispatchEvent('pointerdown'); }
    else for (const i of info.exp) await page.locator('.mem-grid button').nth(i).dispatchEvent('pointerdown');
    await sleep(100);
  }
}

async function testProgressFlow(browser) {
  console.log('\n--- التقدّم: فتح المستويات، XP، الحفظ، عدم تكرار المكافآت ---');
  const page = await newPage(browser);
  const st = () => page.evaluate(() => ({ xp: __mal3ab.Progress.data.xp, s2: __mal3ab.Progress.stars(2), s1: __mal3ab.Progress.stars(1), open2: __mal3ab.Progress.isUnlocked(2), open3: __mal3ab.Progress.isUnlocked(3) }));
  let s = await st();
  check(s.xp === 0 && !s.open2, 'البداية: صفر XP ومستوى 2 مقفول');
  await page.click('#nav [data-go=map]');
  await page.click('[data-lv="2"]', { force: true }); await sleep(200);
  check(await page.isHidden('#sheet'), 'الخريطة: المستوى المقفول ما بيفتحش');
  // مستوى 1 (أسرع مخ) من الخريطة بالواجهة الحقيقية
  await page.click('[data-lv="1"]', { force: true }); await page.click('#goLevel'); await sleep(200);
  for (let i = 0; i < 12; i++) { const done = await page.evaluate(() => !__mal3ab.GAMES.speed.s.alive); if (done) break; await answerRight(page); await page.waitForFunction(() => !__mal3ab.GAMES.speed.s.lock || !__mal3ab.GAMES.speed.s.alive, null, { timeout: 2000 }).catch(() => {}); }
  await page.waitForSelector('#sheet:not([hidden]) .stars-big', { timeout: 4000 }).catch(() => {});
  s = await st();
  // + 20 XP من إنجاز "أول خطوة" (المرحلة C) اللي بيتفتح مع أول فوز
  const L1 = await page.evaluate(() => { const L = __mal3ab.LEVELS[0]; return L.xpStar * 3 + L.xpFirst + __mal3ab.ACHIEVEMENTS.find(a => a.id === 'a_first').xp; });
  check(s.s1 === 3 && s.xp === L1 && s.open2, `مستوى 1: 3 نجوم من غير غلط، +${L1} XP، ومستوى 2 اتفتح`, JSON.stringify(s));
  await page.screenshot({ path: path.join(OUT, 'b-result-win.png') });
  // إعادة نفس المستوى بنفس النجوم = صفر XP
  await page.click('#rAgain'); await sleep(200);
  for (let i = 0; i < 12; i++) { const done = await page.evaluate(() => !__mal3ab.GAMES.speed.s.alive); if (done) break; await answerRight(page); await page.waitForFunction(() => !__mal3ab.GAMES.speed.s.lock || !__mal3ab.GAMES.speed.s.alive, null, { timeout: 2000 }).catch(() => {}); }
  await page.waitForSelector('#sheet:not([hidden]) .stars-big', { timeout: 4000 }).catch(() => {});
  check((await st()).xp === L1, 'إعادة مستوى بنفس النجوم ما بتدّيش XP مكرر');
  // نفس النتيجة تتبعت مرتين (نفس runId) = مرة واحدة بس
  const dup = await page.evaluate(() => { const P = __mal3ab.Progress, L = __mal3ab.LEVELS[1]; const a = P.applyResult(L, 'run-x', { won: true, stars: 2, score: 100 }); const b = P.applyResult(L, 'run-x', { won: true, stars: 3, score: 100 }); return { a: a.xp, b: b.xp, dup: b.duplicate, stars: P.stars(2) }; });
  check(dup.a > 0 && dup.b === 0 && dup.dup && dup.stars === 2, 'نفس النتيجة لو اتبعتت مرتين بتتحسب مرة واحدة', JSON.stringify(dup));
  // تحسين النجوم من 2 لـ 3 بيدّي فرق النجمة بس
  const imp = await page.evaluate(() => { const P = __mal3ab.Progress, L = __mal3ab.LEVELS[1]; const r = P.applyResult(L, 'run-y', { won: true, stars: 3, score: 100 }); return { xp: r.xp, per: L.xpStar }; });
  check(imp.xp === imp.per, 'تحسين النجوم بيدّي XP النجمة الزيادة بس');
  // الخسارة ما بتدّيش XP وما بتقللش النجوم
  const lose = await page.evaluate(() => { const P = __mal3ab.Progress, L = __mal3ab.LEVELS[1], x = P.data.xp; P.applyResult(L, 'run-z', { won: false, stars: 0, score: 5 }); return { dx: P.data.xp - x, stars: P.stars(2) }; });
  check(lose.dx === 0 && lose.stars === 3, 'الخسارة ما بتدّيش XP وما بتمسحش نجوم قديمة');
  // إعادة تحميل الصفحة: التقدّم محفوظ
  const before = await st();
  await page.reload(); await sleep(300);
  const after = await st();
  check(JSON.stringify(before) === JSON.stringify(after), 'التقدّم محفوظ بعد إعادة تحميل الصفحة');
  // بيانات تالفة في التخزين: اللعبة ما تقعش وتبدأ من جديد
  await page.evaluate(() => localStorage.setItem('mal3ab_progress', '{bad json'));
  await page.reload(); await sleep(300);
  check(page.errors.length === 0 && (await page.evaluate(() => __mal3ab.Progress.data.xp)) === 0, 'لو بيانات الحفظ بايظة اللعبة بتشتغل عادي');
  // مستويات افتكر بكل أنواعها من الواجهة
  for (const n of [2, 8, 26, 27]) {
    await page.evaluate(n => { const P = __mal3ab.Progress; for (let i = 1; i < n; i++) if (!P.stars(i)) P.data.levels[i] = { stars: 1, best: 0, plays: 1 }; P.save(); }, n);
    await page.evaluate(n => __mal3ab.App.startLevel(__mal3ab.LEVELS[n - 1]), n);
    const variant = await page.evaluate(() => __mal3ab.GAMES.mem.cfg.variant);
    await playMemLevel(page);
    await page.waitForSelector('#sheet:not([hidden]) .stars-big', { timeout: 6000 }).catch(() => {});
    const stars = await page.evaluate(n => __mal3ab.Progress.stars(n), n);
    if (n === 27) await page.screenshot({ path: path.join(OUT, 'b-mem-numbers-done.png') });
    check(stars === 3, `افتكر «${variant}» (مستوى ${n}): الفوز من غير غلط = 3 نجوم`, String(stars));
  }
  // افتكر ترتيب: دوسة بالترتيب الغلط = قلب ناقص
  await page.evaluate(() => __mal3ab.App.startLevel(__mal3ab.LEVELS[7]));
  await page.waitForFunction(() => __mal3ab.GAMES.mem.s.phase === 'input', null, { timeout: 15000 });
  const exp = await page.evaluate(() => __mal3ab.GAMES.mem.expected());
  await page.locator('.mem-grid button').nth(exp[1]).dispatchEvent('pointerdown');
  check(await page.evaluate(() => __mal3ab.GAMES.mem.s.lives) === 2, 'افتكر «order»: الدوس بترتيب غلط بيخصم قلب');
  await page.evaluate(() => __mal3ab.App.show('home'));
  check(page.errors.length === 0, 'التقدّم: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testBoss(browser) {
  console.log('\n--- الزعيم ---');
  const page = await newPage(browser);
  await page.evaluate(() => { const P = __mal3ab.Progress; for (let i = 1; i < 10; i++) P.data.levels[i] = { stars: 1, best: 0, plays: 1 }; P.save(); });
  await page.click('#nav [data-go=map]');
  await page.click('[data-lv="10"]', { force: true }); await sleep(150);
  await page.screenshot({ path: path.join(OUT, 'b-boss-sheet.png') });
  await page.click('#goLevel');
  await page.waitForSelector('.inter'); await page.screenshot({ path: path.join(OUT, 'b-boss-inter.png') });
  check(await page.isVisible('.inter'), 'الزعيم: بيعرض شاشة «الجزء 1 من 3» قبل ما يبدأ');
  await page.click('.inter button');
  // الجزء 1: أسرع مخ
  for (let i = 0; i < 30; i++) { const done = await page.evaluate(() => !__mal3ab.GAMES.speed.s.alive); if (done) break; await answerRight(page); await page.waitForFunction(() => !__mal3ab.GAMES.speed.s.lock || !__mal3ab.GAMES.speed.s.alive, null, { timeout: 2000 }).catch(() => {}); }
  await page.waitForSelector('.inter', { timeout: 4000 });
  const p1 = await page.evaluate(() => ({ part: __mal3ab.App.run.part, score: +document.querySelector('#hudScore').textContent }));
  check(p1.part === 1, 'الزعيم: بعد أسرع مخ بينقل للجزء 2', JSON.stringify(p1));
  await page.click('.inter button');
  await playMemLevel(page);
  await page.waitForSelector('.inter', { timeout: 6000 });
  check(await page.evaluate(() => __mal3ab.App.run.part) === 2, 'الزعيم: بعد افتكر بينقل للجزء 3');
  await page.click('.inter button'); await sleep(300);
  // الجزء 3: فرقع. نقرّب الهدف وبعدين دوسة حقيقية تخلّصه
  const tgt = await page.evaluate(() => { const P = __mal3ab.GAMES.pop, g = P.cfg.goal; P.s.collected[g.k] = g.n - 1; for (let r = 8; r >= 0; r--) for (let c = 0; c < 7; c++) { const x = P.L.grid[r][c]; if (x && !x.stone && !x.bomb && x.k === g.k && P.flood(r, c).length >= 2) return [r, c]; } for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) { const x = P.L.grid[r][c]; x.k = g.k; } P.render(); return [8, 0]; });
  const xy = await page.evaluate(([r, c]) => { const P = __mal3ab.GAMES.pop, rc = P.board.getBoundingClientRect(); return { x: rc.left + (c + .5) * P.cell, y: rc.top + (r + .5) * P.cell }; }, tgt);
  await page.mouse.click(xy.x, xy.y);
  await page.waitForSelector('#sheet:not([hidden]) .stars-big', { timeout: 5000 }).catch(() => {});
  const fin = await page.evaluate(() => ({ stars: __mal3ab.Progress.stars(10), bosses: __mal3ab.Progress.bossesBeaten(), total: +document.querySelector('#hudScore').textContent }));
  check(fin.stars >= 1 && fin.bosses === 1, 'الزعيم: بعد الأجزاء التلاتة اتحسب فوز', JSON.stringify(fin));
  check(fin.total > p1.score, 'الزعيم: النقط بتتجمع من الأجزاء التلاتة');
  await page.screenshot({ path: path.join(OUT, 'b-boss-win.png') });
  // خسارة في جزء = الزعيم كله يتعاد
  await page.click('#rAgain'); await page.click('.inter button');
  await page.evaluate(() => { const s = __mal3ab.GAMES.speed.s; s.time = 0.05; });
  await page.waitForSelector('#sheet:not([hidden]) .res-title', { timeout: 4000 });
  check((await page.textContent('#sheet .res-title')).includes('مش المرة دي'), 'الزعيم: الخسارة في جزء بتنهي المحاولة');
  check(page.errors.length === 0, 'الزعيم: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testScreens(browser) {
  console.log('\n--- الشاشات الجديدة ---');
  for (const [name, vp, mobile] of [['موبايل 390', { width: 390, height: 844 }, true], ['موبايل صغير 320', { width: 320, height: 568 }, true], ['كمبيوتر', { width: 1440, height: 900 }, false]]) {
    const page = await newPage(browser, vp, mobile), slug = vp.width;
    await page.evaluate(() => { const P = __mal3ab.Progress; for (let i = 1; i <= 23; i++) P.data.levels[i] = { stars: 1 + (i % 3), best: 0, plays: 1 }; P.data.xp = 1850; P.data.best = { speed: 420, pop: 2600, mem: 310 }; P.save(); __mal3ab.App.show('home'); });
    const ov = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    let ok = true;
    for (const tab of ['home', 'map', 'profile', 'settings']) {
      await page.click(`#nav [data-go=${tab}]`); await sleep(250);
      if (await ov()) ok = false;
      await page.screenshot({ path: path.join(OUT, `b-${tab}-${slug}.png`) });
    }
    await page.click('#nav [data-go=map]'); await sleep(200);
    await page.click('[data-lv="24"]', { force: true }); await sleep(250);
    await page.screenshot({ path: path.join(OUT, `b-sheet-${slug}.png`) });
    const sheetIn = await page.evaluate(() => { const r = document.querySelector('#sheetBox').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
    await page.keyboard.press('Escape');
    check(ok, `${name}: مفيش سكرول بالعرض في الشاشات الأربعة`);
    check(sheetIn && await page.isHidden('#sheet'), `${name}: شيت المستوى جوّه الشاشة ويتقفل بـ Esc`);
    check(page.errors.length === 0, `${name}: مفيش أخطاء`, page.errors.join(' | '));
    await page.context().close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const only = process.argv[2];
  try {
    for (const [k, f] of [['data', testData], ['speed', testSpeedTypes], ['pop', testPopSolvable], ['progress', testProgressFlow], ['boss', testBoss], ['screens', testScreens]]) if (!only || only === k) await f(browser);
  } catch (e) { fail++; failures.push('crash: ' + e.message); console.log('CRASH', e); }
  await browser.close();
  console.log(`\n=== المرحلة B: ${pass} نجح، ${fail} فشل ===`);
  if (failures.length) console.log('اللي فشل:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
