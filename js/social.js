/* social.js — المرحلة E: الأصحاب ولوحة الترتيب.
   اللاعب بيقرر ينضم بنفسه. الجهاز بيعمل id وسر عشوائيين ويخزنهم هنا، وبيتبعت للسيرفر: اسمك وأحسن نتيجة في كل لعبة بس.
   مفيش إيميل ولا كلمة سر: لو مسحت بيانات المتصفح أو غيّرت الجهاز، حسابك بيضيع.
   النقط بيبعتها الجهاز نفسه، فالترتيب للمتعة مش مسابقة جدّية. */
"use strict";
const SOCIAL_GAMES = { speed: "أسرع مخ", pop: "فرقع", mem: "افتكر", word: "كوّن كلمة" };
const SOCIAL_SCOPES = { all: "الكل", week: "الأسبوع ده", friends: "الأصحاب" };
const SOCIAL_ERRORS = {
  no_player: "مفيش لاعب بالكود ده. اتأكد من الكود.", self: "ده كودك انت 🙂", already: "انتو أصحاب بالفعل.", pending: "الطلب اتبعت قبل كده.",
  too_many: "وصلت للحد الأقصى من الأصحاب.", busy: "اللاعب ده عنده طلبات كتير دلوقتي.", no_request: "الطلب ده مبقاش موجود.",
  bad_auth: "الحساب ده مش مطابق لجهازك. لو مسحت بيانات المتصفح الحساب القديم بيضيع.", full: "السيرفر وصل للحد الأقصى من اللاعبين.", busy_reg: "في زحمة تسجيل دلوقتي. جرّب كمان شوية.", bad_name: "الاسم ده مش مناسب. اختار اسم تاني.",
};

const Social = {
  ws: null, me: null, tab: "board", game: "pop", scope: "all", board: null, loading: false, closeTimer: null, pending: null,

  serverUrl() { return Online.serverUrl(); },
  joined() { return !!store.get("social_on", false) && !!store.get("pid", ""); },
  ident() {
    let id = store.get("pid", ""), secret = store.get("psecret", "");
    if (!/^[a-f0-9]{16}$/.test(id) || !/^[a-f0-9]{32}$/.test(secret)) {
      const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n / 2)), b => b.toString(16).padStart(2, "0")).join("");
      id = hex(16); secret = hex(32); store.set("pid", id); store.set("psecret", secret);
    }
    return { id, secret };
  },

  /* ---------- الاتصال ---------- */
  connect() {
    if (this.ws && this.ws.readyState === 1 && this.me) return Promise.resolve();
    if (this.pending) return this.pending;
    const url = this.serverUrl();
    this.pending = new Promise((resolve, reject) => {
      let ws; try { ws = new WebSocket(url); } catch (e) { reject(new Error("bad_url")); return; }
      this.ws = ws; let done = false;
      const fin = (ok, err) => { if (done) return; done = true; clearTimeout(t); this.pending = null; ok ? resolve() : reject(err); };
      const t = setTimeout(() => { fin(false, new Error("timeout")); try { ws.close(); } catch (e) {} }, 75000); // السيرفر المجاني بيصحى في حوالي دقيقة
      ws.onmessage = e => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === "hello") { const { id, secret } = this.ident(); ws.send(JSON.stringify({ t: "s_auth", id, secret, name: Online.name() || "لاعب" })); return; }
        if (m.t === "me" && !done) { this.me = m; fin(true); }
        if (m.t === "s_error" && !done) fin(false, new Error(m.code));
        this.onMsg(m);
      };
      ws.onerror = () => {};
      ws.onclose = () => { if (this.ws === ws) { this.ws = null; this.me = null; } fin(false, new Error("closed")); };
    });
    return this.pending;
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
  close() { clearTimeout(this.closeTimer); this.pending = null; if (this.ws) { const w = this.ws; this.ws = null; this.me = null; try { w.close(); } catch (e) {} } },
  idleClose(ms = 20000) { clearTimeout(this.closeTimer); this.closeTimer = setTimeout(() => { if (App.tab !== "social") this.close(); }, ms); },

  onMsg(m) {
    if (m.t === "me") {
      this.me = m;
      if (m.ok === "sent") toast("الطلب اتبعت!");
      if (m.ok === "reported") { toast("تم. اللاعب ده اختفى من عندك وهنراجع البلاغ."); this.board = null; this.refreshBoard(); }
      if (App.tab === "social") this.render();
    } else if (m.t === "deleted") {
      for (const k of ["social_on", "pid", "psecret"]) store.set(k, k === "social_on" ? false : "");
      this.close(); this.me = null; this.board = null; toast("اتمسح حسابك وكل بياناتك من السيرفر"); if (App.tab === "social") this.render();
    } else if (m.t === "board") {
      this.board = m; this.loading = false; if (App.tab === "social") this.render();
    } else if (m.t === "s_error") {
      this.loading = false; toast(SOCIAL_ERRORS[m.code] || "حصلت مشكلة"); if (App.tab === "social") this.render();
    }
  },

  /* ---------- الانضمام وإرسال النقط ---------- */
  async join(name) {
    name = String(name || "").trim().slice(0, 16);
    if (!name) { toast("اكتب اسمك الأول"); return; }
    store.set("name", name); this.ident(); this.busy = true; this.render();
    try { await this.connect(); } catch (e) { this.busy = false; store.set("social_on", false); this.fail(e); return; }
    store.set("social_on", true); this.busy = false;
    this.send({ t: "s_name", name });
    // نبعت أحسن نتايج الجهاز الحالية عشان تدخل الترتيب من أول لحظة
    const best = (Progress.data && Progress.data.best) || {};
    for (const g of Object.keys(SOCIAL_GAMES)) if (best[g] > 0) this.send({ t: "s_submit", game: g, score: best[g] });
    this.refreshBoard(); this.render();
  },
  fail(e) {
    this.busy = false; this.close();
    toast(e && e.message && SOCIAL_ERRORS[e.message] ? SOCIAL_ERRORS[e.message] : e && e.message === "timeout" ? "السيرفر ما ردّش. جرّب تاني كمان شوية." : "مش قادرين نوصل للسيرفر. اتأكد من النت.");
    if (App.tab === "social") this.render();
  },
  // بيتنادى بعد كل لعب حر. لو اللاعب مش منضم ما بيتبعتش أي حاجة.
  async submit(game, score) {
    if (!this.joined() || !this.serverUrl() || !SOCIAL_GAMES[game] || !(score > 0)) return;
    try { await this.connect(); } catch (e) { return; }
    this.send({ t: "s_submit", game, score: Math.floor(score) });
    if (App.tab !== "social") this.idleClose(); // نقفل الاتصال بعد شوية عشان ما نشغلش السيرفر على الفاضي
  },
  refreshBoard() { this.loading = true; this.send({ t: "s_board", game: this.game, scope: this.scope }); },
  leaveScreen() { if (this.ws) this.idleClose(2000); },

  /* ---------- الشاشة ---------- */
  async open() {
    if (!this.serverUrl()) return this.render();
    if (!this.joined()) return this.render();
    if (!this.me || !this.ws) {
      this.loading = true; this.render();
      try { await this.connect(); } catch (e) { this.loading = false; return this.fail(e); }
    }
    this.refreshBoard(); this.render();
  },
  render() {
    const box = $("#social"); if (!box) return;
    const noServer = !this.serverUrl();
    if (noServer) { box.innerHTML = `<h2 class="h2">الأصحاب والترتيب</h2><div class="note-box warn">السيرفر لسه ما اشتغلش.</div>`; return; }
    if (!this.joined() || this.busy) {
      box.innerHTML = `<h2 class="h2">الأصحاب والترتيب</h2>
        <p class="sub">انضم عشان تشوف ترتيبك وسط اللاعبين وتضيف أصحابك وتشوف نقطهم.</p>
        <div class="note-box">اللي هيتبعت للسيرفر: <b>اسمك</b> و<b>أحسن نتيجة</b> ليك في كل لعبة، ومعاهم رمز عشوائي لجهازك. مفيش إيميل ولا رقم تليفون.<br>
        لو مسحت بيانات المتصفح أو غيّرت الجهاز، الحساب بيضيع.</div>
        <label class="on-label" for="scName">اسمك</label>
        <input class="on-input" id="scName" maxlength="16" autocomplete="nickname" placeholder="اكتب اسمك" value="${esc(Online.name())}">
        ${this.busy ? '<div class="on-wait"><div class="spin"></div><div>بنوصل للسيرفر... أول مرة ممكن ياخد لحد دقيقة.</div></div>'
          : '<button class="btn main" type="button" id="scJoin">انضم</button>'}`;
      const j = $("#scJoin"); if (j) { j.addEventListener("click", () => this.join($("#scName").value)); $("#scName").addEventListener("keydown", e => { if (e.key === "Enter") this.join($("#scName").value); }); }
      return;
    }
    if (!this.me) { box.innerHTML = `<h2 class="h2">الأصحاب والترتيب</h2><div class="on-wait"><div class="spin"></div><div>بنوصل للسيرفر...</div></div>`; return; }
    const me = this.me, inc = me.incoming.length;
    box.innerHTML = `<h2 class="h2">الأصحاب والترتيب</h2>
      <div class="sc-me"><div><b>${esc(me.name)}</b><span>كود الصاحب بتاعك</span></div>
        <button type="button" class="sc-code" id="scCode" dir="ltr" aria-label="انسخ كودك ${[...me.code].join(" ")}">${me.code}</button></div>
      <div class="sc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected="${this.tab === "board"}" class="${this.tab === "board" ? "on" : ""}" data-tab="board">الترتيب</button>
        <button type="button" role="tab" aria-selected="${this.tab === "friends"}" class="${this.tab === "friends" ? "on" : ""}" data-tab="friends">الأصحاب${inc ? ` <i class="sc-dot">${inc}</i>` : ""}</button>
      </div>
      ${this.tab === "board" ? this.boardHtml() : this.friendsHtml()}`;
    $("#scCode").addEventListener("click", () => this.shareCode());
    box.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => { this.tab = b.dataset.tab; sfx.blip(); this.render(); }));
    box.querySelectorAll("[data-rp]").forEach(b => b.addEventListener("click", () => { if (confirm("تبلّغ عن " + b.dataset.nm + " وتخفيه من عندك؟")) this.send({ t: "s_report", code: b.dataset.rp }); }));
    if (this.tab === "board") {
      box.querySelectorAll("[data-sg]").forEach(b => b.addEventListener("click", () => { this.game = b.dataset.sg; this.board = null; sfx.blip(); this.refreshBoard(); this.render(); }));
      box.querySelectorAll("[data-ss]").forEach(b => b.addEventListener("click", () => { this.scope = b.dataset.ss; this.board = null; sfx.blip(); this.refreshBoard(); this.render(); }));
    } else {
      const add = () => { const v = $("#scAdd").value.toUpperCase().replace(/[^A-Z0-9]/g, ""); if (v.length !== 6) { toast("كود الصاحب 6 حروف/أرقام"); return; } this.send({ t: "s_add", code: v }); $("#scAdd").value = ""; };
      $("#scAddBtn").addEventListener("click", add); $("#scAdd").addEventListener("keydown", e => { if (e.key === "Enter") add(); });
      box.querySelectorAll("[data-acc]").forEach(b => b.addEventListener("click", () => { sfx.level(); this.send({ t: "s_accept", code: b.dataset.acc }); }));
      box.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => this.send({ t: "s_decline", code: b.dataset.dec })));
      $("#scDelete").addEventListener("click", () => { if (confirm("هيتمسح حسابك وأصحابك ونتايجك من الترتيب نهائيًا، ومينفعش نرجّعهم. متأكد؟")) this.send({ t: "s_delete" }); });
      box.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => { if (confirm("تشيل " + b.dataset.nm + " من أصحابك؟")) this.send({ t: "s_remove", code: b.dataset.rm }); }));
    }
  },
  boardHtml() {
    const chips = (obj, attr, cur) => Object.entries(obj).map(([k, n]) => `<button type="button" class="sc-chip${k === cur ? " on" : ""}" aria-pressed="${k === cur}" data-${attr}="${k}">${n}</button>`).join("");
    const b = this.board && this.board.game === this.game && this.board.scope === this.scope ? this.board : null;
    let body;
    if (!b) body = `<div class="on-wait"><div class="spin"></div><div>بنجيب الترتيب...</div></div>`;
    else if (!b.list.length) body = `<div class="note-box">لسه محدش دخل الترتيب ده. العب ${SOCIAL_GAMES[this.game]} وهتظهر هنا.</div>`;
    else body = `<ol class="sc-list">${b.list.map(r => `<li class="${r.me ? "me" : ""}"><span class="rk">${r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span><span class="nm">${esc(r.name)}${r.me ? " (انت)" : ""}</span><b>${r.score}</b>${r.code ? `<button type="button" class="sc-flag" data-rp="${r.code}" data-nm="${esc(r.name)}" aria-label="بلّغ عن ${esc(r.name)}">⚑</button>` : ""}</li>`).join("")}</ol>
      ${b.you && b.you.rank > b.list.length ? `<div class="sc-you">ترتيبك: <b>${b.you.rank}</b> من ${b.total} · ${b.you.score} نقطة</div>` : ""}
      ${!b.you ? `<div class="sc-you">لسه ما لعبتش ${SOCIAL_GAMES[this.game]} ${this.scope === "week" ? "الأسبوع ده" : ""}، العب وهتدخل الترتيب.</div>` : ""}`;
    return `<div class="sc-chips" role="group" aria-label="اللعبة">${chips(SOCIAL_GAMES, "sg", this.game)}</div>
      <div class="sc-chips" role="group" aria-label="النطاق">${chips(SOCIAL_SCOPES, "ss", this.scope)}</div>${body}
      <div class="note-box">النقط بيبعتها جهاز كل لاعب، فالترتيب للمتعة مش للمسابقات. الترتيب الأسبوعي بيبدأ من السبت.</div>`;
  },
  friendsHtml() {
    const me = this.me;
    const best = f => { const e = Object.entries(f.best || {}).filter(([, v]) => v > 0); return e.length ? e.map(([g, v]) => `${SOCIAL_GAMES[g] || g}: ${v}`).join(" · ") : "لسه ما لعبش"; };
    return `<label class="on-label" for="scAdd">ضيف صاحب بكوده</label>
      <div class="on-join"><input class="on-input" id="scAdd" maxlength="6" dir="ltr" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="كود صاحبك">
        <button class="btn" type="button" id="scAddBtn">ضيف</button></div>
      ${me.incoming.length ? `<div class="on-label">طلبات صداقة</div><ul class="sc-reqs">${me.incoming.map(q => `<li><span>${esc(q.name)}</span><button type="button" class="btn sm" data-acc="${q.code}">قبول</button><button type="button" class="btn sm" data-dec="${q.code}">رفض</button></li>`).join("")}</ul>` : ""}
      <div class="on-label">أصحابك (${me.friends.length})</div>
      ${me.friends.length ? `<ul class="sc-friends">${me.friends.map(f => `<li><div><b>${esc(f.name)}</b><span>${esc(best(f))}</span></div><button type="button" class="sc-flag" data-rp="${f.code}" data-nm="${esc(f.name)}" aria-label="بلّغ عن ${esc(f.name)}">⚑</button><button type="button" class="sc-x" data-rm="${f.code}" data-nm="${esc(f.name)}" aria-label="شيل ${esc(f.name)}">×</button></li>`).join("")}</ul>`
        : `<div class="note-box">لسه ما ضفتش حد. ابعت كودك لصاحبك (دوس على الكود فوق) أو اكتب كوده هنا.</div>`}
      <div class="sc-danger"><div class="note-box">⚑ بلّغ عن لاعب بيستخدم اسم مسيء: بيختفي من عندك فورًا، ولو 3 لاعبين بلّغوا عنه بيختفي من الكل.</div>
        <button type="button" class="btn danger" id="scDelete">امسح حسابي وكل بياناتي من السيرفر</button></div>`;
  },
  shareCode() {
    const text = `ضيفني في ملعب المخ! افتح ${SHARE_URL} ودوس «الأصحاب والترتيب» واكتب كودي: ${this.me.code}`;
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    try { navigator.clipboard.writeText(text).then(() => toast("اتنسخ! ابعته لصاحبك"), () => toast("كودك: " + this.me.code)); } catch (e) { toast("كودك: " + this.me.code); }
  },
};
