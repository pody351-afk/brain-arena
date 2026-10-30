// أداة معايرة: لكل مرحلة فرقع، بتدوّر على أكبر هدف يخلّي اللاعب البسيط يكسب بنسبة مستهدفة
// (من 97% في الأول لـ 82% في الآخر). التشغيل: node tests/calibrate-pop.js
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', '_test_page.html'));
  await p.addScriptTag({ path: path.join(__dirname, 'pop-bot.js') });
  const out = await p.evaluate(() => {
    const res = [];
    for (const L of __mal3ab.LEVELS) L.parts.forEach((part, pi) => {
      if (part.game !== 'pop') return;
      const cfg = JSON.parse(JSON.stringify(part.cfg)), t = (L.n - 1) / 99, target = 0.97 - 0.15 * t;
      const step = cfg.goal.type === 'score' ? 50 : 1;
      let lo = step, hi = cfg.goal.type === 'score' ? 6000 : cfg.goal.type === 'stones' ? 20 : cfg.goal.type === 'bombs' ? 8 : 60;
      const ok = n => { cfg.goal.n = n; if (cfg.goal.type === 'stones') cfg.stones = n; return __popStats(cfg, 80, L.n).win >= target; };
      while (hi - lo > step) { const mid = Math.round((lo + hi) / 2 / step) * step; if (ok(mid)) lo = mid; else hi = mid; }
      cfg.goal.n = lo; if (cfg.goal.type === 'stones') cfg.stones = lo;
      const st = __popStats(cfg, 120, L.n + 1);
      res.push({ n: L.n, boss: !!L.boss, type: cfg.goal.type + (cfg.goal.k != null ? cfg.goal.k : ''), moves: cfg.moves, colors: cfg.colors, old: part.cfg.goal.n, rec: lo, target: +target.toFixed(2), win: st.win, three: st.three });
    });
    return res;
  });
  for (const r of out) console.log(`${String(r.n).padStart(3)}${r.boss ? 'B' : ' '} ${r.type.padEnd(8)} moves ${r.moves} colors ${r.colors}: ${r.old} -> ${r.rec}  (win ${Math.round(r.win * 100)}% target ${Math.round(r.target * 100)}%, 3★ ${Math.round(r.three * 100)}%)`);
  await b.close();
})();
