/* meta.js — المرحلة C: التحدي اليومي، المهام اليومية والأسبوعية، الإنجازات.
   كل حاجة محفوظة على الجهاز (localStorage) تحت مفتاح "meta" لوحده، بعيد عن تقدّم المستويات.
   أي مكافأة XP بتتسجل مرة واحدة بس (بعلامة claimed / done / وقت فتح الإنجاز)، فتحديث الصفحة أو اللعب تاني ما يكررهاش.
   التاريخ بيتحسب بتوقيت جهاز اللاعب. Meta.clock ممكن يتغيّر في الاختبارات. */
"use strict";

/* ---------- أدوات التاريخ والعشوائية الثابتة ---------- */
const pad2 = n => String(n).padStart(2, "0");
const dayKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 1) % 7)); return x; }; // الأسبوع بيبدأ السبت
function seedFrom(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededRand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- التحدي اليومي ---------- */
// القوالب: نفس نوع التحدي ونفس الهدف لكل اللاعبين في نفس اليوم (الأسئلة/اللوحة نفسها بتتولد عشوائي جوه اللعبة).
const DAILY_TEMPLATES = [
  r => ({ name: "سباق الحساب", ...S(["tf", "missing", "bigger", "smaller"], 12, 45, 2) }),
  r => ({ name: "خدعة الألوان", ...S(["stroop", "meaning", "odd"], 12, 45, 2) }),
  r => ({ name: "خليط المخ", ...S(ALL_SPEED, 14, 50, 3) }),
  r => ({ name: "مطاردة اللون", ...P("color", { k: Math.floor(r() * 5), n: 12 }, 18) }),
  r => ({ name: "يوم النقط", ...P("score", 1000, 18) }),
  r => ({ name: "يوم القنابل", ...P("bombs", 2, 16, 4) }),
  r => ({ name: "ذاكرة حديد", ...M("squares", 4, 6, 3) }),
  r => ({ name: "الترتيب الصح", ...M("order", 4, 5, 3) }),
  r => ({ name: "أرقام وبس", ...M("numbers", 0, 6, 3) }),
  r => ({ name: "بالعكس", ...M("reverse", 4, 4, 3) }),
  r => ({ name: "كلمة اليوم", ...W(WORD_PUZZLES[WORD_TIERS[4][Math.floor(r() * WORD_TIERS[4].length)]].l, 99, 80) }),
];
const DAILY_XP = 60, DAILY_STREAK_XP = 10; // + 10 لكل يوم في السلسلة لحد 7

/* ---------- المهام ---------- */
// ev = اسم العداد اللي بيزوّد المهمة (بيتحسب في Meta.track)
const QUESTS_DAY = [
  { id: "d_play3", text: "العب 3 مرات (أي لعبة)", ev: "play", target: 3 },
  { id: "d_win2", text: "اكسب مستويين", ev: "win_level", target: 2 },
  { id: "d_star3", text: "خد 3 نجوم في أي مستوى", ev: "stars3", target: 1 },
  { id: "d_speed15", text: "جاوب 15 إجابة صح في «أسرع مخ»", ev: "speed_correct", target: 15 },
  { id: "d_pop2", text: "العب «فرقع» مرتين", ev: "game_pop", target: 2 },
  { id: "d_mem2", text: "العب «افتكر» مرتين", ev: "game_mem", target: 2 },
  { id: "d_free1", text: "العب مرة في اللعب الحر", ev: "free", target: 1 },
  { id: "d_daily", text: "خلّص التحدي اليومي", ev: "daily", target: 1 },
  { id: "d_words10", text: "لاقي 10 كلمات في «كوّن كلمة»", ev: "word_found", target: 10 },
];
const QUESTS_WEEK = [
  { id: "w_play20", text: "العب 20 مرة", ev: "play", target: 20 },
  { id: "w_win10", text: "اكسب 10 مستويات", ev: "win_level", target: 10 },
  { id: "w_star5", text: "خد 3 نجوم في 5 مستويات", ev: "stars3", target: 5 },
  { id: "w_speed100", text: "جاوب 100 إجابة صح في «أسرع مخ»", ev: "speed_correct", target: 100 },
  { id: "w_boss1", text: "اغلب زعيم", ev: "boss", target: 1, needs: () => Progress.isUnlocked(10) },
  { id: "w_daily3", text: "خلّص التحدي اليومي 3 أيام", ev: "daily", target: 3 },
  { id: "w_free5", text: "العب 5 مرات في اللعب الحر", ev: "free", target: 5 },
  { id: "w_words60", text: "لاقي 60 كلمة في «كوّن كلمة»", ev: "word_found", target: 60 },
];
const QUEST_XP = { day: 25, week: 100 };

/* ---------- الإنجازات ---------- */
const P_ = () => Progress, M_ = () => Meta.data;
const ACHIEVEMENTS = [
  { id: "a_first", name: "أول خطوة", desc: "خلّص أول مستوى", xp: 20, have: () => P_().completed(), need: 1 },
  { id: "a_lv10", name: "بداية قوية", desc: "خلّص 10 مستويات", xp: 40, have: () => P_().completed(), need: 10 },
  { id: "a_lv50", name: "نص الطريق", desc: "خلّص 50 مستوى", xp: 150, have: () => P_().completed(), need: 50 },
  { id: "a_lv100", name: "خلّصت الملعب", desc: "خلّص 100 مستوى", xp: 500, have: () => P_().completed(), need: 100 },
  { id: "a_boss1", name: "صياد الزعماء", desc: "اغلب أول زعيم", xp: 60, have: () => P_().bossesBeaten(), need: 1 },
  { id: "a_boss5", name: "مرعب الزعماء", desc: "اغلب 5 زعماء", xp: 200, have: () => P_().bossesBeaten(), need: 5 },
  { id: "a_boss10", name: "قاهر الزعماء", desc: "اغلب 10 زعماء", xp: 500, have: () => P_().bossesBeaten(), need: 10 },
  { id: "a_star30", name: "جامع النجوم", desc: "اجمع 30 نجمة", xp: 60, have: () => P_().totalStars(), need: 30 },
  { id: "a_star150", name: "سما منوّرة", desc: "اجمع 150 نجمة", xp: 250, have: () => P_().totalStars(), need: 150 },
  { id: "a_star300", name: "الكمال", desc: "اجمع 300 نجمة", xp: 800, have: () => P_().totalStars(), need: 300 },
  { id: "a_perfect10", name: "مثالي", desc: "خد 3 نجوم في 10 مستويات", xp: 100, have: () => Object.values(P_().data.levels).filter(r => r.stars === 3).length, need: 10 },
  { id: "a_world1", name: "أول عالم", desc: "كمّل عالم كامل", xp: 80, have: () => Object.keys(P_().data.worldsDone).length, need: 1 },
  { id: "a_world4", name: "رحّالة", desc: "كمّل 4 عوالم", xp: 250, have: () => Object.keys(P_().data.worldsDone).length, need: 4 },
  { id: "a_daily1", name: "تحدي النهارده", desc: "خلّص أول تحدي يومي", xp: 30, have: () => M_().stats.daily, need: 1 },
  { id: "a_streak3", name: "مواظب", desc: "خلّص التحدي اليومي 3 أيام ورا بعض", xp: 60, have: () => M_().streak.best, need: 3 },
  { id: "a_streak7", name: "أسبوع كامل", desc: "خلّص التحدي اليومي 7 أيام ورا بعض", xp: 200, have: () => M_().streak.best, need: 7 },
  { id: "a_free3", name: "جرّب كله", desc: "العب الألعاب الأربعة في اللعب الحر", xp: 30, have: () => ["speed", "pop", "mem", "word"].filter(g => M_().stats.freeGames[g]).length, need: 4 },
  { id: "a_words100", name: "قاموس ماشي", desc: "لاقي 100 كلمة في «كوّن كلمة»", xp: 150, have: () => M_().stats.words, need: 100 },
  { id: "a_games50", name: "مدمن ملعب", desc: "العب 50 مرة", xp: 150, have: () => M_().stats.plays, need: 50 },
  { id: "a_online1", name: "كسبت صاحبك", desc: "اكسب أول ماتش أونلاين", xp: 80, have: () => M_().stats.onlineWins || 0, need: 1 },
  { id: "a_quest10", name: "شغّيل", desc: "استلم مكافأة 10 مهام", xp: 100, have: () => M_().stats.questsClaimed, need: 10 },
];

const Meta = {
  KEY: "meta", V: 1, data: null,
  clock: () => (window.__testNow ? new Date(window.__testNow) : new Date()), // __testNow للاختبارات بس
  pending: [], // إنجازات اتفتحت ولسه ما اتعرضتش

  fresh() {
    return { v: this.V, daily: { date: "", done: false, stars: 0, best: 0, plays: 0 }, streak: { count: 0, last: "", best: 0 },
      ach: {}, quests: { day: null, week: null },
      stats: { plays: 0, daily: 0, questsClaimed: 0, words: 0, freeGames: {} } };
  },
  load() {
    let d = store.get(this.KEY, null);
    const ok = d && d.v === this.V && d.daily && d.streak && d.ach && d.quests && d.stats;
    if (!ok) d = this.fresh();
    d.stats.freeGames = d.stats.freeGames || {}; d.stats.words = d.stats.words || 0;
    this.data = d;
    this.refresh(false);
    return d;
  },
  save() { return store.set(this.KEY, this.data); },
  reset() { this.data = this.fresh(); this.pending = []; this.refresh(false); this.save(); },

  today() { return dayKey(this.clock()); },
  weekKey() { return dayKey(weekStart(this.clock())); },

  // لما اليوم أو الأسبوع يتغيّر: تحدي جديد ومهام جديدة
  refresh(save = true) {
    const d = this.data, t = this.today(), w = this.weekKey();
    if (d.daily.date !== t) d.daily = { date: t, done: false, stars: 0, best: 0, plays: 0 };
    if (!d.quests.day || d.quests.day.key !== t) d.quests.day = { key: t, items: this.pickQuests(QUESTS_DAY, "d" + t) };
    if (!d.quests.week || d.quests.week.key !== w) d.quests.week = { key: w, items: this.pickQuests(QUESTS_WEEK, "w" + w) };
    if (save) this.save();
  },
  pickQuests(pool, seed) {
    const r = seededRand(seedFrom(seed)), list = pool.filter(q => !q.needs || q.needs()).slice();
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list.slice(0, 3).map(q => ({ id: q.id, prog: 0, claimed: false }));
  },

  /* ----- التحدي اليومي ----- */
  dailySpec(date = this.today()) {
    const r = seededRand(seedFrom("daily-" + date));
    const t = DAILY_TEMPLATES[Math.floor(r() * DAILY_TEMPLATES.length)](r);
    return { n: 0, daily: true, date, title: "التحدي اليومي", name: t.name, game: t.game, cfg: t.cfg, parts: [{ game: t.game, cfg: t.cfg }], goal: goalText(t), world: 1 };
  },
  streakNow() { // السلسلة الحالية (لو فوّت يوم بتبقى 0)
    const s = this.data.streak, t = this.today(), y = dayKey(addDays(this.clock(), -1));
    return s.last === t || s.last === y ? s.count : 0;
  },
  dailyReward() { return DAILY_XP + DAILY_STREAK_XP * Math.min(7, (this.data.streak.last === dayKey(addDays(this.clock(), -1)) ? this.data.streak.count : 0) + 1); },
  // نتيجة التحدي اليومي: المكافأة أول مرة تكسب بس في اليوم
  dailyResult(runId, { won, stars, score }) {
    this.refresh(false);
    const d = this.data, day = d.daily, out = { xp: 0, first: false, streak: this.streakNow(), stars: day.stars };
    if (this._lastDailyRun === runId) return out; // نفس المحاولة اتسجلت قبل كده
    this._lastDailyRun = runId;
    day.plays++;
    if (won) {
      day.stars = Math.max(day.stars, stars); day.best = Math.max(day.best, score | 0); out.stars = day.stars;
      if (!day.done) {
        day.done = true; out.first = true;
        out.xp = this.dailyReward();
        const y = dayKey(addDays(this.clock(), -1));
        d.streak.count = d.streak.last === y ? d.streak.count + 1 : 1;
        d.streak.last = day.date; d.streak.best = Math.max(d.streak.best, d.streak.count);
        d.stats.daily++;
        out.streak = d.streak.count;
        out.level = Progress.addXp(out.xp);
      }
    }
    this.save();
    return out;
  },

  /* ----- تسجيل اللعب للمهام والإنجازات ----- */
  // info = { mode: "level" | "free" | "daily", results: [نتايج الأجزاء], won, stars, boss, dailyFirst }
  track(info) {
    this.refresh(false);
    const d = this.data, c = { play: 1 };
    for (const r of info.results || []) {
      c["game_" + r.game] = (c["game_" + r.game] || 0) + 1;
      if (r.game === "speed") c.speed_correct = (c.speed_correct || 0) + (r.correct | 0);
      if (r.game === "word") { c.word_found = (c.word_found || 0) + (r.found | 0); d.stats.words += r.found | 0; }
    }
    if (info.mode === "level" && info.won) { c.win_level = 1; if (info.stars === 3) c.stars3 = 1; if (info.boss) c.boss = 1; }
    if (info.mode === "free") { c.free = 1; const g = info.results[0] && info.results[0].game; if (g) d.stats.freeGames[g] = (d.stats.freeGames[g] || 0) + 1; }
    if (info.mode === "daily" && info.dailyFirst) c.daily = 1;
    d.stats.plays++;
    for (const [kind, pool] of [["day", QUESTS_DAY], ["week", QUESTS_WEEK]])
      for (const it of d.quests[kind].items) {
        const q = pool.find(x => x.id === it.id);
        if (q && c[q.ev]) it.prog = Math.min(q.target, it.prog + c[q.ev]);
      }
    this.save();
    this.checkAchievements();
  },

  questList(kind) {
    this.refresh(false);
    const pool = kind === "day" ? QUESTS_DAY : QUESTS_WEEK;
    return this.data.quests[kind].items.map(it => { const q = pool.find(x => x.id === it.id); return { ...q, prog: it.prog, claimed: it.claimed, ready: it.prog >= q.target && !it.claimed, xp: QUEST_XP[kind] }; });
  },
  claimable() { return this.questList("day").filter(q => q.ready).length + this.questList("week").filter(q => q.ready).length; },
  claim(kind, id) {
    this.refresh(false);
    const pool = kind === "day" ? QUESTS_DAY : QUESTS_WEEK, it = this.data.quests[kind].items.find(x => x.id === id), q = pool.find(x => x.id === id);
    if (!it || !q || it.claimed || it.prog < q.target) return null;
    it.claimed = true; this.data.stats.questsClaimed++;
    const level = Progress.addXp(QUEST_XP[kind]);
    this.save();
    this.checkAchievements();
    return { xp: QUEST_XP[kind], level };
  },

  /* ----- الإنجازات ----- */
  checkAchievements() {
    const got = [];
    for (const a of ACHIEVEMENTS) {
      if (this.data.ach[a.id]) continue;
      if (a.have() >= a.need) { this.data.ach[a.id] = Date.now(); Progress.addXp(a.xp); got.push(a); }
    }
    if (got.length) { this.save(); this.pending.push(...got); }
    return got;
  },
  achList() { return ACHIEVEMENTS.map(a => ({ ...a, done: !!this.data.ach[a.id], have: Math.min(a.need, a.have()) })); },
  achCount() { return ACHIEVEMENTS.filter(a => this.data.ach[a.id]).length; },
  takePending() { const p = this.pending; this.pending = []; return p; },

  // الوقت الفاضل لحد تجديد اليوم/الأسبوع (نص للعرض)
  untilText(kind) {
    const now = this.clock(), end = kind === "day" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : addDays(weekStart(now), 7);
    const mins = Math.max(1, Math.round((end - now) / 60000));
    if (mins >= 1440) return `${Math.floor(mins / 1440)} يوم`;
    if (mins >= 60) return `${Math.floor(mins / 60)} ساعة`;
    return `${mins} دقيقة`;
  },
};
