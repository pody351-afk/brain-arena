/* app.js — الشاشات والتنقل وتشغيل المستويات والزعماء. */
"use strict";
const GAMES = { speed: SpeedBrain, pop: Pop, mem: Mem };
Progress.load();

const App = {
  tab: "home", current: null, run: null, free: null,

  /* ---------- التنقل ---------- */
  show(tab) {
    this.stopGame();
    this.tab = tab;
    for (const id of ["home", "map", "profile", "settings"]) $("#" + id).hidden = id !== tab;
    ui.play.hidden = true; $("#nav").hidden = false; ui.over.hidden = true;
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.go === tab));
    this["render_" + tab]();
  },
  stopGame() { if (this.current) { this.current.stop(); this.current = null; } $(".inter") && $(".inter").remove(); },
  enterPlay(title) {
    for (const id of ["home", "map", "profile", "settings"]) $("#" + id).hidden = true;
    $("#nav").hidden = true; ui.play.hidden = false; ui.over.hidden = true; this.closeSheet();
    ui.title.textContent = title; ui.stage.innerHTML = ""; ui.stage.className = "stage";
  },

  /* ---------- الرئيسية ---------- */
  playerChip() {
    const p = Progress.levelProgress();
    return `<div class="lvl-badge">${p.n}</div><div class="who"><div class="ttl">${Progress.title(p.n)}</div>
      <div class="xpt">${Progress.data.xp} XP · فاضل ${p.span - p.into} للمستوى ${p.n + 1}</div><div class="xpbar"><i style="transform:scaleX(${p.frac.toFixed(3)})"></i></div></div>
      <div class="stars-sum"><i class="star on" style="width:14px;height:14px;vertical-align:-1px"></i> ${Progress.totalStars()}</div>`;
  },
  render_home() {
    $("#homePlayer").innerHTML = this.playerChip();
    const L = Progress.nextLevel(), w = WORLDS[L.world - 1];
    const allDone = Progress.completed() === LEVELS.length;
    $("#continueBtn").innerHTML = `<div><div class="small">${allDone ? "خلّصت كل المستويات! حسّن نجومك" : w.name}</div><div class="big">${Progress.completed() === 0 ? "ابدأ: مستوى 1" : "كمّل: مستوى " + L.n}</div></div>
      <div class="go"><svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7z"/></svg></div>`;
    document.querySelectorAll("[data-best]").forEach(el => {
      const v = Progress.data.best[el.dataset.best] || 0;
      el.textContent = v ? "أحسن نتيجة ليك: " + v : "لسه ما لعبتهاش";
    });
    this.renderSound();
  },
  renderSound() { $("#soundBtn").textContent = Settings.data.sound ? "الصوت: شغّال" : "الصوت: مقفول"; },

  /* ---------- الخريطة ---------- */
  render_map() {
    const cur = Progress.nextLevel().n;
    let h = `<h2 class="h2">خريطة المستويات</h2><p class="sub">8 عوالم و100 مستوى. كل 10 مستويات فيه زعيم بيجمع الألعاب التلاتة. نجمة واحدة تكفي عشان تفتح اللي بعده.</p>`;
    for (const w of WORLDS) {
      const unlocked = Progress.isUnlocked(w.from), st = Progress.worldStars(w), max = (w.to - w.from + 1) * 3;
      h += `<section class="world${unlocked ? "" : " locked"}" style="--w:${w.color}" id="world${w.id}">
        <div class="world-head"><div><div class="world-name">${w.name}</div><div class="world-desc">${w.desc} · مكافأة الإكمال ${w.bonus} XP</div></div>
        <div class="world-stars"><i class="star on" style="width:12px;height:12px;vertical-align:-1px"></i> ${st} / ${max}</div></div><div class="lv-grid">`;
      for (let n = w.from; n <= w.to; n++) {
        const L = LEVELS[n - 1], open = Progress.isUnlocked(n), stars = Progress.stars(n);
        const cls = ["lv", L.boss ? "boss" : "", !open ? "locked" : stars ? "done" : "", n === cur && open ? "cur" : ""].join(" ");
        h += `<button type="button" class="${cls}" data-lv="${n}" aria-label="مستوى ${n}${L.boss ? " زعيم" : ""}${open ? "" : " مقفول"}">${L.boss ? '<span class="bl">زعيم</span>' : ""}${n}${open ? `<span class="st">${STAR_SVG(stars)}</span>` : '<span class="lock"></span>'}</button>`;
      }
      h += `</div></section>`;
    }
    const map = $("#map"); map.innerHTML = h;
    map.querySelectorAll("[data-lv]").forEach(b => b.addEventListener("click", () => {
      const n = +b.dataset.lv;
      if (!Progress.isUnlocked(n)) { sfx.blip(); toast(`خلّص مستوى ${n - 1} الأول`); return; }
      this.levelSheet(LEVELS[n - 1]);
    }));
    const c = map.querySelector(".lv.cur");
    if (c) requestAnimationFrame(() => { const r = c.getBoundingClientRect(), m = map.getBoundingClientRect(); map.scrollTop += r.top - m.top - m.height / 2 + r.height / 2; });
  },

  /* ---------- شيت المستوى ---------- */
  openSheet(html, color) {
    const bg = $("#sheet"), box = $("#sheetBox");
    box.innerHTML = html; box.style.setProperty("--w", color || "var(--muted)");
    bg.hidden = false;
    bg.onclick = e => { if (e.target === bg) this.closeSheet(); };
  },
  closeSheet() { $("#sheet").hidden = true; },
  levelSheet(L) {
    const w = WORLDS[L.world - 1], stars = Progress.stars(L.n), maxXp = L.xpStar * 3 + L.xpFirst;
    const gameLine = L.boss ? L.parts.map((p, i) => `<div><b>${i + 1}.</b> ${GAME_NAMES[p.game]}: ${goalText(p)}</div>`).join("") : "";
    const limits = L.boss ? "" : L.game === "speed" ? `<div>الوقت: ${L.cfg.time} ثانية · الغلطة بـ 3 ثواني</div>` : L.game === "mem" ? "<div>معاك 3 قلوب</div>" : `<div>الحركات: ${L.cfg.moves}</div>`;
    this.openSheet(`
      <div class="kicker">${w.name} · ${L.boss ? "مرحلة زعيم" : GAME_NAMES[L.game]}</div>
      <div class="title">مستوى ${L.n}</div>
      <div class="goal">${esc(L.goal)}</div>
      ${L.boss ? `<div class="rules">${gameLine}</div>` : ""}
      <div class="rules">${limits}
        <div><i class="star on"></i>${starRule(L.boss ? "boss" : L.game)}</div>
        <div>المكافأة: لحد ${maxXp} XP ${stars ? `· نجومك دلوقتي ${stars} من 3` : ""}</div></div>
      <div class="btns"><button class="btn main" type="button" id="goLevel">${stars ? "العب تاني" : "ابدأ"}</button><button class="btn" type="button" id="closeSheet" style="grid-column:1/-1">رجوع</button></div>`, w.color);
    $("#goLevel").addEventListener("click", () => this.startLevel(L));
    $("#closeSheet").addEventListener("click", () => this.closeSheet());
    $("#goLevel").focus();
  },

  /* ---------- تشغيل مستوى ---------- */
  startLevel(L) {
    ensureAudio();
    this.free = null;
    this.run = { level: L, runId: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), part: 0, results: [] };
    hud.offset = 0;
    this.startPart();
  },
  startPart() {
    const run = this.run, L = run.level, part = L.parts[run.part];
    const game = GAMES[part.game];
    this.enterPlay(L.boss ? `زعيم ${L.n / 10} · ${run.part + 1}/3` : `مستوى ${L.n}`);
    resetScore();
    const go = () => { this.current = game; game.start(part.cfg, { end: r => this.onPartEnd(r) }); };
    if (L.boss) this.interstitial(`الجزء ${run.part + 1} من 3`, GAME_NAMES[part.game], goalText(part), go);
    else go();
  },
  interstitial(k, n, d, then) {
    const el = document.createElement("div"); el.className = "inter";
    el.innerHTML = `<div><div class="k">${k}</div><div class="n">${n}</div><div class="d">${esc(d)}</div><div style="margin-top:18px"><button class="btn main" type="button" style="padding:0 34px">يلا</button></div></div>`;
    document.body.appendChild(el);
    const btn = el.querySelector("button"); btn.focus();
    btn.addEventListener("click", () => { el.remove(); then(); });
  },
  onPartEnd(r) {
    const run = this.run; if (!run) return;
    this.current = null;
    run.results.push(r);
    const L = run.level;
    if (r.won && run.part < L.parts.length - 1) {
      hud.offset += r.score; run.part++;
      sfx.level(); setTimeout(() => this.startPart(), 500);
      return;
    }
    const won = r.won, score = run.results.reduce((a, x) => a + x.score, 0);
    const stars = won ? this.starsFor(L, run.results) : 0;
    const res = Progress.applyResult(L, run.runId, { won, stars, score });
    setTimeout(() => this.resultSheet(L, won, res, score, stars), won ? 300 : 500);
  },
  starsFor(L, results) {
    if (L.boss) {
      let pen = 0;
      for (const r of results) { if (r.game === "speed") pen += r.mistakes; if (r.game === "mem") pen += 3 - r.livesLeft; if (r.game === "pop" && r.movesLeft / r.movesTotal < 0.12) pen++; }
      return pen === 0 ? 3 : pen <= 2 ? 2 : 1;
    }
    const r = results[0];
    if (r.game === "speed") return r.mistakes === 0 ? 3 : r.mistakes <= 2 ? 2 : 1;
    if (r.game === "mem") return Math.max(1, r.livesLeft);
    const q = r.movesLeft / r.movesTotal; return q >= 0.25 ? 3 : q >= 0.1 ? 2 : 1;
  },
  resultSheet(L, won, res, score, runStars) {
    const w = WORLDS[L.world - 1], next = LEVELS[L.n] || null;
    const lose = ["قرّبت جدًا! جرّب تاني وهتعدّيها.", "كل محاولة بتعلّم مخك حاجة. يلا تاني!", "الغلط جزء من اللعبة. ركّز وابدأ تاني."];
    let body;
    if (won) {
      const lvlUp = res.levelUpTo > res.levelUpFrom;
      body = `<div class="res-title win">${runStars === 3 ? "ممتاز!" : "كسبت!"}</div>
        <div class="stars-big" aria-label="${runStars} نجوم">${[0, 1, 2].map(i => `<i class="star${i < runStars ? " on" : ""}"></i>`).join("")}</div>
        <div class="res-xp">${res.xp ? "+" + res.xp + " XP" : res.oldStars >= 3 ? "عندك 3 نجوم في المستوى ده من قبل" : "نجومك القديمة أحسن. حسّنها عشان تاخد XP زيادة"}</div>
        ${res.worldBonus ? `<div class="res-msg">خلّصت ${w.name}! مكافأة ${res.worldBonus} XP</div>` : ""}
        ${lvlUp ? `<div class="res-msg" style="color:var(--mango);font-weight:900">رتبة جديدة: مستوى ${res.levelUpTo} · ${Progress.title(res.levelUpTo)}</div>` : ""}
        <div class="res-msg">النقط: ${score}</div>
        <div class="btns">${next ? '<button class="btn main" type="button" id="rNext">المستوى اللي بعده</button>' : '<button class="btn main" type="button" id="rMap">الخريطة</button>'}
          <button class="btn" type="button" id="rAgain">إعادة</button><button class="btn" type="button" id="rMap2">الخريطة</button></div>`;
    } else {
      body = `<div class="res-title">مش المرة دي</div>
        <div class="res-msg">${pick(lose)}</div>
        <div class="res-msg">${esc(L.goal)}</div>
        <div class="btns"><button class="btn main" type="button" id="rAgain">حاول تاني</button><button class="btn" type="button" id="rMap2" style="grid-column:1/-1">الخريطة</button></div>`;
    }
    this.openSheet(`<div class="kicker">${w.name} · مستوى ${L.n}</div>${body}`, w.color);
    $("#sheet").onclick = null; // ما يتقفلش بالغلط بلمسة برّه
    if (won) { sfx.level(); const [x, y] = centerOf($(".stars-big")); ["#ffc93c", "#3ddc97", "#ff6b6b", "#4d9dff"].forEach(c => burst(x, y, c, 14)); buzz([30, 40, 30]); }
    else sfx.over();
    const on = (id, fn) => { const b = $("#" + id); if (b) b.addEventListener("click", fn); };
    on("rNext", () => { this.closeSheet(); this.levelSheet(next); });
    on("rAgain", () => this.startLevel(L));
    on("rMap", () => { this.closeSheet(); this.show("map"); });
    on("rMap2", () => { this.closeSheet(); this.show("map"); });
    const first = $("#rNext") || $("#rAgain"); if (first) first.focus();
  },

  /* ---------- اللعب الحر (النسخة الأولى زي ما هي) ---------- */
  openGame(key) {
    ensureAudio();
    this.stopGame(); this.run = null; hud.offset = 0;
    const g = GAMES[key]; this.free = g;
    this.enterPlay(g.name); resetScore();
    this.current = g;
    g.start({ mode: "free" }, { end: r => this.freeOver(g, r) });
  },
  freeOver(g, r) {
    this.current = null;
    const best = Progress.saveBest(g.key, r.score), isNew = r.score > best;
    $("#overScore").textContent = r.score;
    $("#overRank").textContent = g.rank(r.score);
    const b = $("#overBest");
    b.textContent = isNew ? (best ? "رقم قياسي جديد! كان " + best : "أول رقم قياسي ليك!") : "أحسن نتيجة ليك: " + best;
    b.classList.toggle("new", isNew);
    $("#overNote").textContent = r.note || "";
    setTimeout(() => { ui.over.hidden = false; $("#againBtn").focus(); if (isNew) { sfx.level(); const [x, y] = centerOf($("#overScore")); ["#ffc93c", "#3ddc97", "#ff6b6b", "#4d9dff"].forEach(c => burst(x, y, c, 16)); } else sfx.over(); }, 350);
  },

  /* ---------- ملفي ---------- */
  render_profile() {
    const p = Progress.levelProgress(), d = Progress.data;
    const worlds = WORLDS.filter(w => d.worldsDone[w.id]).length;
    $("#profile").innerHTML = `<h2 class="h2">ملفي</h2>
      <div class="profile-head"><div class="lvl-badge">${p.n}</div><div style="flex:1;min-width:0"><div class="ttl">${Progress.title(p.n)}</div>
        <div class="sub">${d.xp} XP · فاضل ${p.span - p.into} XP للمستوى ${p.n + 1}</div><div class="xpbar"><i style="transform:scaleX(${p.frac.toFixed(3)})"></i></div></div></div>
      <div class="stat-grid">
        <div class="stat"><b>${Progress.totalStars()}</b><span>نجمة من ${LEVELS.length * 3}</span></div>
        <div class="stat"><b>${Progress.completed()}</b><span>مستوى خلّصته من ${LEVELS.length}</span></div>
        <div class="stat"><b>${Progress.bossesBeaten()}</b><span>زعيم غلبته من 10</span></div>
        <div class="stat"><b>${worlds}</b><span>عالم كمّلته من 8</span></div>
      </div>
      <h2 class="h2" style="font-size:24px">أحسن نتايج اللعب الحر</h2>
      <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
        ${["speed", "pop", "mem"].map(g => `<div class="stat"><b style="font-size:28px">${d.best[g] || 0}</b><span>${GAME_NAMES[g]}</span></div>`).join("")}
      </div>
      <div class="note-box">تقدّمك محفوظ على الجهاز ده بس. لما نضيف الحسابات (مرحلة الأونلاين) هتقدر تنقله وتلعب من أي جهاز.</div>`;
  },

  /* ---------- الإعدادات ---------- */
  render_settings() {
    const row = (key, label, sub) => `<button type="button" class="row-set" role="switch" aria-checked="${!!Settings.data[key]}" data-set="${key}"><span>${label}<small>${sub}</small></span><span class="toggle"></span></button>`;
    $("#settings").innerHTML = `<h2 class="h2">الإعدادات</h2>
      ${row("sound", "المؤثرات الصوتية", "أصوات الإجابة والفرقعة")}
      ${row("vibrate", "الاهتزاز", "على الموبايلات اللي بتدعمه")}
      <button type="button" class="row-set danger" id="resetBtn">مسح كل التقدّم</button>
      <div class="note-box">ملعب المخ · نسخة ${APP_VERSION}<br>الحفظ حاليًا على الجهاز ده. لو مسحت بيانات المتصفح التقدّم هيتمسح.</div>`;
    document.querySelectorAll("[data-set]").forEach(b => b.addEventListener("click", () => {
      const k = b.dataset.set; Settings.set(k, !Settings.data[k]); b.setAttribute("aria-checked", !!Settings.data[k]);
      ensureAudio(); sfx.blip(); if (k === "vibrate") buzz(30); this.renderSound();
    }));
    const rb = $("#resetBtn"); let armed = false, t;
    rb.addEventListener("click", () => {
      if (!armed) { armed = true; rb.classList.add("armed"); rb.textContent = "متأكد؟ دوس تاني خلال 4 ثواني للمسح"; t = setTimeout(() => { armed = false; rb.classList.remove("armed"); rb.textContent = "مسح كل التقدّم"; }, 4000); return; }
      clearTimeout(t); Progress.reset(); toast("اتمسح التقدّم"); this.show("settings");
    });
  }
};
const APP_VERSION = "1.2";

/* ---------- ربط الأزرار ---------- */
document.querySelectorAll(".card[data-g]").forEach(c => c.addEventListener("click", () => App.openGame(c.dataset.g)));
document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => App.show(b.dataset.go)));
$("#continueBtn").addEventListener("click", () => App.levelSheet(Progress.nextLevel()));
$("#homePlayer").addEventListener("click", () => App.show("profile"));
document.querySelectorAll("[data-soon]").forEach(b => b.addEventListener("click", () => toast(b.dataset.soon)));
$("#backBtn").addEventListener("click", () => { const toMap = !!App.run; App.run = null; App.show(toMap ? "map" : "home"); });
$("#homeBtn").addEventListener("click", () => App.show("home"));
$("#againBtn").addEventListener("click", () => App.openGame(App.free ? App.free.key : "speed"));
$("#soundBtn").addEventListener("click", () => { Settings.set("sound", !Settings.data.sound); App.renderSound(); ensureAudio(); sfx.blip(); });
$("#shareBtn").addEventListener("click", () => {
  const g = App.free || SpeedBrain;
  const text = `جبت ${scoreNow} في «${g.name}» على ملعب المخ (${g.rank(scoreNow)}). تقدر تغلبني؟`;
  const done = () => toast("اتنسخت! ابعتها لصحابك");
  try { navigator.clipboard.writeText(text).then(done, () => toast(text)); } catch (e) { toast(text); }
});
addEventListener("keydown", e => { if (e.key === "Escape" && !$("#sheet").hidden) App.closeSheet(); });

App.show("home");
// للاختبارات والتطوير
window.__mal3ab = { GAMES, App, Progress, LEVELS, WORLDS, PopLogic, openGame: k => App.openGame(k), goHome: () => App.show("home"), get score() { return scoreNow; } };
