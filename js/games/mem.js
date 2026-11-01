/* games/mem.js — افتكر.
   أنواع: squares (المربعات اللي نوّرت، أي ترتيب)، order (نفس الترتيب)، reverse (الترتيب بالعكس)، numbers (أرقام تكتبها).
   free = النسخة الأولى (مربعات بلا نهاية). level = عدد جولات محدد، والنجوم = القلوب الفاضلة.
   كل لمسة بتتسجّل مرة واحدة: pointerdown للمس/الماوس، وclick بـ detail=0 للكيبورد بس. */
"use strict";
const Mem = {
  key: "mem", name: "افتكر",
  start(cfg = {}, hooks = {}) {
    this.cfg = Object.assign({ mode: "free", variant: "squares", size: 3, count: 3, rounds: 0, grow: 1, fast: false }, cfg);
    this.hooks = hooks;
    this.s = { level: 1, round: 0, lives: 3, score: 0, streak: 0, phase: "show", targets: new Set(), seq: [], pos: 0, found: new Set(), timers: [], alive: true, input: "" };
    ui.stage.innerHTML = '<div class="mem-wrap"><div class="mem-msg" id="memMsg"></div><div id="memBody" style="display:contents"></div></div>';
    this.onDoc = e => this.onKeyDoc(e);
    document.addEventListener("keydown", this.onDoc);
    setBar(0, false); this.hud(); this.round();
  },
  stop() { if (this.s) { this.s.alive = false; this.s.timers.forEach(clearTimeout); } document.removeEventListener("keydown", this.onDoc); },
  isLevel() { return this.cfg.mode === "level"; },
  later(fn, ms) { this.s.timers.push(setTimeout(() => { if (this.s.alive) fn(); }, ms)); },
  size() {
    if (this.isLevel()) return this.cfg.size;
    const L = this.s.level; return L <= 2 ? 3 : L <= 5 ? 4 : L <= 9 ? 5 : 6;
  },
  count() {
    if (this.isLevel()) {
      const c = this.cfg.count + this.s.round * this.cfg.grow;
      return this.cfg.variant === "numbers" ? Math.min(12, c) : Math.min(this.size() * this.size() - 2, c);
    }
    const n = this.size(); return Math.min(n * n - 4, 2 + this.s.level);
  },
  hud() {
    let h = ""; for (let i = 0; i < 3; i++) h += `<i class="${i < this.s.lives ? "" : "off"}"></i>`;
    const left = this.isLevel() ? `جولة ${Math.min(this.s.round + 1, this.cfg.rounds)} / ${this.cfg.rounds}` : `مستوى ${this.s.level}`;
    setInfo(`<span>${left}</span><span class="lives">${h}</span>`);
  },
  msg(t) { const e = $("#memMsg"); if (e) e.textContent = t; },
  round() {
    const v = this.isLevel() ? this.cfg.variant : "squares";
    if (v === "numbers") this.roundNumbers(); else this.roundGrid(v);
  },

  /* ---------- المربعات: squares / order / reverse ---------- */
  buildGrid(n) {
    const body = $("#memBody");
    body.innerHTML = '<div class="mem-grid" id="memGrid"></div>';
    const grid = $("#memGrid"); grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
    this.cells = [];
    for (let i = 0; i < n * n; i++) {
      const b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", "مربع " + (i + 1));
      onTap(b, () => this.tapCell(i, b));
      grid.appendChild(b); this.cells.push(b);
    }
  },
  roundGrid(v) {
    const s = this.s, n = this.size(), cnt = this.count(), fast = this.cfg.fast;
    s.phase = "show"; s.found = new Set(); s.targets = new Set(); s.pos = 0; s.variant = v;
    while (s.targets.size < cnt) s.targets.add(ri(0, n * n - 1));
    s.seq = [...s.targets]; // ترتيب الظهور
    this.buildGrid(n);
    if (v === "squares") {
      this.msg(`ركّز... ${cnt} مربعات`);
      const showMs = Math.round((650 + cnt * 140) * (fast ? 0.65 : 1));
      this.later(() => { s.targets.forEach(i => this.cells[i].classList.add("lit")); sfx.blip(); }, 550);
      this.later(() => { s.targets.forEach(i => this.cells[i].classList.remove("lit")); s.phase = "input"; this.msg("يلا! دوس على اللي نوّروا"); }, 550 + showMs);
    } else {
      this.msg(v === "order" ? `ركّز في الترتيب... ${cnt} مربعات` : `ركّز... وبعدين دوس بالعكس`);
      const step = fast ? 430 : 600, on = step - 150;
      s.seq.forEach((i, k) => {
        this.later(() => { this.cells[i].classList.add("lit"); sfx.note(k); }, 600 + k * step);
        this.later(() => this.cells[i].classList.remove("lit"), 600 + k * step + on);
      });
      this.later(() => { s.phase = "input"; this.msg(v === "order" ? "دوس بنفس الترتيب" : "دوس بالترتيب العكسي: من الآخر للأول"); }, 600 + cnt * step);
    }
  },
  expected() { return this.s.variant === "reverse" ? this.s.seq.slice().reverse() : this.s.seq; },
  tapCell(i, el) {
    const s = this.s; if (s.phase !== "input" || s.found.has(i)) return;
    const [x, y] = centerOf(el);
    let ok;
    if (s.variant === "squares") ok = s.targets.has(i);
    else ok = this.expected()[s.pos] === i;
    if (ok) {
      s.found.add(i); s.pos++;
      el.classList.add("ok"); if (s.variant !== "squares") el.innerHTML = `<span class="ord">${s.pos}</span>`;
      sfx.good(s.found.size); buzz(10); burst(x, y, "#3ddc97", 8);
      if (s.found.size === s.targets.size) this.success(x, y);
    } else {
      el.classList.add("miss");
      if (s.variant === "squares") s.targets.forEach(t => { if (!s.found.has(t)) this.cells[t].classList.add("reveal"); });
      else this.expected().forEach((t, k) => { if (!s.found.has(t)) { this.cells[t].classList.add("reveal"); this.cells[t].innerHTML = `<span class="ord">${k + 1}</span>`; } });
      this.fail();
    }
  },

  /* ---------- الأرقام ---------- */
  roundNumbers() {
    const s = this.s, cnt = this.count(), fast = this.cfg.fast;
    s.phase = "show"; s.input = "";
    s.digits = Array.from({ length: cnt }, () => ri(0, 9)).join("");
    const body = $("#memBody");
    body.innerHTML = `<div class="digits show" id="memDigits">${[...s.digits].map(d => `<span>${d}</span>`).join("")}</div><div class="keypad" id="memPad"></div>`;
    const pad = $("#memPad");
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", ""].forEach(k => {
      const b = document.createElement("button"); b.type = "button";
      if (k === "") { b.disabled = true; b.style.visibility = "hidden"; }
      else if (k === "del") { b.className = "del"; b.textContent = "امسح"; onTap(b, () => this.typeDigit("del")); }
      else { b.textContent = k; onTap(b, () => this.typeDigit(k)); }
      pad.appendChild(b);
    });
    this.msg(`احفظ الرقم ده (${cnt} أرقام)`);
    const showMs = Math.round((900 + cnt * 380) * (fast ? 0.65 : 1));
    this.later(() => { s.phase = "input"; this.renderDigits(); this.msg("اكتبه من دماغك"); }, showMs);
  },
  renderDigits(mark) {
    const s = this.s, box = $("#memDigits"); box.className = "digits";
    let h = "";
    for (let i = 0; i < s.digits.length; i++) {
      const v = s.input[i];
      const cls = mark ? (v === s.digits[i] ? "ok" : "bad") : "";
      h += `<span class="${cls}">${v == null ? "" : v}</span>`;
    }
    box.innerHTML = h;
  },
  typeDigit(k) {
    const s = this.s; if (s.phase !== "input") return;
    if (k === "del") { s.input = s.input.slice(0, -1); this.renderDigits(); return; }
    s.input += k; sfx.blip(); buzz(6);
    this.renderDigits();
    if (s.input.length === s.digits.length) {
      const [x, y] = centerOf($("#memDigits"));
      if (s.input === s.digits) { this.renderDigits(true); burst(x, y, "#3ddc97", 14); this.success(x, y); }
      else {
        this.renderDigits(true);
        $("#memDigits").insertAdjacentHTML("afterend", `<div class="digits answer">${[...s.digits].map(d => `<span>${d}</span>`).join("")}</div>`);
        this.fail();
      }
    }
  },
  onKeyDoc(e) {
    if (!this.s || !this.s.alive || this.s.phase !== "input" || !this.s.digits || this.s.variant === "squares") return;
    if (!this.isLevel() || this.cfg.variant !== "numbers") return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); this.typeDigit(e.key); }
    else if (e.key === "Backspace") { e.preventDefault(); this.typeDigit("del"); }
  },

  /* ---------- نجاح / فشل ---------- */
  success(x, y) {
    const s = this.s; s.phase = "done"; s.streak++;
    const pts = this.count() * 10 * Math.min(3, s.streak);
    s.score += pts; setScore(s.score); floatText(x, y - 30, "+" + pts, "gold");
    sfx.level();
    this.msg(s.streak >= 3 ? `${s.streak} ورا بعض! النقط ×${Math.min(3, s.streak)}` : pick(["عاش!", "ذاكرة حديد!", "برافو!"]));
    if (this.isLevel()) {
      s.round++;
      this.hud();
      if (s.round >= this.cfg.rounds) { this.later(() => this.finish(true), 700); return; }
    } else { s.level++; this.hud(); }
    this.later(() => this.round(), 850);
  },
  fail() {
    const s = this.s; s.phase = "done"; s.lives--; s.streak = 0;
    sfx.bad(); buzz([40, 30, 40]); shake();
    this.hud();
    if (s.lives <= 0) { this.msg("خلصت المحاولات"); this.later(() => this.finish(false), 1100); }
    else { this.msg("قريبة! نعيد الجولة"); this.later(() => this.round(), 1500); }
  },
  finish(won) {
    const s = this.s; if (!s.alive) return;
    this.stop();
    if (this.hooks.end) this.hooks.end({ game: "mem", won, score: s.score, livesLeft: s.lives, note: this.isLevel() ? "" : `وصلت لمستوى ${s.level}` });
  },
  rank(v) { return v < 100 ? "ذاكرة سمكة" : v < 400 ? "ذاكرة كويسة" : v < 1000 ? "ذاكرة حديد" : "ذاكرة فيل"; }
};
