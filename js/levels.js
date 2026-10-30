/* levels.js — العوالم والمستويات (100 مستوى).
   كل مستوى = بيانات بس (اللعبة + الإعدادات + الهدف). عشان تضيف مستوى أو عالم جديد، بتضيف سطر هنا من غير ما تلمس كود الألعاب.
   زعيم كل 10 مستويات: 3 أجزاء ورا بعض من الألعاب التلاتة. */
"use strict";
const WORLDS = [
  { id: 1, name: "عالم المبتدئين", desc: "تتعرّف على الألعاب التلاتة بهدوء.", color: "#3ddc97", from: 1, to: 12 },
  { id: 2, name: "عالم التركيز", desc: "ألوان بتخدع العين ولوحات أكبر.", color: "#4d9dff", from: 13, to: 24 },
  { id: 3, name: "عالم الذاكرة", desc: "ترتيب، وعكس، وأرقام لازم تفتكرها.", color: "#b388ff", from: 25, to: 36 },
  { id: 4, name: "عالم الحساب", desc: "رقم ناقص، أنماط، وضرب سريع.", color: "#ffc93c", from: 37, to: 48 },
  { id: 5, name: "عالم الخداع", desc: "التعليمات بتتقلب. اقرا السؤال كويس.", color: "#ff6b6b", from: 49, to: 61 },
  { id: 6, name: "عالم السرعة", desc: "نفس المهارات بوقت أقل.", color: "#ff9f43", from: 62, to: 74 },
  { id: 7, name: "عالم العباقرة", desc: "تحديات مخلوطة وأطول.", color: "#2ec4b6", from: 75, to: 87 },
  { id: 8, name: "عالم الأساطير", desc: "أصعب حاجة في الملعب.", color: "#f368e0", from: 88, to: 100 },
];
WORLDS.forEach(w => { w.bonus = 150 + 50 * (w.id - 1); });

const GAME_NAMES = { speed: "أسرع مخ", pop: "فرقع", mem: "افتكر", boss: "زعيم" };
const POP_COLOR_NAMES = ["الأحمر", "الأخضر", "الأزرق", "الأصفر", "البنفسجي"];
const ALL_SPEED = ["tf", "bigger", "stroop", "odd", "missing", "pattern", "meaning", "smaller"];

// مصانع صغيرة لكل نوع مستوى.
// أرقام فرقع متعايرة بالمحاكاة (tests/calibrate-pop.js): لاعب بسيط من غير تخطيط بيكسب من 97% في الأول لحوالي 82% في الآخر.
const S = (types, goal, time, base = 0) => ({ game: "speed", cfg: { mode: "level", types, goal, time, base, bonus: false } });
const M = (variant, size, count, rounds = 3, fast = false) => ({ game: "mem", cfg: { mode: "level", variant, size, count, rounds, fast } });
const P = (type, val, moves, colors = 5) => {
  const goal = type === "color" ? { type, k: val.k, n: val.n } : { type, n: val };
  return { game: "pop", cfg: { mode: "level", goal, moves, colors, stones: type === "stones" ? val : 0 } };
};

// المستويات العادية لكل عالم بالترتيب (الزعماء بيتحطوا تلقائيًا في 10، 20، ... 100)
const PLAN = {
  1: [S(["tf"], 5, 40), M("squares", 3, 3, 2), P("score", 600, 15), S(["bigger"], 6, 40), M("squares", 3, 4, 2), P("color", { k: 0, n: 10 }, 15),
      S(["stroop"], 6, 40), M("order", 3, 3, 2), P("score", 800, 16), S(["tf", "bigger", "stroop"], 8, 45), P("bombs", 1, 12, 4)],
  2: [S(["odd"], 6, 40), S(["stroop"], 8, 40), M("squares", 4, 4, 3), P("color", { k: 1, n: 10 }, 16), S(["odd", "stroop"], 10, 45), P("color", { k: 2, n: 12 }, 18),
      M("squares", 4, 5, 3), S(["odd"], 10, 40, 2), P("stones", 6, 7), S(["stroop", "odd", "bigger"], 12, 45, 1), M("order", 4, 4, 3)],
  3: [M("order", 3, 4, 3), M("reverse", 3, 3, 3), M("numbers", 0, 4, 3), S(["tf", "bigger"], 10, 40, 2), M("squares", 4, 6, 3), P("score", 1100, 18),
      M("reverse", 4, 4, 3), M("numbers", 0, 5, 3), M("order", 4, 5, 3), P("stones", 9, 8), M("numbers", 0, 6, 3)],
  4: [S(["tf"], 10, 40, 2), S(["missing"], 8, 45), S(["pattern"], 6, 45), M("reverse", 3, 5, 3), S(["bigger", "missing"], 10, 45, 2), P("score", 1050, 20),
      S(["pattern", "tf"], 10, 45, 2), S(["missing"], 10, 40, 3), P("bombs", 3, 22, 4), S(["tf", "missing", "pattern", "bigger"], 14, 50, 3), M("order", 4, 6, 3)],
  5: [S(["meaning"], 8, 40), S(["smaller"], 8, 40, 2), S(["meaning", "stroop"], 10, 45, 2), M("reverse", 4, 5, 3), P("stones", 12, 9), S(["smaller", "bigger"], 10, 40, 3),
      S(["meaning", "stroop", "odd"], 12, 45, 3), P("color", { k: 3, n: 15 }, 20), M("squares", 4, 7, 3), S(["tf", "smaller", "meaning"], 12, 45, 4), P("stones", 14, 10)],
  6: [S(["tf", "bigger"], 12, 30, 4), S(["stroop", "odd"], 12, 30, 4), P("score", 1100, 16), M("squares", 5, 6, 3, true), S(["missing", "pattern"], 10, 35, 4), M("order", 5, 6, 3, true),
      S(["meaning", "smaller"], 12, 30, 4), P("color", { k: 4, n: 13 }, 18), S(["tf", "missing"], 14, 30, 5), M("numbers", 0, 7, 3, true), S(["odd", "stroop", "meaning", "smaller"], 15, 32, 5), P("bombs", 2, 14, 4)],
  7: [S(["pattern"], 10, 40, 6), M("reverse", 5, 6, 3), P("stones", 16, 11), S(["missing", "pattern", "tf"], 15, 45, 6), M("numbers", 0, 8, 3), S(["meaning", "stroop", "smaller", "odd"], 15, 40, 6),
      P("score", 1300, 20), M("order", 5, 7, 3), S(ALL_SPEED, 18, 50, 6), P("color", { k: 0, n: 15 }, 20), M("reverse", 5, 7, 3), S(["pattern", "missing"], 14, 40, 7)],
  8: [S(ALL_SPEED, 18, 45, 8), M("numbers", 0, 9, 3), P("stones", 18, 12), M("reverse", 5, 8, 3), S(["meaning", "smaller", "pattern", "missing"], 18, 45, 8), P("bombs", 4, 24, 4),
      M("order", 6, 8, 3), S(ALL_SPEED, 20, 45, 9), P("score", 1550, 22), M("numbers", 0, 10, 3), S(ALL_SPEED, 22, 45, 10)],
};

function bossParts(k) { // k = 1..10
  const memV = ["squares", "order", "squares", "reverse", "numbers", "order", "reverse", "numbers", "order", "reverse"][k - 1];
  const types = k <= 2 ? ["tf", "bigger", "stroop"] : k <= 4 ? ["tf", "stroop", "odd", "missing"] : ALL_SPEED;
  return [
    { game: "speed", cfg: { mode: "level", types, goal: 5 + k, time: 35, base: Math.min(10, k), bonus: false } },
    { game: "mem", cfg: { mode: "level", variant: memV, size: k <= 3 ? 3 : k <= 7 ? 4 : 5, count: 3 + Math.floor(k / 2), rounds: 2, fast: k >= 6 } },
    { game: "pop", cfg: { mode: "level", goal: { type: "color", k: (k - 1) % 5, n: [9, 9, 10, 10, 11, 11, 11, 11, 11, 12][k - 1] }, moves: 14, colors: 5, stones: 0 } },
  ];
}

function goalText(spec) {
  const c = spec.cfg;
  if (spec.game === "speed") return `جاوب ${c.goal} إجابة صح قبل ما ${c.time} ثانية يخلصوا`;
  if (spec.game === "mem") {
    const what = { squares: "افتكر المربعات اللي بتنوّر", order: "افتكر ترتيب المربعات ودوس بنفس الترتيب", reverse: "افتكر الترتيب ودوس بالعكس (من الآخر للأول)", numbers: "افتكر الأرقام واكتبها" }[c.variant];
    return `${what}. عدّي ${c.rounds} جولات (أول جولة ${c.count}${c.variant === "numbers" ? " أرقام" : " مربعات"})`;
  }
  if (spec.game === "pop") {
    const g = c.goal;
    if (g.type === "score") return `اجمع ${g.n} نقطة في ${c.moves} حركة`;
    if (g.type === "color") return `فرقع ${g.n} حلوى من اللون ${POP_COLOR_NAMES[g.k]} في ${c.moves} حركة`;
    if (g.type === "stones") return `اكسر ${g.n} صخور في ${c.moves} حركة. الصخرة بتتكسر لما تفرقع جنبها، وحتى حلوى لوحدها جنب صخرة ينفع تخبطها`;
    if (g.type === "bombs") return `فجّر ${g.n} ${g.n === 1 ? "قنبلة" : "قنابل"} في ${c.moves} حركة (مجموعة 6 أو أكتر بتعمل قنبلة)`;
  }
  return "";
}
function starRule(game) {
  return { speed: "3 نجوم: من غير ولا غلطة · نجمتين: غلطتين بالكتير",
    mem: "النجوم = القلوب اللي فاضلة معاك في الآخر",
    pop: "3 نجوم: يفضل معاك ربع الحركات تقريبًا أو أكتر",
    boss: "3 نجوم: من غير ولا غلطة في الأجزاء التلاتة" }[game];
}

const LEVELS = (() => {
  const out = [];
  for (const w of WORLDS) {
    const plan = PLAN[w.id].slice();
    for (let n = w.from; n <= w.to; n++) {
      const base = { n, world: w.id, xpStar: 10 + Math.floor(n / 10) * 2, xpFirst: 15 + Math.floor(n / 5) };
      if (n % 10 === 0) {
        const k = n / 10, parts = bossParts(k);
        out.push(Object.assign(base, { game: "boss", boss: true, parts, xpStar: base.xpStar * 2, xpFirst: base.xpFirst * 2,
          goal: `زعيم ${k}: 3 أجزاء ورا بعض. ${parts.map(p => GAME_NAMES[p.game]).join("، ثم ")}. لو خسرت جزء بتعيد من الأول.` }));
      } else {
        const spec = plan.shift();
        if (!spec) throw new Error("PLAN قصير في عالم " + w.id);
        out.push(Object.assign(base, { game: spec.game, cfg: spec.cfg, parts: [spec], goal: goalText(spec) }));
      }
    }
    if (plan.length) throw new Error("PLAN طويل في عالم " + w.id);
  }
  return out;
})();

// ألوان الزعيم والألعاب لما تتعرض
function partGoal(part) { return goalText(part); }
