/* online.js — المرحلة D: «العب مع صاحبك» (ماتش لاتنين أونلاين بكود أوضة).
   السيرفر في مجلد server/. هنا: الشاشة، الاتصال، العد التنازلي، نقط المنافس لايف، والنتيجة.
   سباق الكلمات: نفس اللغز بالظبط عند الاتنين (بيتختار من seed بيبعته السيرفر).
   سباق أسرع مخ: نفس نوع الأسئلة ونفس الوقت، بس الأسئلة نفسها مش متطابقة. */
"use strict";
const MATCHES = { // المدة لازم تطابق GAMES في server/server.js
  word: { secs: 90, name: "سباق الكلمات", desc: "نفس الحروف عندكم انتو الاتنين. اللي يجمع نقط أكتر في 90 ثانية يكسب، واللي يخلّص اللغز كله الأول بيقفل الماتش." },
  speed: { secs: 45, name: "سباق أسرع مخ", desc: "45 ثانية أسئلة سريعة. اللي يجمع نقط أكتر يكسب." },
};
const ERRORS = {
  no_room: "مفيش أوضة بالكود ده. اتأكد من الكود.", room_full: "الأوضة دي مليانة (فيها اتنين).",
  version: "صاحبك عنده نسخة تانية من اللعبة. خلّوا الاتنين يحدّثوا الصفحة.", bad_game: "اللعبة دي مش متاحة أونلاين.",
  full_server: "السيرفر زحمة دلوقتي. جرّب كمان شوية.",
};

const Online = {
  state: "menu", ws: null, game: "word", code: "", you: 0, names: ["", ""], opp: 0, oppDone: false, sent: -1, tick: null, wantAgain: false,

  serverUrl() {
    // ?server= للتجربة على الجهاز بس (localhost)، عشان محدش يبعتلك لينك يوصّلك بسيرفر غريب
    const q = new URLSearchParams(location.search).get("server");
    if (q && /^wss?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(q)) return q;
    return this.base != null ? this.base : ONLINE_SERVER; // base للاختبارات بس
  },
  name() { return store.get("name", ""); },
  playing() { return ["countdown", "play", "wait-result"].includes(this.state); },

  /* ---------- الاتصال ---------- */
  connect() {
    if (this.ws && this.ws.readyState === 1) return Promise.resolve();
    const url = this.serverUrl();
    return new Promise((resolve, reject) => {
      let ws; try { ws = new WebSocket(url); } catch (e) { reject(new Error("bad_url")); return; }
      this.ws = ws;
      const t = setTimeout(() => { reject(new Error("timeout")); try { ws.close(); } catch (e) {} }, 75000); // السيرفر المجاني بيصحى في حوالي دقيقة
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t === "hello") { clearTimeout(t); resolve(); } else this.onMsg(m); };
      ws.onerror = () => {};
      ws.onclose = () => { clearTimeout(t); if (this.ws === ws) { this.ws = null; this.onClosed(); } reject(new Error("closed")); };
    });
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
  quit() {
    this.stopTick(); this.hideVs();
    if (this.ws) { const ws = this.ws; this.ws = null; this.send.call({ ws }, { t: "leave" }); try { ws.close(); } catch (e) {} }
    this.state = "menu"; this.code = ""; this.wantAgain = false;
  },
  onClosed() {
    if (this.state === "menu") return;
    const was = this.state; this.quit();
    if (was === "play" || was === "countdown") { App.stopGame(); App.show("online"); }
    else if (App.tab === "online") this.render();
    toast("الاتصال بالسيرفر اتقطع");
  },

  async create(game) {
    if (!this.ready()) return;
    this.game = game; this.state = "connecting"; this.render();
    try { await this.connect(); } catch (e) { return this.fail(e); }
    this.send({ t: "create", game, name: this.name(), v: APP_VERSION });
  },
  async join(code) {
    if (!this.ready()) return;
    code = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length !== 4) { toast("الكود 4 حروف/أرقام"); return; }
    this.state = "connecting"; this.render();
    try { await this.connect(); } catch (e) { return this.fail(e); }
    this.send({ t: "join", code, name: this.name(), v: APP_VERSION });
  },
  ready() {
    if (!this.serverUrl()) { toast("سيرفر اللعب الأونلاين لسه ما اشتغلش"); return false; }
    const n = ($("#onName") && $("#onName").value.trim()) || this.name();
    if (!n) { toast("اكتب اسمك الأول"); $("#onName") && $("#onName").focus(); return false; }
    store.set("name", n.slice(0, 16)); return true;
  },
  fail(e) {
    this.quit(); if (App.tab === "online") this.render();
    toast(e && e.message === "timeout" ? "السيرفر ما ردّش. جرّب تاني كمان شوية." : "مش قادرين نوصل للسيرفر. اتأكد من النت.");
  },

  /* ---------- الرسايل ---------- */
  onMsg(m) {
    if (m.t === "room") { this.code = m.code; this.you = m.you; this.game = m.game; this.state = "waiting"; if (App.tab === "online") this.render(); return; }
    if (m.t === "error") { const st = this.state; this.quit(); if (App.tab === "online") this.render(); toast(ERRORS[m.code] || "حصلت مشكلة"); return; }
    if (m.t === "peer") { toast(`${m.name} دخل الأوضة!`); sfx.level(); return; }
    if (m.t === "start") return this.countdown(m);
    if (m.t === "opp") { this.opp = m.v; if (m.done) this.oppDone = true; this.renderVs(); if (this.state === "wait-result") this.waitSheet(); return; }
    if (m.t === "stop") { if (this.state === "play" && App.current) { const g = App.current; g.finish ? g.finish(false) : null; } return; }
    if (m.t === "result") return this.result(m);
    if (m.t === "again") { toast(`${this.names[1 - this.you]} عايز ماتش تاني`); if (this.state === "over") this.resultSheet(); return; }
    if (m.t === "left") {
      const was = this.state;
      this.stopTick(); this.hideVs();
      if (was === "play" || was === "countdown" || was === "wait-result") { App.stopGame(); document.querySelectorAll(".inter").forEach(e => e.remove()); }
      this.quit();
      App.show("online");
      App.openSheet(`<div class="kicker">العب مع صاحبك</div><div class="res-title">${esc(m.name || "صاحبك")} خرج</div>
        <div class="res-msg">${was === "play" || was === "countdown" ? "الماتش اتلغى." : "الأوضة اتقفلت."}</div>
        <div class="btns"><button class="btn main" type="button" id="onOk">تمام</button></div>`, "var(--sky)");
      $("#onOk").addEventListener("click", () => App.closeSheet());
      return;
    }
  },

  /* ---------- الماتش ---------- */
  matchCfg(game, seed) {
    if (game === "word") {
      const r = seededRand(seed), pool = WORD_PUZZLES.map((p, i) => i).filter(i => WORD_PUZZLES[i].w.length >= 5);
      const p = pool[Math.floor(r() * pool.length)];
      return { mode: "level", race: true, p, need: WORD_PUZZLES[p].w.length, time: MATCHES.word.secs, hints: 2 };
    }
    return { mode: "level", race: true, types: ALL_SPEED, goal: 1e9, time: MATCHES.speed.secs, base: 3, bonus: false };
  },
  countdown(m) {
    App.closeSheet();
    this.names = m.names; this.you = m.you; this.game = m.game; this.opp = 0; this.oppDone = false; this.sent = -1; this.wantAgain = false;
    this.cfg = this.matchCfg(m.game, m.seed);
    this.state = "countdown";
    App.enterPlay(MATCHES[m.game].name); resetScore(); hud.offset = 0; setInfo(""); setBar(1);
    this.renderVs();
    const el = document.createElement("div"); el.className = "inter";
    document.body.appendChild(el);
    const steps = ["3", "2", "1", "يلا!"], each = Math.max(200, Math.floor((m.startsIn || 3500) / 4));
    steps.forEach((s, i) => setTimeout(() => {
      if (this.state !== "countdown") return;
      el.innerHTML = `<div><div class="k">${esc(this.names[0])} ضد ${esc(this.names[1])}</div><div class="n cd">${s}</div><div class="d">${esc(MATCHES[m.game].desc)}</div></div>`;
      i < 3 ? sfx.blip() : sfx.level();
    }, i * each));
    setTimeout(() => { el.remove(); if (this.state === "countdown") this.play(); }, steps.length * each);
  },
  play() {
    this.state = "play";
    const g = GAMES[this.game];
    App.current = g; App.run = null; App.free = null;
    g.start(this.cfg, { end: r => this.onEnd(r) });
    this.tick = setInterval(() => { if (scoreNow !== this.sent) { this.sent = scoreNow; this.send({ t: "score", v: scoreNow }); this.renderVs(); } }, 250);
  },
  stopTick() { clearInterval(this.tick); this.tick = null; },
  onEnd(r) {
    this.stopTick(); App.current = null;
    this.mine = r.score;
    this.send({ t: "score", v: r.score });
    this.send({ t: "done", score: r.score, all: r.game === "word" && r.won });
    Meta.track({ mode: "online", results: [r], won: false });
    this.state = "wait-result"; this.renderVs(); this.waitSheet();
  },
  waitSheet() {
    App.openSheet(`<div class="kicker">${esc(MATCHES[this.game].name)}</div>
      <div class="res-title" style="font-size:34px">خلّصت!</div>
      <div class="res-msg">نقطك: <b>${this.mine}</b> · ${esc(this.names[1 - this.you])}: <b>${this.opp}</b></div>
      <div class="res-msg">${this.oppDone ? "بنحسب النتيجة..." : "مستنيين صاحبك يخلّص..."}</div>`, "var(--sky)");
    $("#sheet").onclick = null;
  },
  result(m) {
    this.stopTick(); this.state = "over"; this.hideVs();
    if (App.current) { App.current.stop(); App.current = null; }
    this.last = m;
    const me = this.you, won = m.winner === me, draw = m.winner === -1;
    if (won) { Meta.data.stats.onlineWins = (Meta.data.stats.onlineWins || 0) + 1; Meta.save(); Meta.checkAchievements(); }
    this.resultSheet();
    if (won) { sfx.level(); const [x, y] = centerOf($(".res-title")); ["#ffc93c", "#3ddc97", "#4d9dff"].forEach(c => burst(x, y, c, 16)); buzz([30, 40, 30]); }
    else if (!draw) sfx.over();
    App.announce();
  },
  resultSheet() {
    const m = this.last, me = this.you, op = 1 - me, won = m.winner === me, draw = m.winner === -1;
    App.openSheet(`<div class="kicker">${esc(MATCHES[this.game].name)} · أوضة ${esc(this.code)}</div>
      <div class="res-title${won ? " win" : ""}">${draw ? "تعادل!" : won ? "كسبت!" : "خسرت المرة دي"}</div>
      <div class="vs-final"><div class="${won ? "w" : ""}"><span>${esc(m.names[me])} (انت)</span><b>${m.scores[me]}</b></div>
        <div class="${m.winner === op ? "w" : ""}"><span>${esc(m.names[op])}</span><b>${m.scores[op]}</b></div></div>
      ${m.why === "time" ? '<div class="res-msg">النتيجة اتحسبت بآخر نقط وصلت للسيرفر.</div>' : ""}
      <div class="btns"><button class="btn main" type="button" id="onAgain">${this.wantAgain ? "مستنيين صاحبك يوافق..." : "ماتش تاني"}</button>
        <button class="btn" type="button" id="onExit" style="grid-column:1/-1">خروج</button></div>`, won ? "var(--mango)" : "var(--sky)");
    $("#sheet").onclick = null;
    $("#onAgain").disabled = this.wantAgain;
    $("#onAgain").addEventListener("click", () => { this.wantAgain = true; this.send({ t: "again" }); this.resultSheet(); });
    $("#onExit").addEventListener("click", () => { App.closeSheet(); this.quit(); App.show("online"); });
  },

  /* ---------- نقط المنافس فوق ---------- */
  renderVs() {
    const el = $("#vs"); if (!el) return;
    if (!this.playing()) { el.hidden = true; return; }
    const me = this.state === "wait-result" ? this.mine : scoreNow;
    el.hidden = false;
    el.innerHTML = `<span class="me">انت <b>${me}</b></span><span class="sep">ضد</span><span class="op${this.opp > me ? " ahead" : ""}">${esc(this.names[1 - this.you] || "صاحبك")} <b>${this.opp}</b>${this.oppDone ? " ✓" : ""}</span>`;
  },
  hideVs() { const el = $("#vs"); if (el) el.hidden = true; },

  /* ---------- الشاشة ---------- */
  render() {
    const box = $("#online"), noServer = !this.serverUrl();
    if (this.state === "connecting") {
      box.innerHTML = `<h2 class="h2">العب مع صاحبك</h2><div class="on-wait"><div class="spin"></div><div>بنوصل للسيرفر...</div>
        <p class="sub">أول اتصال ممكن ياخد لحد دقيقة لو السيرفر كان نايم.</p></div>
        <button class="btn" type="button" id="onCancel">إلغاء</button>`;
      $("#onCancel").addEventListener("click", () => { this.quit(); this.render(); });
      return;
    }
    if (this.state === "waiting") {
      box.innerHTML = `<h2 class="h2">الأوضة جاهزة</h2>
        <p class="sub">${esc(MATCHES[this.game].name)} · ابعت الكود ده لصاحبك، ولما يدخل الماتش هيبدأ لوحده.</p>
        <div class="on-code" dir="ltr" aria-label="كود الأوضة ${[...this.code].join(" ")}">${[...this.code].map(c => `<b>${c}</b>`).join("")}</div>
        <button class="btn main" type="button" id="onShare">ابعت الكود لصاحبك</button>
        <div class="on-wait"><div class="spin"></div><div>مستنيين صاحبك...</div></div>
        <button class="btn" type="button" id="onCancel">إلغاء</button>`;
      $("#onShare").addEventListener("click", () => this.share());
      $("#onCancel").addEventListener("click", () => { this.quit(); this.render(); });
      return;
    }
    const sel = this.game;
    box.innerHTML = `<h2 class="h2">العب مع صاحبك</h2>
      <p class="sub">اعمل أوضة وابعت الكود لصاحبك، أو ادخل بكوده. انتو الاتنين بتلعبوا في نفس الوقت، وبتشوفوا نقط بعض لايف.</p>
      ${noServer ? '<div class="note-box warn">سيرفر اللعب الأونلاين لسه ما اشتغلش. أول ما يشتغل الزراير دي هتشتغل.</div>' : ""}
      <label class="on-label" for="onName">اسمك</label>
      <input class="on-input" id="onName" maxlength="16" autocomplete="nickname" placeholder="اكتب اسمك" value="${esc(this.name())}">
      <div class="on-label">اختار اللعبة</div>
      <div class="on-games" role="radiogroup">${Object.entries(MATCHES).map(([k, g]) => `<button type="button" role="radio" aria-checked="${k === sel}" class="on-game${k === sel ? " on" : ""}" data-game="${k}"><b>${g.name}</b><span>${g.desc}</span></button>`).join("")}</div>
      <button class="btn main" type="button" id="onCreate"${noServer ? " disabled" : ""}>اعمل أوضة</button>
      <div class="on-or"><span>أو ادخل أوضة صاحبك</span></div>
      <div class="on-join"><input class="on-input" id="onCode" maxlength="4" dir="ltr" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="الكود" inputmode="text">
        <button class="btn" type="button" id="onJoin"${noServer ? " disabled" : ""}>ادخل</button></div>
      <div class="note-box">السيرفر مجاني، فلو محدش لعب من فترة أول اتصال بياخد حوالي دقيقة. النقط بيبعتها جهاز كل لاعب، فالماتش للعب مع أصحابك مش للمسابقات.</div>`;
    box.querySelectorAll("[data-game]").forEach(b => b.addEventListener("click", () => { this.game = b.dataset.game; sfx.blip(); this.render(); }));
    $("#onName").addEventListener("change", e => store.set("name", e.target.value.trim().slice(0, 16)));
    $("#onCreate").addEventListener("click", () => { ensureAudio(); this.create(this.game); });
    $("#onJoin").addEventListener("click", () => { ensureAudio(); this.join($("#onCode").value); });
    $("#onCode").addEventListener("keydown", e => { if (e.key === "Enter") this.join($("#onCode").value); });
  },
  share() {
    const text = `تعالى نلعب «${MATCHES[this.game].name}» في ملعب المخ! افتح ${location.origin + location.pathname} ودوس «العب مع صاحبك» واكتب الكود: ${this.code}`;
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(text).then(() => toast("اتنسخ! ابعته لصاحبك"), () => toast("الكود: " + this.code)); } catch (e) { toast("الكود: " + this.code); }
  },
};
