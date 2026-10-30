/* miniws.js — WebSocket سيرفر صغير من غير أي مكتبات (Node بس).
   بيدعم اللي اللعبة محتاجاه: رسايل نصية صغيرة، ping/pong، والقفل. الرسايل المقطّعة (fragmented) والكبيرة بتتقفل.
   الواجهة شبه مكتبة ws: new WebSocketServer({ server, maxPayload }) و on("connection", ws => ws.on("message"|"close"|"pong")). */
"use strict";
const crypto = require("crypto");
const { EventEmitter } = require("events");
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

class Socket extends EventEmitter {
  constructor(sock, maxPayload) {
    super();
    this.sock = sock; this.maxPayload = maxPayload; this.readyState = 1; this.buf = Buffer.alloc(0);
    sock.setNoDelay(true);
    sock.on("data", d => this.onData(d));
    sock.on("close", () => this.finish());
    sock.on("error", e => { this.emit("error", e); this.finish(); });
  }
  finish() { if (this.readyState === 3) return; this.readyState = 3; this.emit("close"); }
  frame(op, payload = Buffer.alloc(0)) {
    const n = payload.length;
    const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : null;
    if (!head) return;
    try { this.sock.write(Buffer.concat([head, payload])); } catch (e) {}
  }
  send(text) { if (this.readyState === 1) this.frame(1, Buffer.from(String(text), "utf8")); }
  ping() { if (this.readyState === 1) this.frame(9); }
  close() { if (this.readyState !== 1) return; this.frame(8); this.readyState = 2; setTimeout(() => this.terminate(), 500); }
  terminate() { try { this.sock.destroy(); } catch (e) {} this.finish(); }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { return this.terminate(); } // رسايل ضخمة: مرفوضة
      if (!masked || !fin || len > this.maxPayload) return this.terminate(); // الكلاينت لازم يعمل mask، ومفيش تقطيع
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4), data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      if (op === 1) this.emit("message", data.toString("utf8"));
      else if (op === 8) { this.frame(8); this.terminate(); return; }
      else if (op === 9) this.frame(10, data);
      else if (op === 10) this.emit("pong");
      else if (op === 2) { /* binary: مش محتاجينه */ }
      else return this.terminate();
    }
  }
}

class WebSocketServer extends EventEmitter {
  constructor({ server, maxPayload = 1024 }) {
    super();
    this.clients = new Set();
    server.on("upgrade", (req, sock) => {
      const key = req.headers["sec-websocket-key"];
      if (!key || String(req.headers.upgrade).toLowerCase() !== "websocket") { sock.destroy(); return; }
      const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
      sock.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
      const ws = new Socket(sock, maxPayload);
      this.clients.add(ws); ws.on("close", () => this.clients.delete(ws));
      this.emit("connection", ws, req);
    });
    server.on("close", () => this.emit("close"));
  }
}
module.exports = { WebSocketServer };
