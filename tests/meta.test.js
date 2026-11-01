// اختبارات المرحلة C: التحدي اليومي، السلسلة، المهام، الإنجازات، والشاشات.
// التشغيل: NODE_PATH=$(npm root -g) node tests/meta.test.js
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

async function newPage(browser, vp = { width: 390, height: 844 }, mobile = true, ctxIn) {
  const ctx = ctxIn || await browser.newContext({ locale: 'ar-EG', viewport: vp, hasTouch: mobile, isMobile: mobile });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => page.errors.push(e.message));
  await page.goto(URL); await sleep(300);
  return page;
}
// نضبط ساعة اللعبة على يوم معيّن (الساعة 12 الضهر بتوقيت الجهاز)
const setDay = async (page, y, m, d) => {
  const t = new Date(y, m - 1, d, 12).getTime();
  await page.addInitScript(t => { window.__testNow = t; }, t); // عشان لو الصفحة اتحدّثت تفضل على نفس اليوم
  await page.evaluate(t => { window.__testNow = t; __mal3ab.Meta.refresh(); }, t);
};
// نخلّص التحدي اليومي بنتيجة جاهزة (من غير ما نلعب فعلًا)
const finishDaily = (page, won = true) => page.evaluate(won => {
  const { App, Meta } = __mal3ab; const D = Meta.dailySpec();
  App.startLevel(D); document.querySelectorAll('.inter').forEach(e => e.remove());
  const r = { game: D.game, won, score: 300, mistakes: 0, correct: 12, livesLeft: 3, movesLeft: 9, movesTotal: 18 };
  App.current && App.current.stop(); App.onPartEnd(r);
}, won);
const xp = page => page.evaluate(() => __mal3ab.Progress.data.xp);

(async () => {
  const browser = await chromium.launch();

  /* ---------- 1. التحدي اليومي: ثابت لنفس اليوم ومتغيّر بين الأيام ---------- */
  {
    const page = await newPage(browser);
    const r = await page.evaluate(() => {
      const { Meta } = __mal3ab, out = [];
      for (let i = 0; i < 60; i++) { const d = new Date(2026, 9, 1 + i); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; out.push(Meta.dailySpec(k)); }
      const a = JSON.stringify(Meta.dailySpec('2026-11-05')), b = JSON.stringify(Meta.dailySpec('2026-11-05'));
      return { same: a === b, names: [...new Set(out.map(x => x.name))].length, games: [...new Set(out.map(x => x.game))].sort().join(','),
        valid: out.every(x => ['speed', 'pop', 'mem', 'word'].includes(x.game) && x.goal && x.cfg && x.cfg.mode === 'level'),
        consecutiveDiff: out.filter((x, i) => i && x.name !== out[i - 1].name).length };
    });
    check(r.same, 'التحدي اليومي: نفس اليوم = نفس التحدي');
    check(r.names >= 8, 'التحدي اليومي: أنواع كتير على مدار 60 يوم', r.names);
    check(r.games === 'mem,pop,speed,word', 'التحدي اليومي: الألعاب الأربعة بتيجي', r.games);
    check(r.valid, 'التحدي اليومي: كل التحديات بيانات سليمة');
    check(r.consecutiveDiff >= 45, 'التحدي اليومي: غالبًا مختلف عن امبارح', r.consecutiveDiff);
    // كل قالب يشتغل فعلًا جوه اللعبة من غير أخطاء
    const ran = await page.evaluate(async () => {
      const { App, Meta } = __mal3ab, seen = {}, errs = [];
      for (let i = 0; i < 400 && Object.keys(seen).length < 11; i++) {
        const D = Meta.dailySpec('2027-01-' + String(1 + (i % 28)).padStart(2, '0') + (i >= 28 ? 'x' + i : ''));
        if (seen[D.name]) continue; seen[D.name] = 1;
        try { App.startLevel(D); await new Promise(r => setTimeout(r, 150)); if (!document.querySelector('#stage').children.length) errs.push(D.name + ': empty'); App.stopGame(); App.run = null; } catch (e) { errs.push(D.name + ': ' + e.message); }
      }
      App.show('home'); return { n: Object.keys(seen).length, errs };
    });
    check(ran.n === 11 && !ran.errs.length, 'التحدي اليومي: القوالب الـ 11 بتشتغل في اللعبة', JSON.stringify(ran));
    check(!page.errors.length, 'التحدي اليومي: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 2. المكافأة مرة واحدة + السلسلة ---------- */
  {
    const page = await newPage(browser);
    await setDay(page, 2026, 11, 2);
    const x0 = await xp(page);
    await finishDaily(page, false); await sleep(700);
    check(await xp(page) === x0, 'اليومي: الخسارة ما بتديش XP');
    check(await page.locator('#sheetBox').innerText().then(t => t.includes('مش المرة دي')), 'اليومي: شاشة الخسارة');
    await finishDaily(page, true); await sleep(600);
    const x1 = await xp(page), st1 = await page.evaluate(() => __mal3ab.Meta.data.streak.count);
    const sheet1 = await page.locator('#sheetBox').innerText();
    // 70 XP للتحدي + XP إنجاز "تحدي النهارده" (30)
    check(x1 - x0 === 70 + 30, 'اليومي: أول فوز = 70 XP (+ إنجاز 30)', x1 - x0);
    check(st1 === 1 && sheet1.includes('+70 XP') && sheet1.includes('1 يوم'), 'اليومي: السلسلة بقت 1 وظاهرة', sheet1.replace(/\n/g, ' '));
    await finishDaily(page, true); await sleep(600);
    check(await xp(page) === x1, 'اليومي: الفوز التاني نفس اليوم من غير XP');
    check((await page.locator('#sheetBox').innerText()).includes('خدت مكافأة النهارده'), 'اليومي: رسالة "خدت المكافأة"');
    // نفس المحاولة مرتين (runId مكرر) ما تتحسبش
    const dup = await page.evaluate(() => { const { Meta } = __mal3ab; const p = Meta.data.daily.plays; Meta.dailyResult('same-run', { won: true, stars: 3, score: 1 }); Meta.dailyResult('same-run', { won: true, stars: 3, score: 1 }); return Meta.data.daily.plays - p; });
    check(dup === 1, 'اليومي: نفس المحاولة مرتين بتتحسب مرة', dup);
    // اليوم اللي بعده: السلسلة 2 والمكافأة 80
    await setDay(page, 2026, 11, 3);
    const rw = await page.evaluate(() => __mal3ab.Meta.dailyReward());
    check(rw === 80, 'اليومي: مكافأة اليوم التاني 80', rw);
    const x2 = await xp(page); await finishDaily(page, true); await sleep(500);
    check(await xp(page) - x2 === 80 && await page.evaluate(() => __mal3ab.Meta.data.streak.count) === 2, 'اليومي: السلسلة 2 بعد يومين ورا بعض');
    await setDay(page, 2026, 11, 4); await finishDaily(page, true); await sleep(500);
    const s3 = await page.evaluate(() => ({ c: __mal3ab.Meta.data.streak.count, ach: !!__mal3ab.Meta.data.ach.a_streak3 }));
    check(s3.c === 3 && s3.ach, 'اليومي: 3 أيام = إنجاز "مواظب"', JSON.stringify(s3));
    // فوّت يوم: السلسلة الحالية تبقى 0، وأول فوز يرجّعها 1، وأطول سلسلة تفضل 3
    await setDay(page, 2026, 11, 6);
    check(await page.evaluate(() => __mal3ab.Meta.streakNow()) === 0, 'اليومي: لو فوّت يوم السلسلة تبقى 0');
    check(await page.evaluate(() => __mal3ab.Meta.dailyReward()) === 70, 'اليومي: المكافأة ترجع 70 بعد ما السلسلة تتقطع');
    await finishDaily(page, true); await sleep(400);
    const s4 = await page.evaluate(() => __mal3ab.Meta.data.streak);
    check(s4.count === 1 && s4.best === 3, 'اليومي: السلسلة تبدأ من 1 وأطول سلسلة 3', JSON.stringify(s4));
    // سقف المكافأة: 7 أيام وأكتر = 130
    const cap = await page.evaluate(() => { const { Meta } = __mal3ab; Meta.data.streak = { count: 12, last: '2026-11-06', best: 12 }; window.__testNow = new Date(2026, 10, 7, 12).getTime(); Meta.refresh(); return Meta.dailyReward(); });
    check(cap === 130, 'اليومي: أقصى مكافأة 130 (سلسلة 7+)', cap);
    // البيانات بتفضل بعد التحديث
    await setDay(page, 2026, 11, 6); await page.reload(); await sleep(300);
    check(await page.evaluate(() => __mal3ab.Meta.data.stats.daily === 4 && __mal3ab.Meta.data.streak.best === 12), 'اليومي: الحالة محفوظة بعد تحديث الصفحة', await page.evaluate(() => JSON.stringify([__mal3ab.Meta.data.stats.daily, __mal3ab.Meta.data.streak])));
    check(!page.errors.length, 'اليومي: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 3. المهام ---------- */
  {
    const page = await newPage(browser);
    await setDay(page, 2026, 11, 2);
    const q = await page.evaluate(() => {
      const { Meta } = __mal3ab;
      const a = Meta.pickQuests(QUESTS_DAY, 'd2026-11-02').map(x => x.id).join(), b = Meta.pickQuests(QUESTS_DAY, 'd2026-11-02').map(x => x.id).join();
      const days = new Set(); for (let i = 1; i <= 20; i++) days.add(Meta.pickQuests(QUESTS_DAY, 'd2026-12-' + i).map(x => x.id).sort().join());
      const day = Meta.questList('day'), week = Meta.questList('week');
      return { same: a === b, variety: days.size, n: day.length, nw: week.length, distinct: new Set(day.map(x => x.id)).size, noBoss: !week.some(x => x.id === 'w_boss1') };
    });
    check(q.same && q.variety >= 8, 'المهام: ثابتة لنفس اليوم ومتنوعة بين الأيام', JSON.stringify(q));
    check(q.n === 3 && q.nw === 3 && q.distinct === 3, 'المهام: 3 يومية و3 أسبوعية مختلفين');
    check(q.noBoss, 'المهام: مهمة الزعيم ما بتظهرش للاعب لسه ما وصلش للزعيم');
    // نجبر مهام معروفة عشان نختبر التقدّم والاستلام
    await page.evaluate(() => { const { Meta } = __mal3ab; Meta.data.quests.day.items = [{ id: 'd_play3', prog: 0, claimed: false }, { id: 'd_speed15', prog: 0, claimed: false }, { id: 'd_free1', prog: 0, claimed: false }];
      Meta.data.quests.week.items = [{ id: 'w_play20', prog: 0, claimed: false }, { id: 'w_win10', prog: 0, claimed: false }, { id: 'w_free5', prog: 0, claimed: false }]; Meta.save(); });
    // لعبة حرة حقيقية (أسرع مخ) لحد ما تخلص
    await page.evaluate(() => __mal3ab.openGame('speed'));
    await page.evaluate(() => { const g = __mal3ab.GAMES.speed; g.s.correct = 9; g.finish(false); });
    await sleep(800);
    let L = await page.evaluate(() => __mal3ab.Meta.questList('day').map(x => x.prog));
    check(L[0] === 1 && L[1] === 9 && L[2] === 1, 'المهام: اللعب الحر بيزوّد (لعب، إجابات صح، لعب حر)', JSON.stringify(L));
    // مستوى بفوز
    await page.evaluate(() => { const { App, LEVELS } = __mal3ab; App.startLevel(LEVELS[0]); App.current.stop(); App.onPartEnd({ game: 'speed', won: true, score: 50, mistakes: 0, correct: 7 }); });
    await sleep(500);
    L = await page.evaluate(() => __mal3ab.Meta.questList('day').map(x => x.prog));
    check(L[0] === 2 && L[1] === 15, 'المهام: المستوى بيزوّد، والعداد ما يعديش الهدف', JSON.stringify(L));
    const w = await page.evaluate(() => __mal3ab.Meta.questList('week').map(x => x.prog));
    check(w[0] === 2 && w[1] === 1 && w[2] === 1, 'المهام الأسبوعية: بتتحسب', JSON.stringify(w));
    // ما ينفعش تستلم مهمة مش خلصانة
    check(await page.evaluate(() => __mal3ab.Meta.claim('day', 'd_play3')) === null, 'المهام: ما ينفعش تستلم قبل ما تخلص');
    // استلام من الشاشة
    await page.evaluate(() => __mal3ab.App.closeSheet());
    await page.evaluate(() => __mal3ab.App.show('home'));
    check((await page.innerText('#questsBtn')).includes('2 جاهزة'), 'المهام: الرئيسية بتقول فيه مهام جاهزة', await page.innerText('#questsBtn'));
    await page.tap('#questsBtn'); await sleep(250);
    const x0 = await xp(page);
    await page.locator('[data-claim="day:d_speed15"]').tap(); await sleep(250);
    check(await xp(page) - x0 === 25, 'المهام: الاستلام بيدّي 25 XP', await xp(page) - x0);
    check(await page.locator('[data-claim="day:d_speed15"]').count() === 0 && (await page.innerText('#quests')).includes('اتاستلمت'), 'المهام: الزرار بيختفي وتبقى "اتاستلمت"');
    check(await page.evaluate(() => __mal3ab.Meta.claim('day', 'd_speed15')) === null && await xp(page) - x0 === 25, 'المهام: ما ينفعش تستلم نفس المهمة مرتين');
    await page.reload(); await sleep(300);
    check(await page.evaluate(() => __mal3ab.Meta.questList('day').find(x => x.id === 'd_speed15').claimed), 'المهام: الاستلام محفوظ بعد التحديث');
    // يوم جديد: مهام جديدة من الأول، والأسبوعية زي ما هي لحد السبت
    await setDay(page, 2026, 11, 3);
    const nd = await page.evaluate(() => ({ day: __mal3ab.Meta.questList('day').every(x => x.prog === 0 && !x.claimed), week: __mal3ab.Meta.questList('week')[0].prog }));
    check(nd.day && nd.week === 2, 'المهام: يوم جديد = مهام يومية جديدة، والأسبوعية مكمّلة', JSON.stringify(nd));
    await setDay(page, 2026, 11, 6); // جمعة
    check(await page.evaluate(() => __mal3ab.Meta.questList('week')[0].prog) === 2, 'المهام الأسبوعية: لسه نفس الأسبوع يوم الجمعة');
    await setDay(page, 2026, 11, 7); // سبت
    check(await page.evaluate(() => __mal3ab.Meta.questList('week').every(x => x.prog === 0)), 'المهام الأسبوعية: بتتجدد يوم السبت');
    check(!page.errors.length, 'المهام: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 4. الإنجازات ---------- */
  {
    const page = await newPage(browser);
    const n = await page.evaluate(() => __mal3ab.ACHIEVEMENTS.length);
    check(n === 21 && await page.evaluate(() => new Set(__mal3ab.ACHIEVEMENTS.map(a => a.id)).size) === 21, 'الإنجازات: 21 إنجاز بأسماء مختلفة');
    check(await page.evaluate(() => __mal3ab.Meta.achCount()) === 0, 'الإنجازات: لاعب جديد = 0');
    const x0 = await xp(page);
    await page.evaluate(() => { const { App, LEVELS } = __mal3ab; App.startLevel(LEVELS[0]); App.current.stop(); App.onPartEnd({ game: 'speed', won: true, score: 50, mistakes: 0, correct: 7 }); });
    await sleep(1200);
    const a = await page.evaluate(() => ({ first: !!__mal3ab.Meta.data.ach.a_first, xp: __mal3ab.Progress.data.xp }));
    // مستوى 1 بـ 3 نجوم: 3×10 + 15 = 45، + إنجاز "أول خطوة" 20
    check(a.first && a.xp - x0 === 45 + 20, 'الإنجازات: "أول خطوة" اتفتح وإداك 20 XP', a.xp - x0);
    check((await page.locator('.toast').allInnerTexts()).some(t => t.includes('إنجاز جديد: أول خطوة')), 'الإنجازات: إشعار "إنجاز جديد" ظهر');
    await page.reload(); await sleep(300);
    check(await xp(page) === a.xp, 'الإنجازات: التحديث ما بيكررش المكافأة');
    // لاعب قديم عنده تقدّم: الإنجازات تتفتح أول ما يفتح النسخة الجديدة
    const old = await page.evaluate(() => { const lv = {}; for (let i = 1; i <= 12; i++) lv[i] = { stars: 3, best: 10, plays: 1 };
      localStorage.setItem('mal3ab_progress', JSON.stringify({ v: 1, xp: 500, levels: lv, worldsDone: { 1: true }, runs: [], best: {} })); localStorage.removeItem('mal3ab_meta'); });
    await page.reload(); await sleep(300);
    const o = await page.evaluate(() => ({ ids: Object.keys(__mal3ab.Meta.data.ach).sort().join(), xp: __mal3ab.Progress.data.xp }));
    check(o.ids === ['a_boss1', 'a_first', 'a_lv10', 'a_star30', 'a_perfect10', 'a_world1'].sort().join(), 'الإنجازات: تقدّم قديم بيفتح الإنجازات الصح', o.ids);
    check(o.xp === 500 + 20 + 40 + 60 + 60 + 100 + 80, 'الإنجازات: XP التقدّم القديم اتضاف مرة واحدة', o.xp);
    await page.reload(); await sleep(300);
    check(await xp(page) === o.xp, 'الإنجازات: تحديث تاني ما بيزوّدش');
    await page.evaluate(() => __mal3ab.App.show('quests')); await sleep(200);
    const t = await page.innerText('#quests');
    check(t.includes('6 من 21') && (await page.locator('.ach.done').count()) === 6, 'الإنجازات: الشاشة بتعرض المفتوح والمقفول', t.slice(-200));
    check(!page.errors.length, 'الإنجازات: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 5. الواجهة: الأزرار والتنقل والمسح ---------- */
  {
    const page = await newPage(browser);
    check(await page.locator('#dailyBtn').isVisible() && (await page.innerText('#dailyBtn')).includes('التحدي اليومي'), 'الواجهة: كارت التحدي اليومي في الرئيسية');
    check(!(await page.innerText('#home')).includes('الإنجازات جاية'), 'الواجهة: "قريبًا" اتشالت من التحدي والإنجازات');
    await page.tap('#dailyBtn'); await sleep(200);
    check(await page.locator('#goDaily').isVisible(), 'الواجهة: شيت التحدي اليومي بيفتح');
    await page.tap('#goDaily'); await sleep(400);
    const title = await page.innerText('#hudTitle');
    if (await page.locator('.inter').count()) await page.locator('.inter button').tap();
    check(title === 'التحدي اليومي' && await page.locator('#play').isVisible(), 'الواجهة: التحدي اليومي بيبدأ لعب حقيقي', title);
    await page.tap('#backBtn'); await sleep(250);
    check(await page.locator('#home').isVisible(), 'الواجهة: زرار الرجوع من التحدي بيرجع للرئيسية (مش الخريطة)');
    await page.tap('#achBtn'); await sleep(250);
    check(await page.locator('#quests').isVisible() && await page.locator('#achSec').isVisible(), 'الواجهة: زرار الإنجازات بيفتح عليها');
    // مسح التقدّم بيمسح المرحلة C كمان
    await setDay(page, 2026, 11, 2); await finishDaily(page, true); await sleep(400);
    await page.tap('#rHome'); await sleep(200);
    await page.locator('#nav [data-go="settings"]').tap(); await sleep(150);
    await page.tap('#resetBtn'); await page.tap('#resetBtn'); await sleep(200);
    const z = await page.evaluate(() => ({ ach: __mal3ab.Meta.achCount(), done: __mal3ab.Meta.data.daily.done, st: __mal3ab.Meta.data.streak.best, xp: __mal3ab.Progress.data.xp }));
    check(z.ach === 0 && !z.done && z.st === 0 && z.xp === 0, 'الواجهة: مسح التقدّم بيمسح التحدي والمهام والإنجازات', JSON.stringify(z));
    check(!page.errors.length, 'الواجهة: من غير أخطاء JS', page.errors.join(' | '));
    await page.context().close();
  }

  /* ---------- 6. المقاسات: موبايل صغير، عرضي، كمبيوتر ---------- */
  for (const [name, vp, mobile] of [['موبايل صغير 320', { width: 320, height: 640 }, true], ['موبايل عرضي', { width: 844, height: 390 }, true], ['كمبيوتر', { width: 1280, height: 800 }, false]]) {
    const page = await newPage(browser, vp, mobile);
    await page.evaluate(() => { const { Meta } = __mal3ab; Meta.data.quests.day.items[0].prog = 99; Meta.save(); });
    const ov = [];
    for (const s of ['home', 'quests']) {
      await page.evaluate(s => __mal3ab.App.show(s), s); await sleep(200);
      const o = await page.evaluate(() => { const e = document.scrollingElement; const wide = [...document.querySelectorAll('#app *')].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).length; return e.scrollWidth > innerWidth + 1 || wide > 0; });
      if (o) ov.push(s);
      await page.screenshot({ path: path.join(OUT, `c-${s}-${vp.width}.png`) });
    }
    check(!ov.length, `المقاسات (${name}): من غير ما حاجة تخرج برّه الشاشة`, ov.join(','));
    const btn = await page.locator('.q-claim').first().boundingBox();
    check(btn && btn.height >= 44, `المقاسات (${name}): زرار الاستلام كبير كفاية للصباع`, btn && btn.height);
    await page.context().close();
  }

  await browser.close();
  console.log(`\n=== المرحلة C: ${pass} نجح، ${fail} فشل ===`);
  if (fail) { console.log('الفاشلة:\n- ' + failures.join('\n- ')); process.exit(1); }
})();
