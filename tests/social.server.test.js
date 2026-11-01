// اختبارات سيرفر المرحلة E (الهوية، الأصحاب، الترتيب، التخزين) من غير متصفح.
// التشغيل: node tests/social.server.test.js
const path = require("path"), fs = require("fs"), os = require("os"), http = require("http");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mal3ab-"));
process.env.DATA_FILE = path.join(tmp, "data.json");
const ROOT = path.join(__dirname, "..");
const { createSocial, fileStore, kvStore, SCORE_MAX, weekKey } = require(path.join(ROOT, "server", "social.js"));
const { server } = require(path.join(ROOT, "server", "server.js"));

let pass = 0, fail = 0;
const check = (c, n, x = "") => { if (c) { pass++; console.log("PASS ", n); } else { fail++; console.log("FAIL ", n, x); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hex = n => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const memStore = () => { let d = null; return { kind: "mem", async load() { return d && JSON.parse(d); }, async save(o) { d = JSON.stringify(o); }, raw: () => d }; };
const mk = (s, clock) => createSocial(s, { saveDelay: 0, now: clock });
const reg = (soc, name) => { const id = hex(16), secret = hex(32); const r = soc.auth({ id, secret, name }); return { id, secret, p: r.player, r }; };

(async () => {
  /* ---------- منطق الهوية والأصحاب والترتيب ---------- */
  const store = memStore(); let T = Date.UTC(2026, 9, 31, 12); // السبت
  const soc = mk(store, () => T); await soc.load();
  const a = reg(soc, "أحمد"), b = reg(soc, "منى"), c = reg(soc, "كريم");
  check(a.p && /^[A-Z2-9]{6}$/.test(a.p.code), "اللاعب الجديد بياخد كود صاحب من 6 حروف");
  check(new Set([a.p.code, b.p.code, c.p.code]).size === 3, "الأكواد مش بتتكرر");
  check(soc.auth({ id: a.id, secret: hex(32) }).error === "bad_auth", "سر غلط = رفض");
  check(soc.auth({ id: "xyz", secret: a.secret }).error === "bad_auth", "id بايظ = رفض");
  check(soc.auth({ id: a.id, secret: a.secret, name: "حد تاني" }).player.name === "أحمد", "الدخول تاني ما بيغيرش الاسم");
  check(!JSON.stringify(soc._db()).includes(a.secret), "السر نفسه ما بيتخزنش (hash بس)");

  check(soc.addFriend(a.p, a.p.code).error === "self", "ما تضيفش نفسك");
  check(soc.addFriend(a.p, "ZZZZZZ").error === "no_player", "كود مش موجود");
  let r = soc.addFriend(a.p, b.p.code);
  check(r.reply.ok === "sent" && r.notify[0] === b.id, "طلب صداقة بيتبعت والتاني يتبلّغ");
  check(soc.me(b.p).incoming.length === 1 && soc.me(b.p).incoming[0].code === a.p.code, "الطلب ظاهر عند منى باسم أحمد");
  check(soc.me(a.p).friends.length === 0, "لسه مش أصحاب قبل القبول");
  check(soc.addFriend(a.p, b.p.code).error === "pending", "طلب مكرر = pending");
  r = soc.accept(b.p, a.p.code);
  check(soc.me(a.p).friends[0].name === "منى" && soc.me(b.p).friends[0].name === "أحمد", "بعد القبول بقوا أصحاب عند الاتنين");
  check(soc.addFriend(a.p, b.p.code).error === "already", "صاحبك بالفعل");
  check(soc.accept(c.p, a.p.code).error === "no_request", "قبول من غير طلب = رفض");
  // لو كريم ضاف أحمد وأحمد كان ضاف كريم → قبول تلقائي
  soc.addFriend(a.p, c.p.code); r = soc.addFriend(c.p, a.p.code);
  check(soc.me(c.p).friends.some(f => f.name === "أحمد"), "طلبين متقابلين = صداقة على طول");
  soc.remove(c.p, a.p.code);
  check(!soc.me(a.p).friends.some(f => f.name === "كريم") && soc.me(c.p).friends.length === 0, "حذف صديق من الجهتين");
  soc.addFriend(c.p, a.p.code); soc.decline(a.p, c.p.code);
  check(soc.me(a.p).incoming.length === 0, "رفض طلب بيشيله");

  // النقط
  check(soc.submit(a.p, "pop", 1500).reply.best.pop === 1500, "نقط جديدة بتتسجل");
  soc.submit(a.p, "pop", 900);
  check(a.p.best.pop === 1500, "الأقل ما بيستبدلش الأحسن");
  check(soc.submit(a.p, "pop", -5).error === "bad_score" && soc.submit(a.p, "pop", 1e9).error === "bad_score" && soc.submit(a.p, "pop", "abc").error === "bad_score", "أرقام مستحيلة = رفض");
  check(soc.submit(a.p, "xx", 10).error === "bad_game", "لعبة مش موجودة = رفض");
  soc.submit(b.p, "pop", 4000); soc.submit(c.p, "pop", 100); soc.submit(c.p, "speed", 70);
  let bd = soc.board(a.p, "pop", "all").reply;
  check(bd.list.map(x => x.name).join() === "منى,أحمد,كريم" && bd.you.rank === 2 && bd.total === 3, "الترتيب العام صح ومكاني ظاهر");
  check(bd.list.find(x => x.me).name === "أحمد", "علامة «أنا» على صفّي");
  bd = soc.board(a.p, "pop", "friends").reply;
  check(bd.list.map(x => x.name).join() === "منى,أحمد", "ترتيب الأصحاب فيه أنا وأصحابي بس");
  check(!JSON.stringify(soc.board(a.p, "pop", "all").reply).includes(a.id) && !JSON.stringify(soc.me(b.p)).includes(a.id), "الـ id الخاص ما بيطلعش للتانيين");
  check(soc.board(a.p, "xx", "all").error === "bad_game", "لوحة لعبة غلط = رفض");
  // الأسبوعي بيتصفّر
  check(soc.board(a.p, "pop", "week").reply.list.length === 3, "الترتيب الأسبوعي فيه نقط الأسبوع ده");
  T += 8 * 864e5;
  bd = soc.board(a.p, "pop", "week").reply;
  check(bd.list.length === 0 && bd.you === null, "بعد أسبوع الترتيب الأسبوعي بيتصفّر");
  check(soc.board(a.p, "pop", "all").reply.list.length === 3, "والترتيب العام ما بيتأثرش");
  check(weekKey(Date.UTC(2026, 9, 31)) !== weekKey(Date.UTC(2026, 9, 30)), "الأسبوع بيبدأ السبت");
  // الاسم
  soc.setName(a.p, "  <b>أحمد</b>  طويييييييييييييييييييل  ");
  check(a.p.name.length <= 16 && !/[<>]/.test(a.p.name), "الاسم بيتنضف وبيتقص");
  // حد أقصى للتسجيل
  let busy = 0; for (let i = 0; i < 130; i++) if (soc.auth({ id: hex(16), secret: hex(32) }).error === "busy_reg") busy++;
  check(busy > 0, "حد أقصى لعدد الحسابات الجديدة في الوقت الواحد");

  /* ---------- مطالب Apple: فلتر الأسماء، البلاغ/الحظر، حذف الحساب ---------- */
  check(["شرموط", "يا عــــرص", "FUCK you", "f.u.c.k", "كــس امك", "Hitler"].every(n => soc.isBadName(n)), "فلتر الأسماء بيمسك الشتايم الشائعة (حتى بالتطويل والرموز)");
  check(!["أحمد", "كسبان", "سلمى", "Assem", "زبيدة", "Mona"].some(n => soc.isBadName(n)), "الأسماء العادية اللي فيها حروف شبه الشتايم بتعدّي");
  check(soc.auth({ id: hex(16), secret: hex(32), name: "شرموط" }).error === "bad_name", "تسجيل باسم مسيء = رفض");
  check(soc.setName(a.p, "عرص").error === "bad_name" && a.p.name !== "عرص", "تغيير الاسم لاسم مسيء = رفض");
  T += 3600e3; // نعدّي حد التسجيل المؤقت
  const d1 = reg(soc, "ديما"), d2 = reg(soc, "دياب"), d3 = reg(soc, "داليا"), d4 = reg(soc, "داود");
  soc.submit(d1.p, "pop", 300); soc.submit(d2.p, "pop", 200); soc.addFriend(d2.p, d1.p.code); soc.accept(d1.p, d2.p.code);
  check(soc.board(d3.p, "pop", "all").reply.list.some(r => r.code === d1.p.code), "اللوحة بتعرض كود الصاحب للاعبين التانيين (مش كودي أنا)");
  check(soc.board(d1.p, "pop", "all").reply.list.find(r => r.me).code === null, "صفّي ما فيهوش كود");
  r = soc.report(d1.p, d2.p.code);
  check(r.reply.ok === "reported" && soc.me(d1.p).friends.length === 0 && soc.me(d2.p).friends.length === 0, "البلاغ بيشيل الصداقة من الجهتين");
  check(!soc.board(d1.p, "pop", "all").reply.list.some(r => r.name === "دياب") && soc.board(d3.p, "pop", "all").reply.list.some(r => r.name === "دياب"), "اللي بلّغت عنه بيختفي عندي بس");
  check(soc.addFriend(d1.p, d2.p.code).error === "no_player" && soc.addFriend(d2.p, d1.p.code).error === "no_player", "ما ينفعش حد يضيف التاني بعد البلاغ");
  soc.report(d3.p, d2.p.code); soc.report(d4.p, d2.p.code);
  check(!soc.board(reg(soc, "غادة").p, "pop", "all").reply.list.some(r => r.name === "دياب"), "3 بلاغات من ناس مختلفة = بيختفي من الكل");
  check(soc.report(d1.p, "ZZZZZZ").error === "no_player" && soc.report(d1.p, d1.p.code).error === "no_player", "بلاغ عن كود غلط أو عن نفسي = رفض");
  soc.addFriend(d3.p, d1.p.code); soc.accept(d1.p, d3.p.code); soc.addFriend(d4.p, d1.p.code);
  const oldCode = d1.p.code; r = soc.deleteAccount(d1.p);
  check(!soc._db().players[d1.id] && r.notify.includes(d3.id), "حذف الحساب بيمسح اللاعب وبيبلّغ أصحابه");
  check(soc.me(d3.p).friends.length === 0 && soc.me(d4.p).incoming.length === 0 && soc.addFriend(d4.p, oldCode).error === "no_player", "وبيتشال من الأصحاب والطلبات والكود بيتلغي");
  check(!JSON.stringify(soc._db()).includes(d1.id) && !JSON.stringify(soc._db()).includes(oldCode), "مفيش أي أثر للحساب المحذوف في البيانات");
  check(soc.board(a.p, "pop", "all").reply.list.every(x => x.name !== "ديما"), "ومش في الترتيب");

  /* ---------- التخزين ---------- */
  await soc.flush();
  const soc2 = mk(store, () => T); await soc2.load();
  check(soc2.playersCount === soc.playersCount && soc2.auth({ id: a.id, secret: a.secret }).player.best.pop === 1500, "البيانات بترجع بعد إعادة تشغيل (تخزين تجريبي)");
  const f = path.join(tmp, "x.json"), fs1 = mk(fileStore(f), () => T); await fs1.load();
  const z = reg(fs1, "زياد"); fs1.submit(z.p, "mem", 300); await fs1.flush();
  const fs2 = mk(fileStore(f), () => T); await fs2.load();
  check(fs2.auth({ id: z.id, secret: z.secret }).player.best.mem === 300 && !fs.existsSync(f + ".tmp"), "التخزين في ملف شغال");
  fs.writeFileSync(f, "{ مش JSON");
  const fs3 = mk(fileStore(f), () => T); await fs3.load();
  check(fs3.playersCount === 0, "ملف بايظ = بداية فاضية من غير كراش");

  // Upstash-like KV على سيرفر وهمي (الخدمة الحقيقية لسه ما اتجرّبتش)
  const kv = {}; const log = [];
  const fake = http.createServer((req, res) => { let b = ""; req.on("data", d => b += d); req.on("end", () => {
    log.push(req.headers.authorization); const cmd = JSON.parse(b);
    if (req.headers.authorization !== "Bearer tok") { res.writeHead(401); return res.end("{}"); }
    if (cmd[0] === "SET") { kv[cmd[1]] = cmd[2]; res.end(JSON.stringify({ result: "OK" })); } else res.end(JSON.stringify({ result: kv[cmd[1]] || null }));
  }); });
  await new Promise(r => fake.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + fake.address().port;
  const k1 = mk(kvStore(url, "tok"), () => T); await k1.load();
  const y = reg(k1, "ياسمين"); k1.submit(y.p, "word", 800); await k1.flush();
  const k2 = mk(kvStore(url, "tok"), () => T); await k2.load();
  check(k2.auth({ id: y.id, secret: y.secret }).player.best.word === 800, "التخزين عن بُعد (KV) بيحفظ ويرجّع");
  const k3 = mk(kvStore(url, "غلط"), () => T); await k3.load();
  check(k3.playersCount === 0 && !!k3.lastError, "توكن غلط = خطأ ظاهر من غير كراش");
  fake.close();

  /* ---------- على السيرفر الحقيقي عن طريق WebSocket ---------- */
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const client = () => new Promise(res => { const ws = new WebSocket("ws://127.0.0.1:" + port); ws.q = []; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.t === "hello") res(ws); else ws.q.push(m); }; });
  const next = async (ws, t, ms = 2000) => { const end = Date.now() + ms; while (Date.now() < end) { const i = ws.q.findIndex(m => m.t === t); if (i >= 0) return ws.q.splice(i, 1)[0]; await sleep(15); } return null; };
  const w1 = await client(), w2 = await client();
  const u1 = { id: hex(16), secret: hex(32) }, u2 = { id: hex(16), secret: hex(32) };
  w1.send(JSON.stringify({ t: "s_auth", ...u1, name: "علي" })); w2.send(JSON.stringify({ t: "s_auth", ...u2, name: "سلمى" }));
  const m1 = await next(w1, "me"), m2 = await next(w2, "me");
  check(m1 && m2 && m1.code.length === 6, "WS: تسجيل لاعبين");
  w1.send(JSON.stringify({ t: "s_add", code: m2.code }));
  check((await next(w1, "me")).ok === "sent", "WS: إرسال طلب");
  const push = await next(w2, "me");
  check(push && push.incoming.length === 1 && push.incoming[0].name === "علي", "WS: سلمى بتشوف الطلب لايف من غير ما تعمل refresh");
  w2.send(JSON.stringify({ t: "s_accept", code: m1.code })); await next(w2, "me");
  const push2 = await next(w1, "me");
  check(push2 && push2.friends.length === 1 && push2.friends[0].name === "سلمى", "WS: علي بيعرف إن سلمى قبلت");
  w2.send(JSON.stringify({ t: "s_submit", game: "speed", score: 55 }));
  await next(w2, "me"); const push3 = await next(w1, "me");
  check(push3 && push3.friends[0].best.speed === 55, "WS: نقط الصاحب بتظهر لايف");
  w1.send(JSON.stringify({ t: "s_board", game: "speed", scope: "friends" }));
  const board = await next(w1, "board");
  check(board && board.list.length === 1 && board.list[0].name === "سلمى", "WS: لوحة الأصحاب");
  const w3 = await client(); w3.send(JSON.stringify({ t: "s_board", game: "speed", scope: "all" }));
  check((await next(w3, "s_error")).code === "no_auth", "WS: من غير تسجيل دخول = رفض");
  w3.send(JSON.stringify({ t: "s_auth", id: u1.id, secret: hex(32) }));
  check((await next(w3, "s_error")).code === "bad_auth", "WS: سر غلط لحساب موجود = رفض");
  const health = await fetch("http://127.0.0.1:" + port + "/").then(r => r.json());
  check(health.players >= 2 && health.store === "file" && !JSON.stringify(health).includes(u1.id), "صفحة الصحة بتعرض العدد من غير بيانات خاصة");
  w1.send(JSON.stringify({ t: "s_delete" }));
  check(!!(await next(w1, "deleted")), "WS: حذف الحساب");
  w1.send(JSON.stringify({ t: "s_board", game: "speed", scope: "all" }));
  check((await next(w1, "s_error")).code === "no_auth", "WS: بعد الحذف الاتصال مبقاش مسجّل");
  const push4 = await next(w2, "me");
  check(push4 && push4.friends.length === 0, "WS: سلمى بتشوف إن علي اتشال من أصحابها");
  [w1, w2, w3].forEach(w => w.close());
  await sleep(100);
  server.close();

  console.log(`\n=== المرحلة E (سيرفر): ${pass} نجح، ${fail} فشل ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
