/* games/speed.js — أسرع مخ.
   وضعين: free (زي النسخة الأولى: الوقت بيزيد مع كل إجابة صح، لحد ما يخلص) و level (هدف: عدد إجابات صح في وقت محدد).
   كل نوع سؤال دالة بترجع: prompt + محتوى + إجابات (واحدة بس صح) + sig عشان ما يتكررش نفس السؤال. */
"use strict";
const SpeedBrain = {
  key: "speed", name: "أسرع مخ",
  COLORS: [["أحمر", "#ff5a5f"], ["أزرق", "#4d8dff"], ["أخضر", "#3ddc84"], ["أصفر", "#ffd23f"]],
  CHEERS: ["عاش!", "يا وحش!", "مخك نار!", "مين يوقفك؟", "أسطورة!"],
  FREE: { types: ["tf", "tf", "stroop", "stroop", "bigger", "odd"], time: 30, bonus: true, base: 0, goal: 0 },

  start(cfg = {}, hooks = {}) {
    this.cfg = Object.assign({ mode: "free" }, this.FREE, cfg);
    this.hooks = hooks;
    const T = this.cfg.time;
    this.s = { time: T, max: T, combo: 0, correct: 0, mistakes: 0, alive: true, last: performance.now(), lock: false, score: 0, recent: [] };
    ui.stage.innerHTML = '<div class="sb"><div class="sb-prompt" id="sbPrompt"></div><div class="sb-body" id="sbBody"></div><div class="sb-answers" id="sbAns"></div><div class="sb-combo" id="sbCombo"></div></div>';
    this.hud(); this.next();
    this.raf = requestAnimationFrame(t => this.loop(t));
  },
  stop() { if (this.s) this.s.alive = false; cancelAnimationFrame(this.raf); },
  isLevel() { return this.cfg.mode === "level"; },
  mult() { return Math.min(5, 1 + Math.floor(this.s.combo / 3)); },
  hud() {
    const s = this.s, m = this.mult();
    if (this.isLevel()) setInfo(`<span>صح: ${s.correct} / ${this.cfg.goal}</span><span>${m > 1 ? "مضاعف ×" + m : "غلطات: " + s.mistakes}</span>`);
    else setInfo(`<span>صح: ${s.correct}</span><span>${m > 1 ? "مضاعف ×" + m : "اجمع 3 صح ورا بعض للمضاعف"}</span>`);
  },
  loop(t) {
    const s = this.s; if (!s.alive) return;
    s.time -= Math.min(0.1, Math.max(0, (t - s.last) / 1000)); s.last = t; // أقصى 0.1 ثانية للفريم: الرجوع بعد غياب ما يخصمش الوقت كله
    setBar(s.time / s.max);
    if (s.time <= 0) { setBar(0); this.finish(false); return; }
    this.raf = requestAnimationFrame(tt => this.loop(tt));
  },
  finish(won) {
    const s = this.s; if (!s.alive) return;
    s.alive = false; cancelAnimationFrame(this.raf);
    if (this.hooks.end) this.hooks.end({ game: "speed", won, score: s.score, mistakes: s.mistakes, correct: s.correct, timeLeft: Math.max(0, s.time), note: `جاوبت ${s.correct} صح` });
  },
  diff() { return (this.cfg.base || 0) + Math.floor(this.s.correct / (this.isLevel() ? 6 : 4)); },

  makeQuestion() {
    let q;
    for (let tries = 0; tries < 15; tries++) {
      q = this["q_" + pick(this.cfg.types)](this.diff());
      if (!this.s.recent.includes(q.sig)) break;
    }
    this.s.recent.push(q.sig); if (this.s.recent.length > 15) this.s.recent.shift();
    return q;
  },
  next() {
    const q = this.makeQuestion();
    this.q = q;
    $("#sbPrompt").innerHTML = q.prompt;
    const body = $("#sbBody"), ans = $("#sbAns");
    body.innerHTML = ""; ans.innerHTML = "";
    if (q.html) body.innerHTML = q.html;
    if (q.grid) body.appendChild(q.grid);
    (q.answers || []).forEach(a => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "ans " + (a.cls || ""); b.textContent = a.label;
      onTap(b, () => this.answer(a.correct, b));
      ans.appendChild(b);
    });
    ans.classList.toggle("four", (q.answers || []).length > 2);
    ans.hidden = !(q.answers && q.answers.length);
  },

  /* ---------- أنواع الأسئلة ---------- */
  q_tf(d) {
    const op = pick(d < 2 ? ["+", "−"] : ["+", "−", "×"]);
    let a, b, r;
    if (op === "+") { a = ri(2, 9 + d * 6); b = ri(2, 9 + d * 6); r = a + b; }
    else if (op === "−") { a = ri(6, 14 + d * 6); b = ri(1, a - 1); r = a - b; }
    else { a = ri(2, 5 + d); b = ri(2, 9); r = a * b; }
    let shown = r;
    if (Math.random() < 0.5) { const offs = [-2, -1, 1, 2, op === "×" ? a : 10]; do { shown = r + pick(offs); } while (shown === r || shown < 0); }
    return { sig: `tf${a}${op}${b}=${shown}`, prompt: "صح ولا غلط؟", html: `<div class="eq">${a} ${op} ${b} = ${shown}</div>`,
      answers: [{ label: "صح", correct: shown === r, cls: "yes" }, { label: "غلط", correct: shown !== r, cls: "no" }] };
  },
  q_stroop() {
    const C = this.COLORS, w = pick(C);
    const ink = Math.random() < 0.75 ? pick(C.filter(c => c !== w)) : w;
    const other = ink === w ? pick(C.filter(c => c !== w)) : w;
    return { sig: `st${w[0]}${ink[0]}${other[0]}`, prompt: "دوس على <b>لون</b> الكلمة، مش معناها", html: `<div class="word" style="color:${ink[1]}">${w[0]}</div>`,
      answers: shuffle([ink, other]).map(o => ({ label: o[0], correct: o === ink })) };
  },
  q_meaning() { // الخداع: المرة دي المطلوب المعنى
    const C = this.COLORS, w = pick(C);
    const ink = Math.random() < 0.85 ? pick(C.filter(c => c !== w)) : w;
    const other = ink === w ? pick(C.filter(c => c !== w)) : ink;
    return { sig: `mn${w[0]}${ink[0]}${other[0]}`, prompt: "دوس على <b>معنى</b> الكلمة، مش لونها", html: `<div class="word" style="color:${ink[1]}">${w[0]}</div>`,
      answers: shuffle([w, other]).map(o => ({ label: o[0], correct: o === w })) };
  },
  _expr(d) { const op = pick(d < 2 ? ["+"] : ["+", "×"]); const a = ri(2, 6 + d * 2), b = ri(2, 9); return { t: `${a} ${op} ${b}`, v: op === "+" ? a + b : a * b }; },
  q_bigger(d) {
    const x = this._expr(d); let y = this._expr(d); while (y.v === x.v) y = this._expr(d);
    return { sig: `bg${x.t}|${y.t}`, prompt: "أنهي <b>أكبر</b>؟", html: "",
      answers: [x, y].map(e => ({ label: e.t, correct: e.v === Math.max(x.v, y.v), cls: "ltr" })) };
  },
  q_smaller(d) {
    const x = this._expr(d); let y = this._expr(d); while (y.v === x.v) y = this._expr(d);
    return { sig: `sm${x.t}|${y.t}`, prompt: "أنهي <b>أصغر</b>؟", html: "",
      answers: [x, y].map(e => ({ label: e.t, correct: e.v === Math.min(x.v, y.v), cls: "ltr" })) };
  },
  _options(right, near) { // 4 اختيارات: واحد صح و3 قريبين منه، كلهم موجبين ومختلفين
    const set = new Set([right]);
    for (const o of shuffle(near.slice())) { if (set.size >= 4) break; if (o > 0 && o !== right) set.add(o); }
    let k = 1; while (set.size < 4) { if (right + k > 0) set.add(right + k); k = k > 0 ? -k : -k + 1; }
    return shuffle([...set]).map(v => ({ label: String(v), correct: v === right, cls: "ltr" }));
  },
  q_missing(d) {
    const op = pick(d < 3 ? ["+", "−"] : ["+", "−", "×"]);
    let a, b, r;
    if (op === "+") { a = ri(2, 10 + d * 5); b = ri(2, 10 + d * 5); r = a + b; }
    else if (op === "−") { r = ri(1, 10 + d * 4); b = ri(1, 9 + d * 3); a = r + b; }
    else { a = ri(2, 4 + d); b = ri(2, 9); r = a * b; }
    return { sig: `ms${a}${op}${b}`, prompt: "إيه الرقم <b>الناقص</b>؟", html: `<div class="eq">${a} ${op} ? = ${r}</div>`,
      answers: this._options(b, [b + 1, b - 1, b + 2, b - 2, b + 10, b * 2]) };
  },
  q_pattern(d) {
    const kinds = ["add"]; if (d >= 2) kinds.push("mul"); if (d >= 4) kinds.push("alt"); if (d >= 5) kinds.push("sq"); if (d >= 7) kinds.push("fib");
    const kind = pick(kinds); let seq = [], step = 0;
    if (kind === "add") { const s = ri(1, 12), st = ri(2, 4 + d) * (d >= 3 && Math.random() < 0.3 ? -1 : 1); const s0 = st < 0 ? s + 6 * -st : s; for (let i = 0; i < 5; i++) seq.push(s0 + i * st); step = Math.abs(st); }
    else if (kind === "mul") { const s = ri(1, 3), m = pick([2, 3]); for (let i = 0; i < 5; i++) seq.push(s * m ** i); step = seq[3]; }
    else if (kind === "alt") { const s = ri(1, 9), a = ri(2, 5), b = ri(1, 4) + a; for (let i = 0, v = s; i < 5; i++) { seq.push(v); v += i % 2 ? b : a; } step = a; }
    else if (kind === "sq") { const s = ri(1, 4); for (let i = 0; i < 5; i++) seq.push((s + i) ** 2); step = 2 * (s + 3) + 1; }
    else { let x = ri(1, 3), y = ri(2, 4); for (let i = 0; i < 5; i++) { seq.push(x); [x, y] = [y, x + y]; } step = seq[2]; }
    const right = seq[4];
    return { sig: `pt${seq.join(",")}`, prompt: "كمّل <b>النمط</b>", html: `<div class="seq">${seq.slice(0, 4).map(v => `<span>${v}</span>`).join("")}<span class="q">?</span></div>`,
      answers: this._options(right, [right + step, right - step, right + 1, right - 1, right + 2, seq[3] + 1]) };
  },
  q_odd(d) {
    const n = d < 2 ? 3 : d < 5 ? 4 : 5, h = ri(0, 359), L = 52, delta = Math.max(6, 20 - d * 2.2), idx = ri(0, n * n - 1);
    const grid = document.createElement("div"); grid.className = "odd"; grid.style.gridTemplateColumns = `repeat(${n},1fr)`;
    for (let i = 0; i < n * n; i++) {
      const b = document.createElement("button"); b.type = "button";
      b.style.background = `hsl(${h} 72% ${i === idx ? L + delta : L}%)`;
      b.setAttribute("aria-label", "دايرة " + (i + 1));
      onTap(b, () => this.answer(i === idx, b));
      grid.appendChild(b);
    }
    return { sig: `od${n}${idx}${h}`, prompt: "فين اللون المختلف؟", grid, answers: [] };
  },

  answer(ok, el) {
    const s = this.s; if (s.lock || !s.alive) return;
    s.lock = true;
    const [x, y] = centerOf(el);
    if (ok) {
      s.correct++; s.combo++;
      const pts = 10 * this.mult();
      s.score += pts; setScore(s.score);
      if (this.cfg.bonus) s.time = Math.min(s.max, s.time + Math.max(0.7, 1.6 - 0.08 * this.diff()));
      sfx.good(Math.min(s.combo, 12)); buzz(10);
      burst(x, y, "#3ddc97", 12); floatText(x, y - 20, "+" + pts, "good");
      el.classList.add("right");
      if (s.combo % 5 === 0) { const [cx, cy] = screenCenter(); floatText(cx, cy, this.CHEERS[Math.min(this.CHEERS.length - 1, s.combo / 5 - 1)], "huge"); sfx.cheer(); }
      $("#sbCombo").textContent = s.combo >= 3 ? `${s.combo} ورا بعض` : "";
    } else {
      s.combo = 0; s.mistakes++; s.time -= 3;
      sfx.bad(); buzz([40, 30, 40]); shake();
      floatText(x, y - 20, "ناقص 3 ثواني", "bad"); el.classList.add("wrong");
      $("#sbCombo").textContent = "";
    }
    this.hud();
    if (ok && this.isLevel() && s.correct >= this.cfg.goal) { setTimeout(() => this.finish(true), 250); return; }
    setTimeout(() => { s.lock = false; if (s.alive) this.next(); }, ok ? 170 : 450);
  },
  rank(v) { return v < 100 ? "مخ بيسخّن" : v < 250 ? "مخ شغّال" : v < 500 ? "مخ نضيف" : v < 900 ? "مخك نار" : "أسطورة المخ"; }
};
