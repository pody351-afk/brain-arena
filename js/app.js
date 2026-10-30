/* app.js — الشاشات والتنقل وتشغيل المستويات والزعماء. */
"use strict";
const GAMES = { speed: SpeedBrain, pop: Pop, mem: Mem, word: WordGame };
Progress.load();
Meta.load();
Meta.checkAchievements(); // لو عندك تقدّم قديم يستاهل إنجازات

const SCREENS = ["home", "map", "profile", "settings", "quests", "online"];
const App = {
  tab: "home", current: null, run: null, free: null,

  /* ---------- التنقل ---------- */
  show(tab) {
    this.stopGame();
    if (tab !== "online" && Online.state !== "menu") Online.quit(); // سبت شاشة الأونلاين = خرجت من الأوضة
    Online.hideVs();
    this.tab = tab;
    for (const id of SCREENS) $("#" + id).hidden = id !== tab;
    ui.play.hidden = true; $("#nav").hidden = false; ui.over.hidden = true;
    document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.go === tab));
    this["render_" + tab]();
  },
  stopGame() { if (this.current) { this.current.stop(); this.current = null; } $(".inter") && $(".inter").remove(); },
  enterPlay(title) {
    for (const id of SCREENS) $("#" + id).hidden = true;
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
    this.renderDailyCard();
    const ready = Meta.claimable(), all = Meta.questList("day").concat(Meta.questList("week"));
    $("#questsSub").textContent = ready ? `${ready} جاهزة للاستلام` : `${all.filter(q => q.claimed).length} من ${all.length}`;
    $("#questsBtn").classList.toggle("has", ready > 0);
    $("#achSub").textContent = `${Meta.achCount()} من ${ACHIEVEMENTS.length}`;
    this.renderSound();
    this.announce();
  },
  renderDailyCard() {
    Meta.refresh();
    const D = Meta.dailySpec(), day = Meta.data.daily, st = Meta.streakNow();
    $("#dailyBtn").classList.toggle("done", day.done);
    $("#dailyBtn").innerHTML = `<div class="dc-main"><div class="dc-k">التحدي اليومي · ${GAME_NAMES[D.game]}</div>
      <div class="dc-t">${esc(D.name)}</div>
      <div class="dc-s">${day.done ? `خلّصته النهارده ${STAR_SVG(day.stars)}` : `المكافأة ${Meta.dailyReward()} XP`} · بيتجدد بعد ${Meta.untilText("day")}</div></div>
      <div class="dc-streak"><b>${st}</b><span>${st === 1 ? "يوم" : "أيام"} ورا بعض</span></div>`;
  },
  // إعلان الإنجازات الجديدة واحد ورا التاني
  announce() {
    const list = Meta.takePending(); if (!list.length) return;
    list.forEach((a, i) => setTimeout(() => { toast(`إنجاز جديد: ${a.name} · +${a.xp} XP`); sfx.level(); buzz(30); }, 900 + i * 2000));
    // الإنجاز بيدّي XP، فنحدّث شريط اللاعب لو الرئيسية ظاهرة
    setTimeout(() => { if (this.tab === "home" && ui.play.hidden) $("#homePlayer").innerHTML = this.playerChip(); }, 900);
  },
  renderSound() { $("#soundBtn").textContent = Settings.data.sound ? "الصوت: شغّال" : "الصوت: مقفول"; },

  /* ---------- الخريطة ---------- */
  render_map() {
    const cur = Progress.nextLevel().n;
    let h = `<h2 class="h2">خريطة المستويات</h2><p class="sub">${WORLDS.length} عوالم و${LEVELS.length} مستوى. كل 10 مستويات فيه زعيم بيجمع كذا لعبة. نجمة واحدة تكفي عشان تفتح اللي بعده، و«عالم الكلمات» مفتوح من الأول.</p>`;
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
    const limits = this.limitsFor(L);
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

  limitsFor(L) { return L.boss ? "" : L.game === "speed" ? `<div>الوقت: ${L.cfg.time} ثانية · الغلطة بـ 3 ثواني</div>` : L.game === "mem" ? "<div>معاك 3 قلوب</div>" : L.game === "word" ? `<div>الوقت: ${L.cfg.time} ثانية · ${L.cfg.hints} تلميحات</div>` : `<div>الحركات: ${L.cfg.moves}</div>`; },

  /* ---------- التحدي اليومي ---------- */
  dailySheet() {
    Meta.refresh();
    const D = Meta.dailySpec(), day = Meta.data.daily, st = Meta.streakNow();
    this.openSheet(`
      <div class="kicker">التحدي اليومي · ${GAME_NAMES[D.game]} · ${D.date}</div>
      <div class="title">${esc(D.name)}</div>
      <div class="goal">${esc(D.goal)}</div>
      <div class="rules">${this.limitsFor(D)}
        <div><i class="star on"></i>${starRule(D.game)}</div>
        <div>${day.done ? `خدت مكافأة النهارده (${STAR_SVG(day.stars)}). تقدر تلعبه تاني للمتعة وتحسّن نتيجتك.` : `المكافأة: ${Meta.dailyReward()} XP مرة واحدة النهارده. كل يوم ورا بعض بيزوّد المكافأة.`}</div>
        <div>سلسلتك: ${st} ${st === 1 ? "يوم" : "أيام"} · نوع التحدي وهدفه واحد لكل اللاعبين النهارده</div></div>
      <div class="btns"><button class="btn main" type="button" id="goDaily">${day.done ? "العب تاني" : "ابدأ التحدي"}</button><button class="btn" type="button" id="closeSheet" style="grid-column:1/-1">رجوع</button></div>`, "var(--mint)");
    $("#goDaily").addEventListener("click", () => this.startLevel(Meta.dailySpec()));
    $("#closeSheet").addEventListener("click", () => this.closeSheet());
    $("#goDaily").focus();
  },
  dailyResultSheet(D, won, res, score, runStars) {
    let body;
    if (won) {
      body = `<div class="res-title win">${runStars === 3 ? "ممتاز!" : "عدّيت التحدي!"}</div>
        <div class="stars-big" aria-label="${runStars} نجوم">${STAR_SVG(runStars)}</div>
        <div class="res-xp">${res.first ? `+${res.xp} XP` : "خدت مكافأة النهارده قبل كده"}</div>
        ${res.first ? `<div class="res-msg" style="color:var(--mango);font-weight:900">سلسلتك بقت ${res.streak} ${res.streak === 1 ? "يوم" : "أيام"} ورا بعض. ارجع بكرة عشان تكبر!</div>` : ""}
        ${res.level && res.level.to > res.level.from ? `<div class="res-msg" style="color:var(--mango);font-weight:900">رتبة جديدة: مستوى ${res.level.to} · ${Progress.title(res.level.to)}</div>` : ""}
        <div class="res-msg">النقط: ${score}</div>
        <div class="btns"><button class="btn main" type="button" id="rHome">الرئيسية</button><button class="btn" type="button" id="rAgain" style="grid-column:1/-1">إعادة</button></div>`;
    } else {
      body = `<div class="res-title">مش المرة دي</div>
        <div class="res-msg">التحدي لسه مستنيك النهارده. جرّب تاني!</div>
        <div class="res-msg">${esc(D.goal)}</div>
        <div class="btns"><button class="btn main" type="button" id="rAgain">حاول تاني</button><button class="btn" type="button" id="rHome" style="grid-column:1/-1">الرئيسية</button></div>`;
    }
    this.openSheet(`<div class="kicker">التحدي اليومي · ${esc(D.name)}</div>${body}`, "var(--mint)");
    $("#sheet").onclick = null;
    if (won) { sfx.level(); const [x, y] = centerOf($(".stars-big")); ["#ffc93c", "#3ddc97", "#ff6b6b", "#4d9dff"].forEach(c => burst(x, y, c, 14)); buzz([30, 40, 30]); } else sfx.over();
    $("#rAgain").addEventListener("click", () => this.startLevel(Meta.dailySpec()));
    $("#rHome").addEventListener("click", () => { this.closeSheet(); this.run = null; this.show("home"); });
    ($("#rHome").classList.contains("main") ? $("#rHome") : $("#rAgain")).focus();
    this.announce();
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
    this.enterPlay(L.daily ? L.title : L.boss ? `زعيم ${L.n / 10} · ${run.part + 1}/3` : `مستوى ${L.n}`);
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
    if (L.daily) {
      const res = Meta.dailyResult(run.runId, { won, stars, score });
      Meta.track({ mode: "daily", results: run.results, won, stars, dailyFirst: res.first });
      setTimeout(() => this.dailyResultSheet(L, won, res, score, stars), won ? 300 : 500);
      return;
    }
    const res = Progress.applyResult(L, run.runId, { won, stars, score });
    Meta.track({ mode: "level", results: run.results, won, stars, boss: !!L.boss });
    setTimeout(() => this.resultSheet(L, won, res, score, stars), won ? 300 : 500);
  },
  starsFor(L, results) {
    if (L.boss) {
      let pen = 0;
      for (const r of results) { if (r.game === "speed") pen += r.mistakes; if (r.game === "mem") pen += 3 - r.livesLeft; if (r.game === "pop" && r.movesLeft / r.movesTotal < 0.12) pen++; if (r.game === "word") pen += r.hintsUsed; }
      return pen === 0 ? 3 : pen <= 2 ? 2 : 1;
    }
    const r = results[0];
    if (r.game === "speed") return r.mistakes === 0 ? 3 : r.mistakes <= 2 ? 2 : 1;
    if (r.game === "mem") return Math.max(1, r.livesLeft);
    if (r.game === "word") return r.hintsUsed === 0 ? 3 : r.hintsUsed === 1 ? 2 : 1;
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
    this.announce();
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
    Meta.track({ mode: "free", results: [r], won: false });
    $("#overScore").textContent = r.score;
    $("#overRank").textContent = g.rank(r.score);
    const b = $("#overBest");
    b.textContent = isNew ? (best ? "رقم قياسي جديد! كان " + best : "أول رقم قياسي ليك!") : "أحسن نتيجة ليك: " + best;
    b.classList.toggle("new", isNew);
    $("#overNote").textContent = r.note || "";
    setTimeout(() => { ui.over.hidden = false; $("#againBtn").focus(); if (isNew) { sfx.level(); const [x, y] = centerOf($("#overScore")); ["#ffc93c", "#3ddc97", "#ff6b6b", "#4d9dff"].forEach(c => burst(x, y, c, 16)); } else sfx.over(); this.announce(); }, 350);
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
        <div class="stat"><b>${Progress.bossesBeaten()}</b><span>زعيم غلبته من ${LEVELS.filter(L => L.boss).length}</span></div>
        <div class="stat"><b>${worlds}</b><span>عالم كمّلته من ${WORLDS.length}</span></div>
        <div class="stat"><b>${Meta.achCount()}</b><span>إنجاز من ${ACHIEVEMENTS.length}</span></div>
        <div class="stat"><b>${Meta.data.streak.best}</b><span>أطول سلسلة تحدي يومي</span></div>
      </div>
      <h2 class="h2" style="font-size:24px">أحسن نتايج اللعب الحر</h2>
      <div class="stat-grid">
        ${["speed", "pop", "mem", "word"].map(g => `<div class="stat"><b style="font-size:28px">${d.best[g] || 0}</b><span>${GAME_NAMES[g]}</span></div>`).join("")}
      </div>
      <div class="note-box">تقدّمك محفوظ على الجهاز ده بس. لما نضيف الحسابات (مرحلة الأونلاين) هتقدر تنقله وتلعب من أي جهاز.</div>`;
  },

  /* ---------- المهام والإنجازات ---------- */
  render_quests() {
    const qRow = (q, kind) => `<div class="quest${q.claimed ? " claimed" : q.ready ? " ready" : ""}">
        <div class="q-body"><div class="q-t">${esc(q.text)}</div>
          <div class="q-bar"><i style="transform:scaleX(${Math.min(1, q.prog / q.target).toFixed(3)})"></i></div>
          <div class="q-n">${Math.min(q.prog, q.target)} / ${q.target}</div></div>
        ${q.claimed ? `<span class="q-done">اتاستلمت</span>` : q.ready ? `<button class="q-claim" type="button" data-claim="${kind}:${q.id}">استلم<br>+${q.xp} XP</button>` : `<span class="q-xp">+${q.xp} XP</span>`}
      </div>`;
    const ach = Meta.achList();
    $("#quests").innerHTML = `<h2 class="h2">المهام والإنجازات</h2>
      <p class="sub">خلّص المهام واستلم الـ XP بتاعها. مهام النهارده بتتغيّر كل يوم، ومهام الأسبوع كل سبت.</p>
      <div class="q-head"><h3>مهام النهارده</h3><span>بتتجدد بعد ${Meta.untilText("day")}</span></div>
      ${Meta.questList("day").map(q => qRow(q, "day")).join("")}
      <div class="q-head"><h3>مهام الأسبوع</h3><span>بتتجدد بعد ${Meta.untilText("week")}</span></div>
      ${Meta.questList("week").map(q => qRow(q, "week")).join("")}
      <div class="q-head" id="achSec"><h3>الإنجازات</h3><span>${Meta.achCount()} من ${ach.length}</span></div>
      <div class="ach-grid">${ach.map(a => `<div class="ach${a.done ? " done" : ""}">
        <b>${esc(a.name)}</b><span>${esc(a.desc)}</span>
        <small>${a.done ? `اتفتح · +${a.xp} XP` : `${a.have} / ${a.need} · +${a.xp} XP`}</small></div>`).join("")}</div>`;
    $("#quests").querySelectorAll("[data-claim]").forEach(b => b.addEventListener("click", () => {
      const [kind, id] = b.dataset.claim.split(":");
      const r = Meta.claim(kind, id); if (!r) return;
      ensureAudio(); sfx.level(); buzz([30, 40, 30]);
      const [x, y] = centerOf(b); ["#ffc93c", "#3ddc97"].forEach(c => burst(x, y, c, 12));
      toast(r.level.to > r.level.from ? `+${r.xp} XP · رتبة جديدة: مستوى ${r.level.to}` : `+${r.xp} XP`);
      const top = $("#quests").scrollTop; this.render_quests(); $("#quests").scrollTop = top;
      this.announce();
    }));
  },

  render_online() { Online.render(); },

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
      clearTimeout(t); Progress.reset(); Meta.reset(); toast("اتمسح التقدّم"); this.show("settings");
    });
  }
};
const APP_VERSION = "1.5.2";

/* ---------- ربط الأزرار ---------- */
document.querySelectorAll(".card[data-g]").forEach(c => c.addEventListener("click", () => App.openGame(c.dataset.g)));
document.querySelectorAll("#nav button").forEach(b => b.addEventListener("click", () => App.show(b.dataset.go)));
$("#continueBtn").addEventListener("click", () => App.levelSheet(Progress.nextLevel()));
$("#homePlayer").addEventListener("click", () => App.show("profile"));
$("#dailyBtn").addEventListener("click", () => App.dailySheet());
$("#questsBtn").addEventListener("click", () => App.show("quests"));
$("#onlineBtn").addEventListener("click", () => App.show("online"));
$("#achBtn").addEventListener("click", () => { App.show("quests"); const a = $("#achSec"); if (a) a.scrollIntoView({ block: "start" }); });
document.querySelectorAll("[data-soon]").forEach(b => b.addEventListener("click", () => toast(b.dataset.soon)));
$("#backBtn").addEventListener("click", () => {
  if (Online.playing()) { App.stopGame(); document.querySelectorAll(".inter").forEach(e => e.remove()); Online.quit(); App.show("online"); return; }
  const toMap = !!App.run && !App.run.level.daily; App.run = null; App.show(toMap ? "map" : "home"); });
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
Online.wake();
// للاختبارات والتطوير
window.__mal3ab = { GAMES, App, Progress, Meta, Online, ACHIEVEMENTS, LEVELS, WORLDS, PopLogic, openGame: k => App.openGame(k), goHome: () => App.show("home"), get score() { return scoreNow; } };
