/* social.js — المرحلة E: هوية اللاعب، الأصحاب، ولوحة الترتيب.
   مفيش إيميل ولا كلمة سر: كل جهاز بيعمل id وسر عشوائي، والسيرفر بيحتفظ بـ hash للسر بس.
   معنى كده: لو مسحت بيانات المتصفح أو غيّرت الجهاز بتفقد حسابك (مفيش استرجاع).
   النقط بيبعتها جهاز اللاعب، فالترتيب للمتعة مش مسابقة جدّية. السيرفر بيرفض الأرقام المستحيلة بس.
   التخزين: ملف JSON (بيتمسح لما Render المجاني يعيد التشغيل) أو Upstash Redis لو KV_URL وKV_TOKEN متحطين (بيفضل). */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// أقصى نقط معقولة لكل لعبة (لازم تفضل أعلى من أي نتيجة حقيقية)
const SCORE_MAX = { speed: 5000, word: 5000, pop: 200000, mem: 50000 };
const LIMITS = { hideAfterReports: 3, regsPer10Min: 120, players: 5000, friends: 50, incoming: 30, top: 20 };

const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const cleanName = n => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "لاعب";
// فلتر أسماء بسيط للكلام المسيء (مش كامل: بيمسك الشائع بس، والباقي بيتعالج بالبلاغ والحظر)
const norm = t => String(t).toLowerCase().replace(/[\u064b-\u065f\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/(.)\1+/g, "$1").replace(/[^a-z0-9\u0621-\u064a ]/g, "");
const BAD_SUB = ["شرموط", "منيوك", "منيك", "كسمك", "كس امك", "كس اختك", "معرص", "قحبه", "ابن الكلب", "ابن الوسخه", "ابن المتناكه", "متناك", "fuck", "shit", "bitch", "cunt", "nigg", "porn", "rape", "nazi", "hitler"].map(norm);
const BAD_WORD = ["عرص", "خول", "زب", "طيز", "كس", "dick", "ass", "sex", "سكس"].map(norm);
const isBadName = n => { const t = norm(n); return BAD_SUB.some(w => t.includes(w)) || t.split(" ").some(w => BAD_WORD.includes(w)); };
const okId = s => typeof s === "string" && /^[a-f0-9]{16}$/.test(s);
const okSecret = s => typeof s === "string" && /^[a-f0-9]{32}$/.test(s);
// رقم الأسبوع (بيبدأ السبت زي أسبوع مصر) — الترتيب الأسبوعي بيتصفّر لوحده
function weekKey(t) { const d = new Date(t), day = (d.getUTCDay() + 1) % 7; return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 864e5 - day + 3) / 7); }

/* ---------- التخزين ---------- */
function fileStore(file) {
  return {
    kind: "file",
    async load() { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; } },
    async save(obj) { const tmp = file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, file); },
  };
}
function kvStore(url, token, key = "mal3ab") {
  const call = async cmd => {
    const r = await fetch(url, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(cmd) });
    if (!r.ok) throw new Error("kv " + r.status);
    return (await r.json()).result;
  };
  return {
    kind: "kv",
    async load() { const v = await call(["GET", key]); return v ? JSON.parse(v) : null; },
    async save(obj) { await call(["SET", key, JSON.stringify(obj)]); },
  };
}
function pickStore(env = process.env) {
  if (env.KV_URL && env.KV_TOKEN) return kvStore(env.KV_URL, env.KV_TOKEN);
  return fileStore(env.DATA_FILE || path.join(__dirname, "data.json"));
}

/* ---------- البيانات ---------- */
function createSocial(store, opts = {}) {
  const clock = opts.now || Date.now;
  let db = { players: {} };       // id -> player
  const byCode = new Map();        // friend code -> id
  let regs = [], dirty = false, saving = false, timer = null, lastError = "";

  function index() { byCode.clear(); for (const p of Object.values(db.players)) byCode.set(p.code, p.id); }
  async function load() {
    try { const d = await store.load(); if (d && d.players) db = d; lastError = ""; } catch (e) { lastError = String(e.message || e); }
    index();
  }
  function touch() { dirty = true; if (!timer) timer = setTimeout(flush, opts.saveDelay != null ? opts.saveDelay : 3000); }
  async function flush() {
    timer = null; if (!dirty || saving) return;
    saving = true; dirty = false;
    try { await store.save(db); lastError = ""; } catch (e) { dirty = true; lastError = String(e.message || e); }
    saving = false;
    if (dirty && !timer) timer = setTimeout(flush, 10000);
  }

  function newCode() { let c; do { c = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join(""); } while (byCode.has(c)); return c; }
  const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  // تسجيل الدخول: أول مرة بيعمل لاعب جديد، بعد كده لازم السر يطابق
  function auth(m) {
    if (!okId(m.id) || !okSecret(m.secret)) return { error: "bad_auth" };
    let p = db.players[m.id];
    if (!p) {
      if (isBadName(m.name)) return { error: "bad_name" };
      if (Object.keys(db.players).length >= LIMITS.players) return { error: "full" };
      const t = clock(); regs = regs.filter(x => t - x < 10 * 60 * 1000);
      if (regs.length >= LIMITS.regsPer10Min) return { error: "busy_reg" }; // حماية من إنشاء حسابات بالجملة
      regs.push(t);
      p = db.players[m.id] = { id: m.id, hash: sha(m.secret), code: newCode(), name: cleanName(m.name), created: clock(), best: {}, week: { k: weekKey(clock()), best: {} }, friends: [], incoming: [], blocked: [], reports: [] };
      byCode.set(p.code, p.id); touch();
    } else if (p.hash !== sha(m.secret)) return { error: "bad_auth" };
    return { player: p };
  }
  const rolled = p => { const k = weekKey(clock()); if (p.week.k !== k) { p.week = { k, best: {} }; touch(); } return p.week.best; };
  const pub = p => ({ code: p.code, name: p.name, best: p.best, week: rolled(p) });

  function me(p) {
    return {
      t: "me", code: p.code, name: p.name, best: p.best, week: rolled(p),
      friends: p.friends.map(id => db.players[id]).filter(q => q && !hiddenFor(p, q)).map(pub),
      incoming: p.incoming.map(id => db.players[id]).filter(q => q && !hiddenFor(p, q)).map(q => ({ code: q.code, name: q.name })),
    };
  }

  /* كل عملية بترجّع { reply, notify:[ids] } والسيرفر بيبعت */
  function setName(p, name) {
    if (isBadName(name)) return { error: "bad_name" };
    p.name = cleanName(name); touch(); return { reply: me(p), notify: [...p.friends] }; }
  function addFriend(p, code) {
    const q = db.players[byCode.get(normCode(code))];
    if (!q || hiddenFor(p, q)) return { error: "no_player" };
    if (q.id === p.id) return { error: "self" };
    if (p.friends.includes(q.id)) return { error: "already" };
    if (p.incoming.includes(q.id)) return accept(p, q.code); // هو كان باعتلي، فالإضافة بتبقى قبول
    if (q.incoming.includes(p.id)) return { error: "pending" };
    if (p.friends.length >= LIMITS.friends) return { error: "too_many" };
    if (q.incoming.length >= LIMITS.incoming) return { error: "busy" };
    q.incoming.push(p.id); touch();
    return { reply: Object.assign(me(p), { ok: "sent" }), notify: [q.id] };
  }
  function accept(p, code) {
    const q = db.players[byCode.get(normCode(code))];
    if (!q || !p.incoming.includes(q.id)) return { error: "no_request" };
    if (p.friends.length >= LIMITS.friends || q.friends.length >= LIMITS.friends) return { error: "too_many" };
    p.incoming = p.incoming.filter(i => i !== q.id);
    if (!p.friends.includes(q.id)) p.friends.push(q.id);
    if (!q.friends.includes(p.id)) q.friends.push(p.id);
    q.incoming = q.incoming.filter(i => i !== p.id); touch();
    return { reply: me(p), notify: [q.id] };
  }
  function decline(p, code) {
    const q = db.players[byCode.get(normCode(code))];
    if (q) { p.incoming = p.incoming.filter(i => i !== q.id); touch(); }
    return { reply: me(p), notify: [] };
  }
  function remove(p, code) {
    const q = db.players[byCode.get(normCode(code))];
    if (q) { p.friends = p.friends.filter(i => i !== q.id); q.friends = q.friends.filter(i => i !== p.id); touch(); }
    return { reply: me(p), notify: q ? [q.id] : [] };
  }
  // حذف الحساب نهائيًا (مطلب Apple 5.1.1(v)): بيتمسح من كل مكان
  function deleteAccount(p) {
    const ids = [...p.friends];
    for (const q of Object.values(db.players)) {
      q.friends = q.friends.filter(i => i !== p.id); q.incoming = q.incoming.filter(i => i !== p.id);
      q.blocked = (q.blocked || []).filter(i => i !== p.id); q.reports = (q.reports || []).filter(i => i !== p.id);
    }
    byCode.delete(p.code); delete db.players[p.id]; touch();
    return { reply: { t: "deleted" }, notify: ids };
  }
  // بلاغ = حظر: اللاعب ده بيختفي من عندك (ترتيب وأصحاب)، ولو 3 لاعبين مختلفين بلّغوا عنه بيختفي من الكل
  function report(p, code) {
    const q = db.players[byCode.get(normCode(code))];
    if (!q || q.id === p.id) return { error: "no_player" };
    p.blocked = p.blocked || []; q.reports = q.reports || [];
    if (!p.blocked.includes(q.id)) p.blocked.push(q.id);
    if (!q.reports.includes(p.id)) q.reports.push(p.id);
    p.friends = p.friends.filter(i => i !== q.id); q.friends = q.friends.filter(i => i !== p.id);
    p.incoming = p.incoming.filter(i => i !== q.id); q.incoming = q.incoming.filter(i => i !== p.id); touch();
    console.log("report:", q.id.slice(0, 4), "by", p.id.slice(0, 4), "total", q.reports.length);
    return { reply: Object.assign(me(p), { ok: "reported" }), notify: [q.id] };
  }
  const hiddenFor = (p, q) => (p.blocked || []).includes(q.id) || (q.blocked || []).includes(p.id) || (q.reports || []).length >= LIMITS.hideAfterReports;
  function submit(p, game, score) {
    const max = SCORE_MAX[game], v = Math.floor(+score);
    if (!max) return { error: "bad_game" };
    if (!(v >= 0 && v <= max)) return { error: "bad_score" };
    const wk = rolled(p);
    let changed = false;
    if (v > (p.best[game] || 0)) { p.best[game] = v; changed = true; }
    if (v > (wk[game] || 0)) { wk[game] = v; changed = true; }
    if (changed) touch();
    return { reply: me(p), notify: changed ? [...p.friends] : [] };
  }
  // scope: all | week | friends
  function board(p, game, scope) {
    if (!SCORE_MAX[game]) return { error: "bad_game" };
    let pool = Object.values(db.players);
    if (scope === "friends") { const ids = new Set([p.id, ...p.friends]); pool = pool.filter(q => ids.has(q.id)); }
    pool = pool.filter(q => q.id === p.id || !hiddenFor(p, q));
    const val = q => (scope === "week" ? rolled(q)[game] : q.best[game]) || 0;
    const rows = pool.map(q => ({ q, v: val(q) })).filter(r => r.v > 0).sort((a, b) => b.v - a.v || a.q.created - b.q.created);
    const list = rows.slice(0, LIMITS.top).map((r, i) => ({ rank: i + 1, name: r.q.name, code: r.q.id === p.id ? null : r.q.code, score: r.v, me: r.q.id === p.id }));
    const at = rows.findIndex(r => r.q.id === p.id);
    return { reply: { t: "board", game, scope, list, you: at < 0 ? null : { rank: at + 1, score: rows[at].v }, total: rows.length } };
  }

  return {
    load, flush, auth, me, setName, addFriend, accept, decline, remove, submit, board, deleteAccount, report, isBadName,
    get playersCount() { return Object.keys(db.players).length; },
    get storeKind() { return store.kind; }, get lastError() { return lastError; },
    _db: () => db,
  };
}

module.exports = { createSocial, pickStore, fileStore, kvStore, SCORE_MAX, LIMITS, weekKey };
