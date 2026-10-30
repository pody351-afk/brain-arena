// اختبارات «كوّن كلمة»: بنك الألغاز، اللعب الحر، المستويات، عالم الكلمات، الزعيم 11، الربط بالمهام، والمقاسات.
// التشغيل: NODE_PATH=$(npm root -g) node tests/word.test.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'test-output');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'file://' + path.join(ROOT, 'index.html');

let pass = 0, fail = 0; const failures = [];
const check = (c, n, x = '') => { if (c) { pass++; console.log('PASS ', n); } else { fail++; failures.push(n); console.log('FAIL ', n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function newPage(browser, vp = { width: 390, height: 844 }, mobile = true) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: mobile, isMobile: mobile });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL); await sleep(300);
  return page;
}
// كتابة كلمة بالكيبورد (أحداث keydown حقيقية زي الكيبورد العربي)
const typeWord = (page, w) => page.evaluate(w => { for (const ch of w) document.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true })); }, w);
// دوس على حروف الكلمة في الدايرة باللمس
async function tapWord(page, w) { for (const ch of w) await page.locator('.wd-l:not(.on)', { hasText: ch }).first().tap(); }

(async () => {
  const browser = await chromium.launch();

  /* ---------- 1. بنك الألغاز ---------- */
  {
    const page = await newPage(browser);
    const d = await page.evaluate(() => {
      const bad = [], dupW = [], short = [], few = [];
      WORD_PUZZLES.forEach(p => {
        p.w.forEach(w => { if (!wordFits(w, p.l)) bad.push(p.l + ':' + w); if ([...w].length < 3) short.push(w); });
        if (new Set(p.w).size !== p.w.length) dupW.push(p.l);
        if (p.w.length < 2) few.push(p.l);
      });
      // في الألغاز اللي حروفها 4 أو أكتر، الكلمة الطويلة (اللي بتستخدم كل الحروف) لازم تكون موجودة لو فيه واحدة معروفة
      const n = WORD_PUZZLES.length, letters = new Set(WORD_PUZZLES.map(p => p.l)).size;
      const tiers = Object.fromEntries(Object.entries(WORD_TIERS).map(([k, v]) => [k, v.length]));
      return { bad, dupW, short, few, n, letters, tiers, words: WORD_PUZZLES.reduce((a, p) => a + p.w.length, 0),
        fitsSelf: wordFits('قلب', 'قلب') && !wordFits('قلبب', 'قلب') && !wordFits('حرف', 'قلب') };
    });
    check(d.fitsSelf, 'البنك: دالة التحقق شغالة (حرف واحد مرة واحدة)');
    check(!d.bad.length, 'البنك: كل كلمة بتتكوّن من حروف لغزها', d.bad.join(' '));
    check(!d.dupW.length, 'البنك: مفيش كلمة متكررة جوه لغز', d.dupW.join(' '));
    check(!d.short.length, 'البنك: كل الكلمات 3 حروف أو أكتر', d.short.join(' '));
    check(!d.few.length, 'البنك: كل لغز فيه كلمتين على الأقل', d.few.join(' '));
    check(d.n === d.letters, 'البنك: مفيش لغزين بنفس الحروف', d.n + ' / ' + d.letters);
    check(d.n >= 60 && d.words >= 250, 'البنك: 60+ لغز و250+ كلمة', `${d.n} لغز، ${d.words} كلمة`);
    check(d.tiers[3] >= 15 && d.tiers[4] >= 30 && d.tiers[5] >= 4 && d.tiers[6] >= 1, 'البنك: كل مستويات الصعوبة فيها ألغاز', JSON.stringify(d.tiers));
    await page.context().close();
  }

  /* ---------- 2. عالم الكلمات في المستويات ---------- */
  {
    const page = await newPage(browser);
    const L = await page.evaluate(() => {
      const { LEVELS, WORLDS, Progress } = __mal3ab, w9 = WORLDS[8], lv = LEVELS.filter(L => L.world === 9);
      const ps = lv.filter(L => !L.boss).map(L => L.cfg.p);
      return { total: LEVELS.length, worlds: WORLDS.length, w9: w9.name, n9: lv.length, open101: Progress.isUnlocked(101), open102: Progress.isUnlocked(102),
        open11: Progress.isUnlocked(11), distinct: new Set(ps).size === ps.length, allWord: lv.filter(L => !L.boss).every(L => L.game === 'word'),
        needOk: lv.filter(L => !L.boss).every(L => L.cfg.need >= 2 && L.cfg.need <= WORD_PUZZLES[L.cfg.p].w.length),
        boss: LEVELS[109].boss && LEVELS[109].parts.map(p => p.game).join(','), goals: lv.every(L => L.goal && !/undefined|NaN/.test(L.goal)),
        bosses: LEVELS.filter(L => L.boss).length };
    });
    check(L.total === 110 && L.worlds === 9 && L.n9 === 10, 'المستويات: 110 مستوى في 9 عوالم، و10 في عالم الكلمات', JSON.stringify(L));
    check(L.open101 && !L.open102 && !L.open11, 'المستويات: عالم الكلمات مفتوح من الأول (101 بس)، والباقي بالترتيب');
    check(L.allWord && L.distinct && L.needOk, 'المستويات: 9 مستويات كلمات، كل واحد لغز مختلف وهدف معقول');
    check(L.boss === 'word,speed,mem' && L.bosses === 11, 'المستويات: زعيم 110 = كلمات + أسرع مخ + افتكر (11 زعيم)', L.boss);
    check(L.goals, 'المستويات: كل أهداف عالم الكلمات مكتوبة صح');
    check(!page.errors.length, 'المستويات: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 3. اللعب الحر ---------- */
  {
    const page = await newPage(browser);
    await page.tap('.card[data-g="word"]'); await sleep(300);
    check(await page.locator('#play').isVisible() && (await page.innerText('#hudTitle')) === 'كوّن كلمة', 'الحر: اللعبة بتفتح من كارت الرئيسية');
    const p0 = await page.evaluate(() => ({ l: WordGame.s.puzzle.l.length, w: WordGame.s.puzzle.w.slice(), slots: document.querySelectorAll('.wd-word').length, ring: document.querySelectorAll('.wd-l').length }));
    check(p0.l === 3 && p0.ring === 3 && p0.slots === p0.w.length, 'الحر: أول لغز سهل (3 حروف) والمربعات قد عدد الكلمات', JSON.stringify(p0));
    await tapWord(page, p0.w[0]); await sleep(200);
    const s1 = await page.evaluate(() => ({ got: [...WordGame.s.got], score: WordGame.s.score, cur: WordGame.current() }));
    check(s1.got.includes(p0.w[0]) && s1.score === [...p0.w[0]].length * 10 && s1.cur === '', 'الحر: الكلمة بتتقبل لوحدها باللمس والنقط = 10 × الحروف', JSON.stringify(s1));
    check(await page.locator('.wd-word.got').count() === 1 && (await page.locator('.wd-word.got').innerText()).replace(/\s/g, '') === p0.w[0], 'الحر: الكلمة ظهرت في مكانها');
    await sleep(1000);
    // نفس الكلمة تاني بالكيبورد + تأكيد
    await typeWord(page, p0.w[0]); await page.tap('#wdOk'); await sleep(100);
    check((await page.innerText('#wdCur')).includes('لقيتها قبل كده'), 'الحر: نفس الكلمة مرتين = "لقيتها قبل كده"');
    await sleep(1000);
    // كلمة غلط
    const wrong = await page.evaluate(() => { const l = WordGame.s.puzzle.l; for (const a of l) for (const b of l) for (const c of l) { const w = a + b + c; if (a !== b && b !== c && a !== c && !WordGame.s.puzzle.w.includes(w)) return w; } return null; });
    if (wrong) { await typeWord(page, wrong); await page.tap('#wdOk'); await sleep(100); }
    check(!wrong || (await page.innerText('#wdCur')).includes('مش في القايمة'), 'الحر: كلمة مش موجودة = "مش في القايمة"', wrong);
    check(await page.evaluate(() => WordGame.s.got.size) === 1, 'الحر: الكلمة الغلط ما اتحسبتش');
    await sleep(1000);
    // امسح، Escape، لخبط
    await typeWord(page, p0.w[1].slice(0, 2)); await page.tap('#wdDel');
    check(await page.evaluate(() => WordGame.current().length) === 1, 'الحر: «امسح» بيشيل آخر حرف');
    await page.keyboard.press('Escape');
    check(await page.evaluate(() => WordGame.current()) === '', 'الحر: Escape بيمسح الكلمة');
    const before = await page.evaluate(() => [...document.querySelectorAll('.wd-l')].map(b => b.textContent).sort().join(''));
    await page.tap('#wdShuf');
    check(await page.evaluate(() => [...document.querySelectorAll('.wd-l')].map(b => b.textContent).sort().join('')) === before, 'الحر: «لخبط» بيغيّر الأماكن بس، مش الحروف');
    // تلميح
    await page.tap('#wdHint'); await sleep(100);
    const h = await page.evaluate(() => ({ left: WordGame.s.hintsLeft, used: WordGame.s.hintsUsed, shown: Object.values(WordGame.s.shown).reduce((a, b) => a + b, 0), btn: document.querySelector('#wdHint').textContent }));
    check(h.left === 2 && h.used === 1 && h.shown === 1 && h.btn.includes('(2)'), 'الحر: التلميح بيكشف حرف واحد وبيقل العداد', JSON.stringify(h));
    // نخلّص اللغز: لغز جديد يتحمّل + وقت زيادة + 50 نقطة
    const t0 = await page.evaluate(() => WordGame.s.time), sc0 = await page.evaluate(() => WordGame.s.score);
    for (const w of p0.w.slice(1)) { await typeWord(page, w); await sleep(60); }
    await sleep(1200);
    const n = await page.evaluate(() => ({ solved: WordGame.s.solved, l: WordGame.s.puzzle.l.join(''), time: WordGame.s.time, score: WordGame.s.score, got: WordGame.s.got.size }));
    const rest = p0.w.slice(1).reduce((a, w) => a + [...w].length * 10, 0);
    check(n.solved === 1 && n.got === 0, 'الحر: بعد ما تخلّص اللغز، لغز جديد بيبدأ', JSON.stringify(n));
    check(n.score === sc0 + rest + 50, 'الحر: مكافأة 50 نقطة على اللغز', `${n.score} vs ${sc0 + rest + 50}`);
    check(n.time > t0, 'الحر: الوقت زاد بعد اللغز', `${t0.toFixed(1)} → ${n.time.toFixed(1)}`);
    // الوقت يخلص: شاشة النهاية + أحسن نتيجة
    await page.evaluate(() => { WordGame.s.time = 0.05; }); await sleep(900);
    const over = await page.locator('#over').isVisible(), note = await page.innerText('#overNote'), best = await page.evaluate(() => __mal3ab.Progress.data.best.word);
    check(over && note.includes('كلمة') && best === n.score, 'الحر: لما الوقت يخلص تظهر النتيجة وتتحفظ كأحسن نتيجة', `${note} best=${best}`);
    check(await page.evaluate(() => __mal3ab.Meta.data.stats.words) === p0.w.length, 'الحر: عدد الكلمات اتحسب للإنجازات', await page.evaluate(() => __mal3ab.Meta.data.stats.words));
    await page.tap('#againBtn'); await sleep(300);
    check(await page.evaluate(() => WordGame.s.alive && WordGame.s.score === 0 && WordGame.s.solved === 0), 'الحر: «العب تاني» بيبدأ من الأول');
    await page.tap('#backBtn'); await sleep(200);
    check(await page.locator('#home').isVisible() && (await page.innerText('.card[data-g="word"] .bs')).includes(String(n.score)), 'الحر: الرئيسية بتعرض أحسن نتيجة');
    check(!page.errors.length, 'الحر: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 4. المستويات: النجوم والخسارة والخروج ---------- */
  {
    const page = await newPage(browser);
    const play = async (n, hints = 0, timeout = false) => {
      await page.evaluate(n => { const { App, LEVELS } = __mal3ab; App.closeSheet(); App.startLevel(LEVELS[n - 1]); document.querySelectorAll('.inter button').forEach(b => b.click()); }, n);
      await sleep(250);
      for (let i = 0; i < hints; i++) await page.tap('#wdHint');
      if (timeout) { await page.evaluate(() => { WordGame.s.time = 0.05; }); await sleep(900); return; }
      const ws = await page.evaluate(() => WordGame.s.puzzle.w), need = await page.evaluate(() => WordGame.need());
      for (const w of ws.slice(0, need)) { await typeWord(page, w); await sleep(50); }
      await sleep(1200);
    };
    await play(101, 0);
    check(await page.evaluate(() => __mal3ab.Progress.stars(101)) === 3 && (await page.innerText('#sheetBox')).includes('ممتاز'), 'المستويات: من غير تلميح = 3 نجوم');
    await play(102, 1);
    check(await page.evaluate(() => __mal3ab.Progress.stars(102)) === 2, 'المستويات: تلميح واحد = نجمتين');
    await play(103, 2);
    check(await page.evaluate(() => __mal3ab.Progress.stars(103)) === 1, 'المستويات: تلميحين = نجمة');
    await play(104, 0, true);
    check(await page.evaluate(() => __mal3ab.Progress.stars(104)) === 0 && (await page.innerText('#sheetBox')).includes('مش المرة دي'), 'المستويات: الوقت خلص = خسارة');
    // المستوى 104 بيحتاج 5 من 7: لو لقيت 4 بس ما يكسبش
    await page.evaluate(() => { const { App, LEVELS } = __mal3ab; App.closeSheet(); App.startLevel(LEVELS[103]); }); await sleep(250);
    const ws = await page.evaluate(() => WordGame.s.puzzle.w);
    for (const w of ws.slice(0, 4)) { await typeWord(page, w); await sleep(50); }
    await sleep(900);
    check(await page.evaluate(() => WordGame.s.alive) && await page.locator('#sheet').isHidden(), 'المستويات: لسه ما وصلتش للهدف = اللعبة مكمّلة');
    // الخروج بعد آخر كلمة على طول: ما يتسجّلش أي نتيجة
    await typeWord(page, ws[4]); await sleep(100); await page.tap('#backBtn'); await sleep(1000);
    check(await page.evaluate(() => __mal3ab.Progress.stars(104)) === 0 && await page.locator('#map').isVisible() && await page.locator('#sheet').isHidden(), 'المستويات: الخروج قبل النتيجة ما يسجلش حاجة');
    // الزعيم 110: الجزء الأول كلمات وبعده أسرع مخ
    await page.evaluate(() => { const { App, LEVELS } = __mal3ab; App.startLevel(LEVELS[109]); }); await sleep(200);
    check((await page.innerText('.inter')).includes('كوّن كلمة'), 'الزعيم 11: بيبدأ بجزء الكلمات');
    await page.locator('.inter button').tap(); await sleep(250);
    const bw = await page.evaluate(() => ({ l: WordGame.s.puzzle.l.join(''), need: WordGame.need(), hints: WordGame.s.hintsLeft }));
    const bws = await page.evaluate(() => WordGame.s.puzzle.w);
    for (const w of bws.slice(0, bw.need)) { await typeWord(page, w); await sleep(40); }
    await sleep(1500);
    check(bw.need === 7 && bw.hints === 2 && (await page.innerText('.inter')).includes('أسرع مخ'), 'الزعيم 11: بعد الكلمات بيروح لأسرع مخ', JSON.stringify(bw));
    await page.evaluate(() => { __mal3ab.App.stopGame(); __mal3ab.App.run = null; __mal3ab.App.show('home'); });
    check(!page.errors.length, 'المستويات: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 5. الربط بالمرحلة C ---------- */
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const { Meta } = __mal3ab, found = [];
      for (let i = 0; i < 400; i++) { const d = new Date(2026, 0, 1 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; const D = Meta.dailySpec(k); if (D.game === 'word') found.push(D); }
      const a = __mal3ab.ACHIEVEMENTS;
      return { n: found.length, ok: found.every(D => D.cfg.need === WORD_PUZZLES[D.cfg.p].w.length && [...WORD_PUZZLES[D.cfg.p].l].length === 4),
        free: a.find(x => x.id === 'a_free3').need, words: !!a.find(x => x.id === 'a_words100'), q: QUESTS_DAY.some(q => q.ev === 'word_found') && QUESTS_WEEK.some(q => q.ev === 'word_found') };
    });
    check(r.n >= 20 && r.ok, 'المرحلة C: «كلمة اليوم» بتيجي في التحدي اليومي بلغز 4 حروف', JSON.stringify(r));
    check(r.free === 4 && r.words && r.q, 'المرحلة C: إنجاز «جرّب كله» بقى 4 ألعاب + إنجاز ومهام للكلمات');
    // مهمة الكلمات بتتحسب من لعبة حقيقية
    await page.evaluate(() => { const { Meta } = __mal3ab; Meta.data.quests.day.items[0] = { id: 'd_words10', prog: 0, claimed: false }; Meta.save(); });
    await page.evaluate(() => { const { App, LEVELS } = __mal3ab; App.startLevel(LEVELS[100]); }); await sleep(250);
    for (const w of await page.evaluate(() => WordGame.s.puzzle.w)) { await typeWord(page, w); await sleep(40); }
    await sleep(1200);
    check(await page.evaluate(() => __mal3ab.Meta.questList('day').find(q => q.id === 'd_words10').prog) === 4, 'المرحلة C: مهمة «لاقي 10 كلمات» اتحسبت (4 من 10)');
    check(!page.errors.length, 'المرحلة C: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 6. المقاسات: أكبر لغز (6 حروف و13 كلمة) ---------- */
  for (const [name, vp, mobile] of [['موبايل صغير 320×568', { width: 320, height: 568 }, true], ['موبايل 390×844', { width: 390, height: 844 }, true], ['موبايل عرضي', { width: 844, height: 390 }, true], ['كمبيوتر', { width: 1280, height: 800 }, false]]) {
    const page = await newPage(browser, vp, mobile);
    await page.evaluate(() => { const { App } = __mal3ab; App.enterPlay('كوّن كلمة'); App.current = WordGame; WordGame.start({ mode: 'level', p: WORD_BY_LETTERS['برتقال'], need: 13, time: 99 }, { end: () => {} }); });
    await sleep(300);
    const m = await page.evaluate(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0; };
      const letters = [...document.querySelectorAll('.wd-l')], tools = [...document.querySelectorAll('.wd-tool')];
      const lr = letters.map(b => b.getBoundingClientRect());
      let overlap = false; for (let i = 0; i < lr.length; i++) for (let j = i + 1; j < lr.length; j++) { const a = lr[i], b = lr[j]; if (a.left < b.right - 4 && b.left < a.right - 4 && a.top < b.bottom - 4 && b.top < a.bottom - 4) overlap = true; }
      const wide = document.scrollingElement.scrollWidth > innerWidth + 1;
      return { letters: letters.length, lettersVis: letters.every(vis), toolsVis: tools.every(vis), overlap, wide, minTap: Math.min(...lr.map(r => r.width)), slotsVis: vis(document.querySelector('.wd-slots')) || document.querySelector('.wd-slots').scrollHeight > 0 };
    });
    await page.screenshot({ path: path.join(OUT, `w-${vp.width}x${vp.height}.png`) });
    check(m.letters === 6 && m.lettersVis && m.toolsVis && !m.wide, `المقاسات (${name}): الحروف والزراير كلها جوه الشاشة`, JSON.stringify(m));
    check(!m.overlap && m.minTap >= 44, `المقاسات (${name}): الحروف مش فوق بعض وكبيرة كفاية للصباع`, JSON.stringify(m));
    // نلعب الـ 13 كلمة ونشوف إن مفيش أخطاء
    for (const w of await page.evaluate(() => WordGame.s.puzzle.w)) { await typeWord(page, w); await sleep(20); }
    check(await page.evaluate(() => WordGame.s.got.size) === 13 && !page.errors.length, `المقاسات (${name}): أكبر لغز يتحل للآخر من غير أخطاء`, page.errors.join(' | '));
    await page.context().close();
  }

  await browser.close();
  console.log(`\n=== كوّن كلمة: ${pass} نجح، ${fail} فشل ===`);
  if (fail) { console.log('الفاشلة:\n- ' + failures.join('\n- ')); process.exit(1); }
})();
