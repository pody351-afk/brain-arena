/* سيرفر «ملعب المخ» للعب الأونلاين (المرحلة D).
   أوضة لاتنين بكود من 4 حروف. السيرفر بيبدأ الماتش للاتنين في نفس الوقت، وبينقل النقط لايف، ويعلن النتيجة.
   مفيش حسابات ولا كلمات سر ولا قاعدة بيانات: كل حاجة في الذاكرة، ولو السيرفر اتقفل الأوض بتتمسح.
   حدود معروفة: النقط بيبعتها جهاز اللاعب نفسه، فاللي يعدّل الكود يقدر يغش. السيرفر بيرفض الأرقام المستحيلة بس.
   التشغيل: npm install && node server.js   (PORT من متغيّر البيئة، الافتراضي 8787) */
"use strict";
const http = require("http");
const { WebSocketServer } = require("./miniws"); // من غير مكتبات خارجية
const { createSocial, pickStore } = require("./social");

const PORT = +process.env.PORT || 8787;
const GAMES = { word: { secs: 90, maxScore: 5000 }, speed: { secs: 45, maxScore: 5000 } }; // لازم يطابق js/online.js
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // من غير الحروف اللي بتتلخبط (O/0، I/1، L)
const MAX_ROOMS = 2000, ROOM_TTL = 2 * 60 * 60 * 1000;
const rooms = new Map();
const stats = { started: Date.now(), matches: 0 };
const social = createSocial(pickStore());
const online = new Map(); // id لاعب -> اتصالاته (عشان نبعتله لما حد يضيفه)
const socialReady = social.load();

const now = () => Date.now();
const cleanName = n => String(n || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || "لاعب";
function newCode() { let c; do { c = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join(""); } while (rooms.has(c)); return c; }
function send(ws, msg) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function other(room, ws) { return room.players.find(p => p && p !== ws); }
function idx(room, ws) { return room.players.indexOf(ws); }

function startMatch(room) {
  room.state = "play"; room.seed = Math.floor(Math.random() * 2 ** 31); room.scores = [0, 0]; room.done = [null, null]; room.again = [false, false];
  room.startedAt = now(); stats.matches++;
  const startsIn = 3500; // العد التنازلي 3-2-1 عند الاتنين
  room.players.forEach((p, i) => send(p, { t: "start", seed: room.seed, game: room.game, you: i, names: room.names, startsIn }));
  clearTimeout(room.timer);
  room.timer = setTimeout(() => finishMatch(room, "time"), startsIn + GAMES[room.game].secs * 1000 + 8000); // لو جهاز ما بعتش النتيجة
}
function finishMatch(room, why) {
  if (room.state !== "play") return;
  clearTimeout(room.timer); room.state = "over";
  const s = room.done.map((d, i) => (d ? d.score : room.scores[i]));
  const winner = s[0] === s[1] ? -1 : s[0] > s[1] ? 0 : 1;
  room.players.forEach(p => send(p, { t: "result", scores: s, winner, names: room.names, why }));
}
function leave(ws) {
  const room = ws.room; if (!room) return;
  ws.room = null;
  const i = idx(room, ws); if (i >= 0) room.players[i] = null;
  const o = other(room, ws);
  if (o) { send(o, { t: "left", name: room.names[i] }); if (room.state === "play") { clearTimeout(room.timer); room.state = "over"; } }
  if (!room.players.some(Boolean)) { clearTimeout(room.timer); rooms.delete(room.code); }
  else if (room.state !== "play") { room.state = "wait"; } // اللي فضل يقدر يستنى حد جديد بنفس الكود
}

function pushMe(id) {
  const set = online.get(id); if (!set) return;
  const p = social._db().players[id]; if (!p) return;
  for (const w of set) send(w, social.me(p));
}
async function socialMessage(ws, m) {
  await socialReady;
  if (m.t === "s_auth") {
    const r = social.auth(m);
    if (r.error) return send(ws, { t: "s_error", code: r.error });
    ws.pid = r.player.id;
    if (!online.has(ws.pid)) online.set(ws.pid, new Set());
    online.get(ws.pid).add(ws);
    return send(ws, social.me(r.player));
  }
  const p = ws.pid && social._db().players[ws.pid];
  if (!p) return send(ws, { t: "s_error", code: "no_auth" });
  let r;
  if (m.t === "s_name") r = social.setName(p, m.name);
  else if (m.t === "s_add") r = social.addFriend(p, m.code);
  else if (m.t === "s_accept") r = social.accept(p, m.code);
  else if (m.t === "s_decline") r = social.decline(p, m.code);
  else if (m.t === "s_remove") r = social.remove(p, m.code);
  else if (m.t === "s_submit") r = social.submit(p, m.game, m.score);
  else if (m.t === "s_board") r = social.board(p, m.game, m.scope);
  else if (m.t === "s_report") r = social.report(p, m.code);
  else if (m.t === "s_delete") { r = social.deleteAccount(p); const set = online.get(ws.pid); online.delete(ws.pid); ws.pid = null; send(ws, r.reply); (r.notify || []).forEach(pushMe); if (set) for (const w of set) w.pid = null; return; }
  else if (m.t === "s_me") r = { reply: social.me(p) };
  else return;
  if (r.error) return send(ws, { t: "s_error", code: r.error });
  send(ws, r.reply);
  (r.notify || []).forEach(pushMe);
}

function onMessage(ws, raw) {
  // حماية بسيطة من الرسايل الكتير: 30 رسالة في الثانية بالكتير
  const t = now(); if (t - ws.win > 1000) { ws.win = t; ws.count = 0; } if (++ws.count > 30) return;
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  if (!m || typeof m.t !== "string") return;
  if (m.t.startsWith("s_")) return socialMessage(ws, m);
  const room = ws.room;

  if (m.t === "create") {
    if (room) leave(ws);
    if (!GAMES[m.game]) return send(ws, { t: "error", code: "bad_game" });
    if (rooms.size >= MAX_ROOMS) return send(ws, { t: "error", code: "full_server" });
    const r = { code: newCode(), game: m.game, v: String(m.v || ""), players: [ws, null], names: [cleanName(m.name), ""], state: "wait", created: now(), timer: null };
    rooms.set(r.code, r); ws.room = r;
    return send(ws, { t: "room", code: r.code, game: r.game, you: 0 });
  }
  if (m.t === "join") {
    const r = rooms.get(String(m.code || "").toUpperCase().trim());
    if (!r) return send(ws, { t: "error", code: "no_room" });
    if (r === room) return;
    if (r.players[0] && r.players[1]) return send(ws, { t: "error", code: "room_full" });
    if (r.v && String(m.v || "") !== r.v) return send(ws, { t: "error", code: "version" });
    if (room) leave(ws);
    const i = r.players[0] ? 1 : 0;
    r.players[i] = ws; r.names[i] = cleanName(m.name); ws.room = r;
    send(ws, { t: "room", code: r.code, game: r.game, you: i });
    send(other(r, ws), { t: "peer", name: r.names[i] });
    return startMatch(r);
  }
  if (!room) return;
  const i = idx(room, ws);
  if (m.t === "score" && room.state === "play") {
    const v = Math.floor(+m.v);
    if (!(v >= 0 && v <= GAMES[room.game].maxScore) || v < room.scores[i]) return; // النقط ما بتقلّش ومفيش أرقام مستحيلة
    room.scores[i] = v;
    return send(other(room, ws), { t: "opp", v });
  }
  if (m.t === "done" && room.state === "play" && !room.done[i]) {
    const v = Math.floor(+m.score);
    room.done[i] = { score: v >= 0 && v <= GAMES[room.game].maxScore ? Math.max(v, room.scores[i]) : room.scores[i], all: !!m.all };
    room.scores[i] = room.done[i].score;
    const o = other(room, ws);
    if (m.all && o && !room.done[1 - i]) send(o, { t: "stop" }); // في الكلمات: لو حد خلّص اللغز كله، الماتش بيخلص للاتنين
    send(o, { t: "opp", v: room.scores[i], done: true });
    if (room.done.every(Boolean)) finishMatch(room, "done");
    return;
  }
  if (m.t === "again" && room.state === "over") {
    room.again[i] = true;
    send(other(room, ws), { t: "again" });
    if (room.players.every(Boolean) && room.again.every(Boolean)) startMatch(room);
    return;
  }
  if (m.t === "leave") return leave(ws);
}

const server = http.createServer((req, res) => {
  // صفحة صغيرة للتأكد إن السيرفر شغال (وRender بيستخدمها)
  res.writeHead(200, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  res.end(JSON.stringify({ ok: true, name: "mal3ab-server", rooms: rooms.size, matches: stats.matches, players: social.playersCount, store: social.storeKind, storeError: social.lastError || undefined, upMinutes: Math.round((now() - stats.started) / 60000) }));
});
const wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on("connection", ws => {
  ws.alive = true; ws.win = now(); ws.count = 0; ws.room = null;
  ws.on("pong", () => { ws.alive = true; });
  ws.on("message", raw => onMessage(ws, raw));
  ws.on("close", () => { leave(ws); if (ws.pid) { const s = online.get(ws.pid); if (s) { s.delete(ws); if (!s.size) online.delete(ws.pid); } } });
  ws.on("error", () => {});
  send(ws, { t: "hello" });
});
// نقفل الاتصالات الميتة، ونمسح الأوض القديمة
const beat = setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.alive) return ws.terminate(); ws.alive = false; try { ws.ping(); } catch (e) {} });
  for (const [c, r] of rooms) if (now() - r.created > ROOM_TTL) { r.players.forEach(p => p && p.close()); clearTimeout(r.timer); rooms.delete(c); }
}, 25000);
wss.on("close", () => clearInterval(beat));

if (require.main === module) server.listen(PORT, () => console.log("mal3ab-server on :" + PORT));
// نحفظ البيانات قبل ما السيرفر يقفل
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, async () => { try { await social.flush(); } catch (e) {} process.exit(0); });
module.exports = { server, wss, rooms, GAMES, get social() { return social; } };
