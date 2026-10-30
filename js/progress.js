/* progress.js — تقدّم اللاعب: النجوم، الـ XP، الرتب، فتح المستويات.
   الحفظ حاليًا على جهاز اللاعب (localStorage). الشكل مصمم عشان يتنقل لحساب أونلاين بعدين:
   كل نتيجة ليها runId، والـ XP بيتحسب من "الفرق" في النجوم، فإعادة إرسال نفس النتيجة أو تحديث الصفحة ما يدّيش مكافأة مكررة. */
"use strict";
const Progress = {
  KEY: "progress", V: 1, data: null,
  TITLES: ["مبتدئ", "متحمّس", "متدرّب", "مفكّر", "ذكي", "سريع البديهة", "عبقري صغير", "عبقري", "خبير", "أستاذ", "أسطورة"],

  fresh() { return { v: this.V, xp: 0, levels: {}, worldsDone: {}, runs: [], best: {} }; },
  load() {
    let d = store.get(this.KEY, null);
    const valid = d && d.v === this.V && typeof d.xp === "number" && d.xp >= 0 && d.levels && typeof d.levels === "object" && Array.isArray(d.runs);
    if (!valid) d = this.fresh();
    d.worldsDone = d.worldsDone || {}; d.best = d.best || {};
    // نقل أحسن نتايج اللعب الحر من النسخة الأولى
    for (const g of ["speed", "pop", "mem"]) { const b = store.get("best_" + g, 0); if (b > (d.best[g] || 0)) d.best[g] = b; }
    this.data = d; return d;
  },
  save() { return store.set(this.KEY, this.data); },
  reset() { this.data = this.fresh(); for (const g of ["speed", "pop", "mem"]) store.set("best_" + g, 0); this.save(); },

  rec(n) { return this.data.levels[n] || null; },
  stars(n) { const r = this.rec(n); return r ? r.stars : 0; },
  isUnlocked(n) { return n === 1 || this.stars(n - 1) > 0; },
  totalStars() { return Object.values(this.data.levels).reduce((a, r) => a + (r.stars || 0), 0); },
  completed() { return Object.values(this.data.levels).filter(r => r.stars > 0).length; },
  nextLevel() { for (const L of LEVELS) if (this.stars(L.n) === 0) return L; return LEVELS[LEVELS.length - 1]; },
  worldStars(w) { let s = 0; for (let n = w.from; n <= w.to; n++) s += this.stars(n); return s; },
  worldDone(w) { for (let n = w.from; n <= w.to; n++) if (!this.stars(n)) return false; return true; },
  bossesBeaten() { return LEVELS.filter(L => L.boss && this.stars(L.n) > 0).length; },

  // الرتبة: المستوى n محتاج 50×n×(n−1) XP (يعني 100، 300، 600، 1000...)
  need(n) { return 50 * n * (n - 1); },
  playerLevel(xp = this.data.xp) { let n = 1; while (xp >= this.need(n + 1)) n++; return n; },
  title(lvl = this.playerLevel()) { return this.TITLES[Math.min(this.TITLES.length - 1, Math.floor((lvl - 1) / 2))]; },
  levelProgress(xp = this.data.xp) { const n = this.playerLevel(xp), a = this.need(n), b = this.need(n + 1); return { n, into: xp - a, span: b - a, frac: (xp - a) / (b - a) }; },

  // تسجيل نتيجة مستوى. ترجع اللي اتكسب فعلًا.
  applyResult(level, runId, result) {
    const d = this.data, out = { duplicate: false, xp: 0, oldStars: this.stars(level.n), stars: 0, firstClear: false, worldBonus: 0, levelUpFrom: this.playerLevel(), levelUpTo: 0 };
    if (!runId || d.runs.includes(runId)) { out.duplicate = true; out.stars = out.oldStars; out.levelUpTo = out.levelUpFrom; return out; }
    d.runs.push(runId); if (d.runs.length > 200) d.runs.splice(0, d.runs.length - 200);
    const rec = d.levels[level.n] || { stars: 0, best: 0, plays: 0 };
    rec.plays++;
    if (result.won) {
      const stars = Math.max(1, Math.min(3, result.stars | 0));
      out.stars = Math.max(stars, rec.stars);
      const delta = Math.max(0, stars - rec.stars);
      out.firstClear = rec.stars === 0;
      out.xp = delta * level.xpStar + (out.firstClear ? level.xpFirst : 0);
      rec.stars = Math.max(rec.stars, stars);
      rec.best = Math.max(rec.best, result.score | 0);
      d.levels[level.n] = rec;
      const w = WORLDS[level.world - 1];
      if (!d.worldsDone[w.id] && this.worldDone(w)) { d.worldsDone[w.id] = true; out.worldBonus = w.bonus; out.xp += w.bonus; }
      d.xp += out.xp;
    } else {
      out.stars = rec.stars; d.levels[level.n] = rec;
    }
    out.levelUpTo = this.playerLevel();
    this.save();
    return out;
  },
  saveBest(game, score) {
    const old = this.data.best[game] || 0;
    if (score > old) { this.data.best[game] = score; store.set("best_" + game, score); this.save(); }
    return old;
  }
};
