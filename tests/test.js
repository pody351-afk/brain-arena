// اختبارات ملعب المخ الآلية. التشغيل: node tests/test.js
// بتفتح اللعبة في متصفح حقيقي (Chromium) بمقاسات مختلفة وتلعب بالـ DOM زي اللاعب.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });
// نفس الغلاف اللي منصة النشر بتحطه حوالين الصفحة
const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>[hidden]{display:none!important}</style></head><body>' +
  fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8') + '</body></html>';
const PAGE = path.join(OUT, 'page.html');
fs.writeFileSync(PAGE, html);
const URL = 'file://' + PAGE;

let pass = 0, fail = 0;
const failures = [];
function check(cond, name, extra = '') {
  if (cond) { pass++; console.log('PASS ', name); }
  else { fail++; failures.push(name); console.log('FAIL ', name, extra); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, vp = { width: 390, height: 844 }, mobile = true) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // نحاكي عدم وجود إنترنت للخطوط
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) page.errors.push(m.text()); });
  await page.goto(URL);
  return page;
}

// "لاعب مثالي": يحل سؤال أسرع مخ من اللي ظاهر على الشاشة بس، ويرجّع الزرار الصح
const SOLVER = () => {
  const prompt = document.querySelector('#sbPrompt').textContent;
  const ans = [...document.querySelectorAll('#sbAns .ans')];
  const odd = [...document.querySelectorAll('.odd button')];
  const evalExpr = t => { const m = t.replace('−', '-').replace('×', '*').match(/(\d+)\s*([-+*])\s*(\d+)/); const a = +m[1], b = +m[3]; return m[2] === '+' ? a + b : m[2] === '-' ? a - b : a * b; };
  if (odd.length) {
    const cols = odd.map(b => b.style.background);
    const idx = cols.findIndex(c => cols.filter(x => x === c).length === 1);
    return { type: 'odd', index: idx, unique: idx >= 0 && cols.filter(c => c === cols[idx]).length === 1, n: odd.length };
  }
  if (prompt.includes('صح ولا غلط')) {
    const t = document.querySelector('.eq').textContent; const [l, r] = t.split('=');
    const truth = evalExpr(l) === +r.trim();
    return { type: 'tf', index: ans.findIndex(b => b.textContent === (truth ? 'صح' : 'غلط')), text: t };
  }
  if (prompt.includes('لون')) {
    const w = document.querySelector('.word');
    const map = { 'rgb(255, 90, 95)': 'أحمر', 'rgb(77, 141, 255)': 'أزرق', 'rgb(61, 220, 132)': 'أخضر', 'rgb(255, 210, 63)': 'أصفر' };
    const ink = map[getComputedStyle(w).color];
    return { type: 'stroop', index: ans.findIndex(b => b.textContent === ink), labels: ans.map(b => b.textContent) };
  }
  if (prompt.includes('أكبر')) {
    const v = ans.map(b => evalExpr(b.textContent));
    return { type: 'bigger', index: v.indexOf(Math.max(...v)), distinct: v[0] !== v[1] };
  }
  return { type: 'unknown', index: -1 };
};
async function tapCorrect(page) {
  const sol = await page.evaluate(SOLVER);
  const sel = sol.type === 'odd' ? '.odd button' : '#sbAns .ans';
  if (sol.index >= 0) await page.locator(sel).nth(sol.index).dispatchEvent('pointerdown');
  return sol;
}
async function waitUnlocked(page) { await page.waitForFunction(() => !__mal3ab.GAMES.speed.s.lock, null, { timeout: 3000 }); }

async function testSpeed(browser) {
  console.log('\n--- أسرع مخ ---');
  const page = await newPage(browser);
  await page.click('.card[data-g=speed]');
  // 1) الإجابات محسوبة صح: 60 سؤال باللاعب المثالي، لازم كلهم يتحسبوا صح
  const types = {}; let solverOk = true; let expected = 0; let combo = 0;
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => { __mal3ab.GAMES.speed.s.time = 30; }); // نمنع انتهاء الوقت أثناء الاختبار
    const before = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
    const sol = await tapCorrect(page);
    types[sol.type] = (types[sol.type] || 0) + 1;
    if (sol.index < 0 || (sol.type === 'odd' && !sol.unique) || (sol.type === 'bigger' && !sol.distinct)) solverOk = false;
    combo++; expected += 10 * Math.min(5, 1 + Math.floor(combo / 3));
    await waitUnlocked(page);
    const after = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
    if (after !== before + 1) { solverOk = false; console.log('   سؤال اتحسب غلط:', JSON.stringify(sol)); break; }
  }
  console.log('   أنواع الأسئلة اللي ظهرت:', JSON.stringify(types));
  check(solverOk, 'أسرع مخ: 60 إجابة صحيحة اتحسبت صح (كل الأنواع ليها إجابة واحدة صحيحة)');
  check(Object.keys(types).length === 4, 'أسرع مخ: الأنواع الأربعة ظهرت');
  const score = await page.evaluate(() => __mal3ab.score);
  check(score === expected, 'أسرع مخ: النقاط = المعادلة (10 × المضاعف)', `got ${score} expected ${expected}`);
  // 2) إجابة غلط: ناقص 3 ثواني والكومبو يرجع صفر
  await page.evaluate(() => { __mal3ab.GAMES.speed.s.time = 20; });
  let sol = await page.evaluate(SOLVER);
  const wrongSel = sol.type === 'odd' ? '.odd button' : '#sbAns .ans';
  const wrongIdx = sol.index === 0 ? 1 : 0;
  const t0 = await page.evaluate(() => __mal3ab.GAMES.speed.s.time);
  await page.locator(wrongSel).nth(wrongIdx).dispatchEvent('pointerdown');
  const st = await page.evaluate(() => ({ t: __mal3ab.GAMES.speed.s.time, c: __mal3ab.GAMES.speed.s.combo }));
  check(st.c === 0 && t0 - st.t >= 2.9 && t0 - st.t < 3.5, 'أسرع مخ: الإجابة الغلط تخصم 3 ثواني وتصفّر الكومبو', JSON.stringify({ t0, ...st }));
  await waitUnlocked(page);
  // 3) دوسة مزدوجة على نفس الإجابة تتحسب مرة واحدة
  await page.evaluate(() => { __mal3ab.GAMES.speed.s.time = 20; });
  const c0 = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
  sol = await page.evaluate(SOLVER);
  const sel = sol.type === 'odd' ? '.odd button' : '#sbAns .ans';
  await page.locator(sel).nth(sol.index).dispatchEvent('pointerdown');
  await page.locator(sel).nth(sol.index).dispatchEvent('pointerdown').catch(() => {});
  await waitUnlocked(page);
  check(await page.evaluate(() => __mal3ab.GAMES.speed.s.correct) === c0 + 1, 'أسرع مخ: الدوسة المزدوجة تتحسب مرة واحدة');
  // 4) الإجابة الصحيحة مش ظاهرة قبل ما اللاعب يجاوب (مفيش علامة على الزرار الصح)
  const leak = await page.evaluate(() => [...document.querySelectorAll('#sbAns .ans, .odd button')].some(b => b.classList.contains('right') || b.dataset.correct));
  check(!leak, 'أسرع مخ: مفيش تلميح للإجابة الصح قبل الإجابة');
  // 5) الكيبورد: Enter على زرار إجابة لازم يجاوب
  await page.evaluate(() => { __mal3ab.GAMES.speed.s.time = 20; });
  const k0 = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct + __mal3ab.GAMES.speed.s.combo * 0);
  sol = await page.evaluate(SOLVER);
  const kSel = sol.type === 'odd' ? '.odd button' : '#sbAns .ans';
  await page.locator(kSel).nth(sol.index).focus();
  await page.keyboard.press('Enter');
  await sleep(300);
  const k1 = await page.evaluate(() => __mal3ab.GAMES.speed.s.correct);
  check(k1 === k0 + 1, 'أسرع مخ: ينفع تجاوب بالكيبورد (Enter)');
  // 6) لو اللاعب خرج من التطبيق ورجع (الصفحة اتخفت) الوقت ما يتخصمش كله مرة واحدة
  await page.evaluate(() => { const s = __mal3ab.GAMES.speed.s; s.time = 20; s.last = performance.now() - 25000; }); // محاكاة رجوع بعد 25 ثانية
  await sleep(150);
  const alive = await page.evaluate(() => __mal3ab.GAMES.speed.s.alive);
  check(alive, 'أسرع مخ: الرجوع للتطبيق بعد غياب ما يخسّرش اللاعب فجأة');
  // 7) نهاية الوقت: شاشة النتيجة + حفظ أحسن نتيجة
  await page.evaluate(() => { const s = __mal3ab.GAMES.speed.s; s.time = 0.05; s.last = performance.now(); s.alive = true; });
  await page.waitForSelector('#over:not([hidden])', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('#over'), 'أسرع مخ: شاشة النتيجة تظهر لما الوقت يخلص');
  const final = await page.evaluate(() => __mal3ab.score);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mal3ab_best_speed')));
  check(saved === final, 'أسرع مخ: أحسن نتيجة اتحفظت', `${saved} vs ${final}`);
  // 8) إعادة تحميل الصفحة: أحسن نتيجة لسه موجودة
  await page.reload();
  const bestText = await page.textContent('[data-best=speed]');
  check(bestText.includes(String(final)), 'الحفظ: أحسن نتيجة بتفضل بعد إعادة تحميل الصفحة', bestText);
  // 9) نتيجة أقل ما تمسحش الرقم القياسي
  await page.click('.card[data-g=speed]');
  await page.evaluate(() => { const s = __mal3ab.GAMES.speed.s; s.time = 0.05; });
  await page.waitForSelector('#over:not([hidden])', { timeout: 3000 }).catch(() => {});
  const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mal3ab_best_speed')));
  check(saved2 === final, 'الحفظ: نتيجة أقل ما بتمسحش الرقم القياسي');
  check(page.errors.length === 0, 'أسرع مخ: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testPop(browser) {
  console.log('\n--- فرقع ---');
  const page = await newPage(browser);
  await page.click('.card[data-g=pop]');
  await sleep(400);
  const cellXY = (r, c) => page.evaluate(([r, c]) => { const P = __mal3ab.GAMES.pop, rc = P.board.getBoundingClientRect(); return { x: rc.left + (c + .5) * P.cell, y: rc.top + (r + .5) * P.cell }; }, [r, c]);
  const waitIdle = () => page.waitForFunction(() => !__mal3ab.GAMES.pop.s.busy, null, { timeout: 3000 });
  // 1) لوحة معروفة: نبني اللوحة بإيدينا عشان نتأكد من الحسابات
  await page.evaluate(() => {
    const P = __mal3ab.GAMES.pop, g = P.s.grid;
    // شطرنج من لونين (مفيش ولا مجموعة) + 6 من لون 2 في الصف الأخير من الشمال
    for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) { g[r][c].k = (r + c) % 2; g[r][c].bomb = false; }
    for (let c = 0; c < 6; c++) g[8][c].k = 2;
    g[7][0].k = 3; g[7][1].k = 3; // مجموعة من 2
    P.render();
  });
  // دوسة على قطعة لوحدها: ما تخصمش حركة
  let p = await cellXY(0, 0);
  const m0 = await page.evaluate(() => __mal3ab.GAMES.pop.s.moves);
  await page.mouse.click(p.x, p.y); await sleep(100);
  check(await page.evaluate(() => __mal3ab.GAMES.pop.s.moves) === m0, 'فرقع: الدوس على قطعة لوحدها ما يخصمش حركة');
  // مجموعة من 2 = 2×2×5 = 20 نقطة
  p = await cellXY(7, 0);
  await page.mouse.click(p.x, p.y); await waitIdle();
  let st = await page.evaluate(() => ({ score: __mal3ab.score, moves: __mal3ab.GAMES.pop.s.moves }));
  check(st.score === 20 && st.moves === m0 - 1, 'فرقع: مجموعة من 2 = 20 نقطة وحركة واحدة', JSON.stringify(st));
  // 6 = 180 نقطة + قنبلة مكان الدوسة
  p = await cellXY(8, 2);
  await page.mouse.click(p.x, p.y); await waitIdle();
  st = await page.evaluate(() => ({ score: __mal3ab.score, bomb: __mal3ab.GAMES.pop.s.grid[8][2].bomb }));
  check(st.score === 200 && st.bomb, 'فرقع: مجموعة من 6 = 180 نقطة وتعمل قنبلة', JSON.stringify(st));
  // القنبلة تمسح 3×3 = 150 + 6 قطع × 20 (في الصف الأخير 3×2 = 6 قطع)
  p = await cellXY(8, 2);
  await page.mouse.click(p.x, p.y); await waitIdle();
  st = await page.evaluate(() => ({ score: __mal3ab.score, bombs: __mal3ab.GAMES.pop.s.grid.flat().filter(x => x.bomb).length }));
  check(st.score === 200 + 150 + 6 * 20 && st.bombs === 0, 'فرقع: القنبلة تمسح 3×3 بالنقاط الصح', JSON.stringify(st));
  // 2) اللوحة سليمة: مفيش خانات فاضية والعناصر على الشاشة = 63
  const inv = await page.evaluate(() => { const P = __mal3ab.GAMES.pop; const ids = P.s.grid.flat().map(x => x && x.id); return { nulls: ids.filter(x => !x).length, dom: document.querySelectorAll('.candy:not(.popping)').length, mapped: ids.every(id => P.els.has(id)) }; });
  check(inv.nulls === 0 && inv.dom === 63 && inv.mapped, 'فرقع: اللوحة كاملة بعد كل حركة (63 قطعة)', JSON.stringify(inv));
  // 3) اللوحة ما تبقاش مستحيلة: لو مفيش ولا مجموعة، اللعبة تخلطها
  const playable = await page.evaluate(() => {
    const P = __mal3ab.GAMES.pop, g = P.s.grid; let ok = 0;
    for (let t = 0; t < 30; t++) {
      for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) { g[r][c].k = (r + c) % 2; g[r][c].bomb = false; }
      P.ensurePlayable();
      let has = false; for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (P.flood(r, c).length >= 2) has = true;
      if (has) ok++;
    }
    P.render(); return ok;
  });
  check(playable === 30, 'فرقع: لوحة من غير حلول بتتخلط تلقائيًا (30/30)');
  // 4) دوسة مزدوجة سريعة = حركة واحدة
  const two = await page.evaluate(() => { const P = __mal3ab.GAMES.pop; for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (P.flood(r, c).length >= 2 && P.flood(r, c).length < 6) return [r, c]; return null; });
  const mBefore = await page.evaluate(() => __mal3ab.GAMES.pop.s.moves);
  p = await cellXY(two[0], two[1]);
  await page.mouse.click(p.x, p.y); await page.mouse.click(p.x, p.y);
  await waitIdle();
  check(await page.evaluate(() => __mal3ab.GAMES.pop.s.moves) === mBefore - 1, 'فرقع: الدوسة المزدوجة تتحسب حركة واحدة');
  // 5) الوصول للهدف = مرحلة جديدة وحركات جديدة
  await page.evaluate(() => { const P = __mal3ab.GAMES.pop; P.s.score = P.s.target - 1; });
  const g2 = await page.evaluate(() => { const P = __mal3ab.GAMES.pop; for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (!P.s.grid[r][c].bomb && P.flood(r, c).length >= 2) return [r, c]; });
  p = await cellXY(g2[0], g2[1]);
  await page.mouse.click(p.x, p.y); await waitIdle(); await sleep(300);
  st = await page.evaluate(() => ({ l: __mal3ab.GAMES.pop.s.level, m: __mal3ab.GAMES.pop.s.moves }));
  check(st.l === 2 && st.m === 20, 'فرقع: الوصول للهدف يفتح المرحلة 2 بـ 20 حركة', JSON.stringify(st));
  // 6) الحركات تخلص = نهاية اللعبة
  await page.evaluate(() => { __mal3ab.GAMES.pop.s.moves = 1; });
  const g3 = await page.evaluate(() => { const P = __mal3ab.GAMES.pop; for (let r = 0; r < P.ROWS; r++) for (let c = 0; c < P.COLS; c++) if (!P.s.grid[r][c].bomb && P.flood(r, c).length >= 2) return [r, c]; });
  p = await cellXY(g3[0], g3[1]);
  await page.mouse.click(p.x, p.y);
  await page.waitForSelector('#over:not([hidden])', { timeout: 3000 }).catch(() => {});
  check(await page.isVisible('#over'), 'فرقع: الحركات لما تخلص تظهر شاشة النتيجة');
  // 7) الكيبورد: نلعب حركة كاملة بالأسهم و Enter
  await page.click('#againBtn'); await sleep(400);
  const tgt = await page.evaluate(() => { const P = __mal3ab.GAMES.pop; for (let r = P.ROWS - 1; r >= 0; r--) for (let c = 0; c < P.COLS; c++) if (P.flood(r, c).length >= 2 && P.flood(r, c).length < 6) return [r, c]; });
  await page.focus('#popBoard');
  for (let i = 0; i < 8 - tgt[0]; i++) await page.keyboard.press('ArrowUp');
  for (let i = 0; i < tgt[1]; i++) await page.keyboard.press('ArrowRight');
  const curOk = await page.evaluate(([r, c]) => __mal3ab.GAMES.pop.cur.r === r && __mal3ab.GAMES.pop.cur.c === c, tgt);
  await page.keyboard.press('Enter'); await waitIdle();
  const kbMoves = await page.evaluate(() => __mal3ab.GAMES.pop.s.moves);
  check(curOk && kbMoves === 19, 'فرقع: ينفع تتلعب بالكيبورد (أسهم + Enter)', JSON.stringify({ curOk, kbMoves }));
  check(page.errors.length === 0, 'فرقع: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testMem(browser) {
  console.log('\n--- افتكر ---');
  const page = await newPage(browser);
  await page.click('.card[data-g=mem]');
  const S = () => page.evaluate(() => { const s = __mal3ab.GAMES.mem.s; return { phase: s.phase, level: s.level, lives: s.lives, found: s.found.size, targets: [...s.targets], score: __mal3ab.score }; });
  const btn = i => page.locator('.mem-grid button').nth(i);
  // 1) الدوس وقت العرض ما يتحسبش
  await page.waitForFunction(() => document.querySelector('.mem-grid button.lit'), null, { timeout: 3000 });
  let s = await S();
  await btn(s.targets[0]).dispatchEvent('pointerdown');
  check((await S()).found === 0, 'افتكر: الدوس وقت ما المربعات منوّرة ما يتحسبش');
  // 2) المستويات والعدد
  const counts = [];
  for (let lvl = 1; lvl <= 4; lvl++) {
    await page.waitForFunction(() => __mal3ab.GAMES.mem.s.phase === 'input', null, { timeout: 8000 });
    s = await S(); counts.push(s.targets.length);
    // دوسة مزدوجة على أول مربع صح: لازم تتحسب مرة واحدة
    await btn(s.targets[0]).dispatchEvent('pointerdown'); await btn(s.targets[0]).dispatchEvent('pointerdown');
    if (lvl === 1) check((await S()).found === 1, 'افتكر: الدوسة المزدوجة على مربع صح تتحسب مرة واحدة');
    for (const i of s.targets.slice(1)) await btn(i).dispatchEvent('pointerdown');
    await sleep(50);
  }
  check(JSON.stringify(counts) === '[3,4,5,6]', 'افتكر: كل مستوى بيزوّد مربع (3،4،5،6)', JSON.stringify(counts));
  s = await S();
  // النقاط: مستوى1 3×10×1 + مستوى2 4×10×2 + مستوى3 5×10×3 + مستوى4 6×10×3
  check(s.score === 30 + 80 + 150 + 180, 'افتكر: النقاط مع مضاعف السلسلة محسوبة صح', String(s.score));
  // 3) دوسة غلط مزدوجة = قلب واحد بس
  await page.waitForFunction(() => __mal3ab.GAMES.mem.s.phase === 'input', null, { timeout: 8000 });
  s = await S();
  const n = await page.locator('.mem-grid button').count();
  let wrong = 0; while (s.targets.includes(wrong)) wrong++;
  await btn(wrong).dispatchEvent('pointerdown'); await btn(wrong).dispatchEvent('pointerdown');
  check((await S()).lives === 2, 'افتكر: دوسة غلط مزدوجة تخصم قلب واحد بس');
  // كيبورد: Enter على مربع صح يتحسب
  await page.waitForFunction(() => __mal3ab.GAMES.mem.s.phase === 'input', null, { timeout: 8000 });
  s = await S();
  await btn(s.targets[0]).focus(); await page.keyboard.press('Enter');
  check((await S()).found === 1, 'افتكر: ينفع تتلعب بالكيبورد (Enter)');
  for (const i of s.targets.slice(1)) await btn(i).dispatchEvent('pointerdown');
  // 4) 3 أخطاء = نهاية
  for (let k = 0; k < 2; k++) {
    await page.waitForFunction(() => __mal3ab.GAMES.mem.s.phase === 'input', null, { timeout: 8000 });
    s = await S(); let w = 0; while (s.targets.includes(w)) w++;
    await btn(w).dispatchEvent('pointerdown');
  }
  await page.waitForSelector('#over:not([hidden])', { timeout: 4000 }).catch(() => {});
  check(await page.isVisible('#over'), 'افتكر: 3 أخطاء تنهي اللعبة وتظهر النتيجة');
  // 5) الخروج في نص العرض: مفيش أحداث متأخرة
  await page.click('#againBtn');
  await sleep(300);
  await page.click('#backBtn');
  await sleep(2500);
  check(!(await page.isVisible('#over')) && await page.isVisible('#home'), 'افتكر: الخروج في النص ما يسيبش مؤقتات شغّالة');
  check(page.errors.length === 0, 'افتكر: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

async function testScreens(browser) {
  console.log('\n--- الشاشات ---');
  const sizes = [
    ['موبايل صغير 320×568', { width: 320, height: 568 }, true],
    ['موبايل 390×844', { width: 390, height: 844 }, true],
    ['موبايل بالعرض 844×390', { width: 844, height: 390 }, true],
    ['تابلت 768×1024', { width: 768, height: 1024 }, true],
    ['كمبيوتر 1440×900', { width: 1440, height: 900 }, false],
  ];
  for (const [name, vp, mobile] of sizes) {
    const page = await newPage(browser, vp, mobile);
    const slug = vp.width + 'x' + vp.height;
    const overflowX = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const inView = sel => page.evaluate(s => [...document.querySelectorAll(s)].every(e => { const r = e.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; }), sel);
    let ok = !(await overflowX());
    await page.screenshot({ path: path.join(OUT, `home-${slug}.png`) });
    await page.click('.card[data-g=speed]'); await sleep(300);
    await page.evaluate(() => { __mal3ab.GAMES.speed.s.time = 30; });
    const speedOk = await inView('#sbAns .ans, .odd button, .eq, .word');
    await page.screenshot({ path: path.join(OUT, `speed-${slug}.png`) });
    await page.click('#backBtn'); await page.click('.card[data-g=pop]'); await sleep(500);
    const popOk = await inView('#popBoard');
    const cell = await page.evaluate(() => __mal3ab.GAMES.pop.cell);
    await page.screenshot({ path: path.join(OUT, `pop-${slug}.png`) });
    await page.click('#backBtn'); await page.click('.card[data-g=mem]'); await sleep(900);
    const memOk = await inView('.mem-grid button');
    await page.screenshot({ path: path.join(OUT, `mem-${slug}.png`) });
    ok = ok && !(await overflowX());
    check(ok, `${name}: مفيش سكرول بالعرض`);
    check(speedOk, `${name}: أسرع مخ كله ظاهر في الشاشة`);
    check(popOk && cell >= 28, `${name}: لوحة فرقع كلها ظاهرة والقطع كبيرة كفاية للمس (${cell}px)`);
    check(memOk, `${name}: مربعات افتكر كلها ظاهرة`);
    await page.context().close();
  }
}

async function testAgain(browser) {
  console.log('\n--- العب تاني ---');
  const page = await newPage(browser);
  for (const g of ['speed', 'pop', 'mem']) {
    await page.click(`.card[data-g=${g}]`); await sleep(300);
    await page.evaluate(g => { const G = __mal3ab.GAMES[g]; if (g === 'speed') G.s.time = 0.05; else if (g === 'pop') { G.s.moves = 0; G.afterMove(); } else { G.s.lives = 1; G.s.phase = 'input'; let w = 0; while (G.s.targets.has(w)) w++; G.tapCell(w, G.cells[w]); } }, g);
    await page.waitForSelector('#over:not([hidden])', { timeout: 4000 }).catch(() => {});
    await page.click('#againBtn'); await sleep(300);
    const st = await page.evaluate(() => ({ playing: !document.querySelector('#play').hidden, overHidden: document.querySelector('#over').hidden, score: __mal3ab.score }));
    check(st.playing && st.overHidden && st.score === 0, `العب تاني: ${g} بيبدأ جولة جديدة من الصفر`, JSON.stringify(st));
    await page.click('#backBtn');
  }
  check(page.errors.length === 0, 'العب تاني: مفيش أخطاء JavaScript', page.errors.join(' | '));
  await page.context().close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await testSpeed(browser);
    await testPop(browser);
    await testMem(browser);
    await testAgain(browser);
    await testScreens(browser);
  } catch (e) { fail++; failures.push('crash: ' + e.message); console.log('CRASH', e); }
  await browser.close();
  console.log(`\n=== ${pass} نجح، ${fail} فشل ===`);
  if (failures.length) console.log('اللي فشل:\n - ' + failures.join('\n - '));
  process.exit(fail ? 1 : 0);
})();
