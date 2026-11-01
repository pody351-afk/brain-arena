/* core.js — أدوات مشتركة: تخزين، إعدادات، صوت، اهتزاز، مؤثرات، شريط اللعب (HUD). */
"use strict";
const $ = s => document.querySelector(s);
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// اسم لاعب: ما بيتترجمش في وضع الإنجليزي
const nm = t => `<span translate="no">${esc(t)}</span>`;
const esc = t => String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

// التخزين المحلي على جهاز اللاعب. ممكن يكون مقفول (وضع التصفح الخاص)، فكل حاجة جوّه try/catch.
const store = {
  get(k, d) { try { const v = localStorage.getItem("mal3ab_" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("mal3ab_" + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- الإعدادات ---------- */
const Settings = {
  data: null,
  load() {
    const d = store.get("settings", null);
    const legacySound = store.get("sound", true); // من النسخة الأولى
    this.data = Object.assign({ sound: legacySound !== false, vibrate: true }, d && typeof d === "object" ? d : {});
    return this.data;
  },
  set(k, v) { this.data[k] = v; store.set("settings", this.data); }
};
Settings.load();

/* ---------- الصوت (متولّد بالكود: مفيش ملفات ولا تراخيص) ---------- */
let actx = null;
function ensureAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === "suspended") actx.resume();
}
function tone(f, d = 0.12, type = "sine", v = 0.15, slide = 0) {
  if (!Settings.data.sound || !actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02);
}
const sfx = {
  good(c = 0) { tone(520 + c * 35, 0.09, "triangle", 0.18); setTimeout(() => tone(780 + c * 35, 0.11, "triangle", 0.14), 55); },
  bad() { tone(190, 0.28, "sawtooth", 0.11, -90); },
  pop(n) { tone(260 + Math.min(n, 16) * 55, 0.1, "square", 0.07, 260); },
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, "triangle", 0.16), i * 90)); },
  cheer() { [784, 988, 1175].forEach((f, i) => setTimeout(() => tone(f, 0.12, "triangle", 0.14), i * 70)); },
  over() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, "triangle", 0.15), i * 150)); },
  blip() { tone(660, 0.05, "sine", 0.08); },
  boom() { tone(90, 0.35, "sawtooth", 0.16, -40); },
  note(i) { tone([392, 440, 494, 523, 587, 659, 698, 784, 880][i % 9], 0.18, "triangle", 0.14); }
};
function buzz(p) { if (!Settings.data.vibrate) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
// الكيبورد: Enter/Space على زرار بيعمل click بـ detail = 0. اللمس والماوس بيتعاملوا مع pointerdown بس، فمفيش حساب مرتين.
function onKeyActivate(el, fn) { el.addEventListener("click", e => { if (e.detail === 0) fn(); }); }
function onTap(el, fn) { el.addEventListener("pointerdown", e => { e.preventDefault(); fn(e); }); onKeyActivate(el, fn); }

/* ---------- المؤثرات ---------- */
const fx = $("#fx"), fctx = fx.getContext("2d");
let parts = [], fxRunning = false;
function sizeFx() { const d = devicePixelRatio || 1; fx.width = innerWidth * d; fx.height = innerHeight * d; fctx.setTransform(d, 0, 0, d, 0, 0); }
addEventListener("resize", sizeFx); sizeFx();
function burst(x, y, color, n = 14) {
  if (reduceMotion) return;
  if (parts.length > 400) return; // حد أقصى عشان الأجهزة الضعيفة
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, color, r: 3 + Math.random() * 4 });
  }
  if (!fxRunning) { fxRunning = true; requestAnimationFrame(fxLoop); }
}
function fxLoop() {
  fctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life -= 0.028;
    fctx.globalAlpha = Math.max(p.life, 0); fctx.fillStyle = p.color;
    fctx.beginPath(); fctx.arc(p.x, p.y, p.r * p.life + 1, 0, 7); fctx.fill();
  }
  fctx.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(fxLoop); else { fxRunning = false; fctx.clearRect(0, 0, innerWidth, innerHeight); }
}
function floatText(x, y, text, cls = "") {
  const el = document.createElement("div");
  el.className = "float " + cls; el.textContent = text;
  el.style.left = x + "px"; el.style.top = y + "px";
  document.body.appendChild(el); setTimeout(() => el.remove(), 900);
}
function centerOf(el) { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }
function toast(t) { document.querySelectorAll(".toast").forEach(e => e.remove()); const el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el); setTimeout(() => el.remove(), 1800); }

/* ---------- شريط اللعب ---------- */
const ui = { play: $("#play"), stage: $("#stage"), score: $("#hudScore"), info: $("#hudInfo"),
  bar: $("#hudBar"), barWrap: $("#barWrap"), title: $("#hudTitle"), over: $("#over") };
const hud = { offset: 0, value: 0 }; // offset: في مراحل الزعيم النقط بتتجمع من كذا جزء
let scoreNow = 0;
function setScore(v) { hud.value = v; scoreNow = v + hud.offset; ui.score.textContent = scoreNow; ui.score.classList.remove("bump"); void ui.score.offsetWidth; ui.score.classList.add("bump"); }
function resetScore() { hud.value = 0; scoreNow = hud.offset; ui.score.textContent = scoreNow; }
function setInfo(html) { ui.info.innerHTML = html; }
function setBar(frac, show = true) { ui.barWrap.hidden = !show; const f = Math.max(0, Math.min(1, frac)); ui.bar.style.transform = `scaleX(${f})`; ui.bar.classList.toggle("low", show && f < 0.25); }
function screenCenter() { const r = ui.stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.4]; }
function shake() { ui.stage.classList.remove("shake"); void ui.stage.offsetWidth; ui.stage.classList.add("shake"); }
const STAR_SVG = n => [0, 1, 2].map(i => `<i class="star${i < n ? " on" : ""}"></i>`).join("");
