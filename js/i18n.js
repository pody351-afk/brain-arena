/* i18n.js — واجهة اللعبة بلغتين (عربي / English).
   الفكرة: الكود كله مكتوب بالعربي، وفي وضع الإنجليزي بنترجم النصوص الظاهرة في الصفحة لحظة ظهورها (من قاموس I18N_EN).
   وضع العربي مبيتغيّرش فيه أي حاجة. أي نص مالوش ترجمة بيفضل عربي (ومعاه اختبار tests/i18n.test.js بيكشف الناقص).
   اللي مش بيتترجم: أي عنصر عليه translate="no" (أسماء اللاعبين، ولوحة لعبة الكلمات). لعبة الكلمات نفسها بالعربي في اللغتين. */
"use strict";
const I18N = {
  lang: "ar", map: new Map(), pats: [], idx: new Map(), cache: new Map(), obs: null,
  AR: /[؀-ۿ]/,

  detect() {
    const saved = store.get("lang", null);
    if (saved === "ar" || saved === "en") return saved;
    const nav = (navigator.languages && navigator.languages[0]) || navigator.language || "ar";
    return /^ar/i.test(nav) ? "ar" : "en"; // لغة الجهاز
  },
  esc: s => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&"),

  build() {
    const keys = Object.keys(I18N_EN);
    for (const k of keys) {
      if (k.includes("{}")) {
        const lit = k.split("{}");
        this.pats.push({ re: new RegExp("^" + lit.map(this.esc).join("([\\s\\S]*?)") + "$"), en: I18N_EN[k], weight: lit.join("").length });
      } else this.map.set(k, I18N_EN[k]);
    }
    this.pats.sort((a, b) => b.weight - a.weight);
    // فهرس بأول حرف للمطابقة الجزئية (الأطول الأول)
    for (const k of [...this.map.keys()].sort((a, b) => b.length - a.length)) {
      const c = k[0]; if (!this.idx.has(c)) this.idx.set(c, []); this.idx.get(c).push(k);
    }
  },

  // ترجمة نص كامل. بترجّع نفس النص لو مفيش عربي أو مفيش ترجمة.
  t(s) {
    if (this.lang !== "en" || typeof s !== "string" || !this.AR.test(s)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0], core = s.trim();
    if (!core) return s;
    let r = this.cache.get(core);
    if (r === undefined) { r = this.translateCore(core, 0); if (this.cache.size > 3000) this.cache.clear(); this.cache.set(core, r); }
    return lead + r.replace(/،/g, ",").replace(/؟/g, "?") + trail; // علامات الترقيم العربية
  },
  translateCore(c, depth) {
    if (this.map.has(c)) return this.map.get(c);
    if (depth < 4) {
      for (const p of this.pats) {
        const m = c.match(p.re); if (!m) continue;
        let i = 0;
        return p.en.replace(/\{!?\}/g, tok => { const v = m[++i] || ""; return tok === "{!}" || !this.AR.test(v) ? v : this.translateCore(v.trim(), depth + 1); });
      }
    }
    return this.greedy(c);
  },
  // مطابقة جزئية: بنمشي على النص ونترجم أطول مفتاح موجود في كل موضع، وباقي الرموز والأرقام بتفضل زي ما هي
  greedy(c) {
    let out = "", i = 0;
    const join = piece => {
      if (out && /[A-Za-z0-9)]$/.test(out) && /^[A-Za-z0-9(]/.test(piece)) out += " ";
      out += piece;
    };
    while (i < c.length) {
      const ch = c[i], cand = this.idx.get(ch);
      let hit = null;
      if (cand) for (const k of cand) if (c.startsWith(k, i)) { hit = k; break; }
      if (hit) { join(this.map.get(hit)); i += hit.length; continue; }
      // نص غير مترجم: نكمله لحد أول حرف مش عربي عشان ما نقطّعش كلمة
      let j = i;
      if (this.AR.test(ch)) { while (j < c.length && /[؀-ۿ]/.test(c[j])) j++; } else j = i + 1;
      out += c.slice(i, j); i = j;
    }
    return out;
  },

  skip(node) { for (let n = node.nodeType === 1 ? node : node.parentElement; n; n = n.parentElement) if (n.getAttribute && n.getAttribute("translate") === "no") return true; return false; },
  ATTRS: ["aria-label", "placeholder", "title", "alt"],
  walk(root) {
    if (root.nodeType === 3) { this.text(root); return; }
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE)$/.test(root.tagName) || this.skip(root)) return;
    for (const a of this.ATTRS) if (root.hasAttribute(a)) this.attr(root, a);
    for (const ch of root.childNodes) this.walk(ch);
  },
  text(n) { if (this.AR.test(n.nodeValue) && !this.skip(n)) { const v = this.t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; } },
  attr(el, a) { const o = el.getAttribute(a); if (o && this.AR.test(o) && !this.skip(el)) { const v = this.t(o); if (v !== o) el.setAttribute(a, v); } },

  start() {
    this.obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === "characterData") this.text(m.target);
        else if (m.type === "attributes") this.attr(m.target, m.attributeName);
        else for (const n of m.addedNodes) this.walk(n);
      }
    });
    this.obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: this.ATTRS });
    this.walk(document.documentElement);
    document.title = this.t(document.title);
  },

  // زي confirm الأصلية بس بتترجم الرسالة
  hookDialogs() {
    const oc = window.confirm, oa = window.alert;
    window.confirm = m => oc.call(window, this.t(String(m)));
    window.alert = m => oa.call(window, this.t(String(m)));
  },

  set(lang) { store.set("lang", lang); location.reload(); },
  other() { return this.lang === "en" ? "ar" : "en"; },

  init() {
    this.lang = this.detect();
    document.documentElement.lang = this.lang;
    const dir = this.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    const app = document.getElementById("app"); if (app) app.dir = dir; // #app عليه dir مكتوب في الصفحة
    if (this.lang !== "en") return;
    this.build(); this.hookDialogs();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => this.start()); else this.start();
  },
};
I18N.init();
