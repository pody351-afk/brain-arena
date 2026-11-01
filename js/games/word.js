/* games/word.js — كوّن كلمة.
   بيظهر حروف في دايرة، وانت بتدوس عليها بالترتيب عشان تكوّن كلمة. الكلمات المطلوبة ظاهرة كمربعات فاضية (بتعرف عددها وطولها).
   الكلمة بتتقبل لوحدها أول ما تبقى واحدة من المطلوبين. زرار «تأكيد» بيقولك لو الكلمة مش في القايمة.
   free: سلسلة ألغاز (بتصعب) في وقت محدود. كل لغز تخلّصه بيزوّد وقت.
   level: لغز معيّن (cfg.p) ولازم تلاقي cfg.need كلمة قبل الوقت ما يخلص. النجوم حسب التلميحات.
   الكيبورد: تكتب الحرف بالعربي، Backspace يمسح، Enter يأكد، Escape يمسح الكلمة كلها، Space يلخبط. */
"use strict";
const WordGame = {
  key: "word", name: "كوّن كلمة",
  FREE: { time: 90, hints: 3, bonus: 15 },

  start(cfg = {}, hooks = {}) {
    this.cfg = Object.assign({ mode: "free", time: this.FREE.time, hints: this.FREE.hints }, cfg);
    this.hooks = hooks;
    const T = this.cfg.time;
    this.s = { time: T, max: T, alive: true, last: performance.now(), score: 0, found: 0, hintsUsed: 0, hintsLeft: this.cfg.hints,
      solved: 0, used: new Set(), pick: [], puzzle: null, got: new Set(), shown: {}, recent: [] };
    ui.stage.innerHTML = `<div class="wd">
      <div class="wd-slots" id="wdSlots" translate="no"></div>
      <div class="wd-cur" id="wdCur" aria-live="polite"></div>
      <div class="wd-ring" id="wdRing" translate="no"></div>
      <div class="wd-tools">
        <button type="button" class="wd-tool" id="wdHint"></button>
        <button type="button" class="wd-tool" id="wdShuf">لخبط</button>
        <button type="button" class="wd-tool" id="wdDel">امسح</button>
        <button type="button" class="wd-tool ok" id="wdOk">تأكيد</button>
      </div></div>`;
    onTap($("#wdHint"), () => this.hint());
    onTap($("#wdShuf"), () => this.shuffle());
    onTap($("#wdDel"), () => this.back());
    onTap($("#wdOk"), () => this.submit());
    this.onDoc = e => this.onKeyDoc(e);
    document.addEventListener("keydown", this.onDoc);
    this.load(this.isLevel() ? this.cfg.p : this.nextFree());
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  stop() { if (this.s) { this.s.alive = false; this.s.stopped = true; } clearTimeout(this.sayT); cancelAnimationFrame(this.raf); document.removeEventListener("keydown", this.onDoc); },
  isLevel() { return this.cfg.mode === "level"; },
  need() { return this.isLevel() ? this.cfg.need : this.s.puzzle.w.length; },

  // اللعب الحر: الألغاز بتصعب مع كل لغز بتخلّصه، ومن غير ما يتكرر لغز قريب
  nextFree() {
    const n = this.s.solved, tier = n < 2 ? 3 : n < 6 ? 4 : n < 9 ? 5 : pick([5, 6]);
    const pool = (WORD_TIERS[tier] || WORD_TIERS[4]).filter(i => !this.s.recent.includes(i));
    const i = pick(pool.length ? pool : WORD_TIERS[tier]);
    this.s.recent.push(i); if (this.s.recent.length > 12) this.s.recent.shift();
    return i;
  },
  load(i) {
    const s = this.s, p = WORD_PUZZLES[i];
    s.puzzle = { l: [...p.l], w: p.w.slice().sort((a, b) => [...a].length - [...b].length || a.localeCompare(b, "ar")) };
    s.pIndex = i; s.got = new Set(); s.shown = {}; s.pick = [];
    s.order = shuffle(s.puzzle.l.map((_, k) => k));
    this.renderSlots(); this.renderRing(); this.renderCur(); this.hud();
  },
  hud() {
    const s = this.s;
    setInfo(`<span>كلمات: ${s.got.size} / ${this.need()}</span><span>${this.isLevel() ? "" : `ألغاز: ${s.solved} · `}النقط ${s.score}</span>`);
    $("#wdHint").textContent = `تلميح (${s.hintsLeft})`;
    $("#wdHint").disabled = s.hintsLeft <= 0;
  },
  loop(t) {
    const s = this.s; if (!s.alive) return;
    s.time -= Math.min(0.1, Math.max(0, (t - s.last) / 1000)); s.last = t; // نفس حماية «أسرع مخ» من الرجوع بعد غياب
    setBar(s.time / s.max);
    if (s.time <= 0) { setBar(0); this.finish(false); return; }
    this.raf = requestAnimationFrame(tt => this.loop(tt));
  },

  /* ---------- الرسم ---------- */
  renderSlots() {
    const s = this.s;
    $("#wdSlots").innerHTML = s.puzzle.w.map((w, k) => {
      const got = s.got.has(w), sh = s.shown[w] || 0;
      return `<div class="wd-word${got ? " got" : ""}" data-w="${k}" aria-label="${got ? w : "كلمة من " + [...w].length + " حروف"}">${[...w].map((ch, j) => `<i>${got || j < sh ? ch : ""}</i>`).join("")}</div>`;
    }).join("");
  },
  renderRing() {
    const s = this.s, ring = $("#wdRing"), n = s.order.length;
    ring.innerHTML = "";
    s.order.forEach((k, pos) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "wd-l"; b.textContent = s.puzzle.l[k];
      const a = (pos / n) * Math.PI * 2 - Math.PI / 2, r = n <= 3 ? 30 : 36;
      b.style.left = (50 + r * Math.cos(a)) + "%"; b.style.top = (50 + r * Math.sin(a)) + "%";
      b.dataset.k = k;
      if (s.pick.includes(k)) b.classList.add("on");
      onTap(b, () => this.tapLetter(k));
      ring.appendChild(b);
    });
  },
  current() { return this.s.pick.map(k => this.s.puzzle.l[k]).join(""); },
  renderCur(cls = "") {
    const el = $("#wdCur"); el.className = "wd-cur " + cls;
    el.textContent = this.current() || " ";
    document.querySelectorAll(".wd-l").forEach(b => b.classList.toggle("on", this.s.pick.includes(+b.dataset.k)));
  },

  /* ---------- اللعب ---------- */
  tapLetter(k) {
    const s = this.s; if (!s.alive || s.pick.includes(k)) return;
    s.pick.push(k); sfx.note(s.pick.length - 1); buzz(6);
    this.renderCur();
    const w = this.current();
    if (s.puzzle.w.includes(w) && !s.got.has(w)) this.accept(w);
  },
  back() { if (!this.s.alive || !this.s.pick.length) return; this.s.pick.pop(); sfx.blip(); this.renderCur(); },
  clear() { this.s.pick = []; this.renderCur(); },
  shuffle() { const s = this.s; if (!s.alive) return; s.order = shuffle(s.order); sfx.blip(); this.renderRing(); },
  submit() {
    const s = this.s, w = this.current(); if (!s.alive || !w) return;
    if (s.got.has(w)) { this.say("لقيتها قبل كده", "dup"); return; }
    if (s.puzzle.w.includes(w)) { this.accept(w); return; }
    if ([...w].length < 3) { this.say("الكلمة 3 حروف على الأقل", "bad"); return; }
    this.say("مش في القايمة", "bad"); sfx.bad(); buzz([30, 30]); shake();
  },
  say(t, cls) {
    const el = $("#wdCur"); el.className = "wd-cur " + cls; el.textContent = t;
    this.s.pick = []; document.querySelectorAll(".wd-l").forEach(b => b.classList.remove("on"));
    clearTimeout(this.sayT); this.sayT = setTimeout(() => { if (this.s.alive && !this.s.pick.length) this.renderCur(); }, 900);
  },
  accept(w) {
    const s = this.s;
    s.got.add(w); s.found++;
    const pts = [...w].length * 10; s.score += pts; setScore(s.score);
    if (!this.isLevel()) { s.time = Math.min(s.max, s.time + 3); }
    const k = s.puzzle.w.indexOf(w), row = document.querySelector(`.wd-word[data-w="${k}"]`);
    this.renderSlots();
    const [x, y] = centerOf(document.querySelector(`.wd-word[data-w="${k}"]`) || row || ui.stage);
    floatText(x, y - 20, "+" + pts, "gold"); burst(x, y, "#3ddc97", 10);
    sfx.good(s.got.size); buzz(15);
    this.say(pick(["عاش!", "برافو!", "كلمة حلوة!", "صح!"]), "good");
    this.hud();
    if (this.isLevel()) { if (s.got.size >= this.need()) { s.alive = false; setTimeout(() => this.finish(true), 700); } return; }
    if (s.got.size === s.puzzle.w.length) { // لغز خلص في اللعب الحر
      s.solved++; s.score += 50; setScore(s.score); s.time = Math.min(s.max + 30, s.time + this.FREE.bonus); s.max = Math.max(s.max, s.time);
      sfx.level(); const [cx, cy] = screenCenter(); floatText(cx, cy, `خلّصت اللغز! +50 و+${this.FREE.bonus} ثانية`, "gold");
      setTimeout(() => { if (this.s.alive) this.load(this.nextFree()); }, 900);
    }
  },
  hint() {
    const s = this.s; if (!s.alive || s.hintsLeft <= 0) return;
    // أقصر كلمة لسه ما اتلقتش: نكشف حرف جديد منها
    const w = s.puzzle.w.find(x => !s.got.has(x) && (s.shown[x] || 0) < [...x].length - 1) || s.puzzle.w.find(x => !s.got.has(x));
    if (!w) return;
    s.hintsLeft--; s.hintsUsed++;
    s.shown[w] = Math.min([...w].length - 1, (s.shown[w] || 0) + 1);
    sfx.blip(); this.renderSlots(); this.hud();
    const row = document.querySelector(`.wd-word[data-w="${s.puzzle.w.indexOf(w)}"]`); if (row) { row.classList.add("hinted"); setTimeout(() => row.classList.remove("hinted"), 700); }
  },
  onKeyDoc(e) {
    const s = this.s; if (!s || !s.alive || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "Backspace") { e.preventDefault(); this.back(); return; }
    if (e.key === "Enter") { e.preventDefault(); this.submit(); return; }
    if (e.key === "Escape") { this.clear(); return; }
    if (e.key === " ") { e.preventDefault(); this.shuffle(); return; }
    if (e.key.length === 1) {
      const k = s.order.find(i => s.puzzle.l[i] === e.key && !s.pick.includes(i));
      if (k != null) { e.preventDefault(); this.tapLetter(k); }
    }
  },
  finish(won) {
    const s = this.s; if (s.ended || s.stopped) return; // لو خرجت من اللعبة قبلها، أو اتنادت مرتين
    s.ended = true; s.alive = false; cancelAnimationFrame(this.raf); document.removeEventListener("keydown", this.onDoc);
    if (this.hooks.end) this.hooks.end({ game: "word", won, score: s.score, found: s.found, hintsUsed: s.hintsUsed, timeLeft: Math.max(0, s.time),
      note: this.isLevel() ? "" : `لقيت ${s.found} كلمة وخلّصت ${s.solved} ${s.solved === 1 ? "لغز" : "ألغاز"}` });
  },
  rank(v) { return v < 150 ? "بيتهجّى" : v < 500 ? "بيعرف كلمات" : v < 1200 ? "قاموس صغير" : "قاموس ماشي"; }
};
