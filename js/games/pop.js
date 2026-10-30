/* games/pop.js — فرقع.
   PopLogic = قوانين اللعبة بس (من غير رسم)، عشان نقدر نحاكي آلاف الأدوار في الاختبارات ونتأكد إن كل مرحلة ليها حل.
   Pop = الرسم واللمس والأنيميشن. */
"use strict";
const PopLogic = {
  create(opt = {}, rng = Math.random) {
    const s = { rows: opt.rows || 9, cols: opt.cols || 7, nc: opt.colors || 5, grid: [], id: 1, rng };
    for (let r = 0; r < s.rows; r++) { const row = []; for (let c = 0; c < s.cols; c++) row.push(this.newCell(s, r - s.rows - 1)); s.grid.push(row); }
    // الصخور في النص التحتاني من اللوحة
    const spots = [];
    for (let r = 3; r < s.rows; r++) for (let c = 0; c < s.cols; c++) spots.push([r, c]);
    for (let i = 0; i < Math.min(opt.stones || 0, spots.length); i++) {
      const j = i + Math.floor(rng() * (spots.length - i)); [spots[i], spots[j]] = [spots[j], spots[i]];
      const [r, c] = spots[i]; s.grid[r][c].stone = true; s.grid[r][c].k = -1;
    }
    this.ensurePlayable(s);
    return s;
  },
  newCell(s, start) { return { id: s.id++, k: Math.floor(s.rng() * s.nc), bomb: false, stone: false, start }; },
  inside(s, r, c) { return r >= 0 && c >= 0 && r < s.rows && c < s.cols; },
  flood(s, r, c) {
    const first = s.grid[r][c]; if (!first || first.stone || first.bomb) return [[r, c]];
    const k = first.k, seen = new Set([r * 100 + c]), out = [[r, c]], st = [[r, c]];
    while (st.length) {
      const [y, x] = st.pop();
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx, key = ny * 100 + nx;
        if (!this.inside(s, ny, nx) || seen.has(key)) continue;
        const n = s.grid[ny][nx]; if (!n || n.bomb || n.stone || n.k !== k) continue;
        seen.add(key); out.push([ny, nx]); st.push([ny, nx]);
      }
    }
    return out;
  },
  touchesStone(s, r, c) {
    for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const y = r + dy, x = c + dx; if (this.inside(s, y, x) && s.grid[y][x] && s.grid[y][x].stone) return true; }
    return false;
  },
  hasMove(s) {
    const g = s.grid;
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
      const x = g[r][c]; if (!x || x.stone) continue; if (x.bomb) return true;
      for (const [dy, dx] of [[0, 1], [1, 0]]) { const n = this.inside(s, r + dy, c + dx) && g[r + dy][c + dx]; if (n && !n.stone && !n.bomb && n.k === x.k) return true; }
    }
    return false;
  },
  ensurePlayable(s) { // لو مفيش ولا حركة، نخلط ألوان الحلويات (مش الصخور ولا القنابل)
    let tries = 0;
    while (!this.hasMove(s) && tries++ < 60) for (const row of s.grid) for (const x of row) if (x && !x.stone && !x.bomb) x.k = Math.floor(s.rng() * s.nc);
    return tries;
  },
  // تنفيذ دوسة. يرجّع null لو الدوسة مش مسموحة (حلوى لوحدها أو صخرة).
  tap(s, r, c) {
    if (!this.inside(s, r, c)) return null;
    const cell = s.grid[r][c]; if (!cell || cell.stone) return null;
    let cells, points, detonated = false, madeBomb = false, group = 0;
    if (cell.bomb) {
      detonated = true; cells = [];
      for (let y = r - 1; y <= r + 1; y++) for (let x = c - 1; x <= c + 1; x++) if (this.inside(s, y, x) && s.grid[y][x]) cells.push([y, x]);
      points = 150 + cells.length * 20; group = cells.length;
    } else {
      const g = this.flood(s, r, c);
      if (g.length < 2 && !this.touchesStone(s, r, c)) return null; // حلوى لوحدها مسموحة بس لو جنب صخرة (بتخبطها)
      points = g.length < 2 ? 10 : g.length * g.length * 5; madeBomb = g.length >= 6; group = g.length;
      cells = madeBomb ? g.filter(([y, x]) => !(y === r && x === c)) : g.slice();
      const stoneKeys = new Set();
      for (const [y, x] of g) for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ny = y + dy, nx = x + dx;
        if (this.inside(s, ny, nx) && s.grid[ny][nx] && s.grid[ny][nx].stone) stoneKeys.add(ny * 100 + nx);
      }
      for (const key of stoneKeys) cells.push([Math.floor(key / 100), key % 100]);
    }
    const out = { removed: [], points, detonated, madeBomb, colors: {}, stones: 0, group, tapped: cell };
    for (const [y, x] of cells) {
      const it = s.grid[y][x]; out.removed.push({ r: y, c: x, cell: it });
      if (it.stone) out.stones++; else out.colors[it.k] = (out.colors[it.k] || 0) + 1;
      s.grid[y][x] = null;
    }
    if (madeBomb) cell.bomb = true;
    return out;
  },
  gravity(s) {
    const g = s.grid;
    for (let c = 0; c < s.cols; c++) {
      const col = [];
      for (let r = s.rows - 1; r >= 0; r--) if (g[r][c]) col.push(g[r][c]);
      const missing = s.rows - col.length;
      for (let r = s.rows - 1, i = 0; r >= 0; r--, i++) g[r][c] = i < col.length ? col[i] : this.newCell(s, r - missing - 1);
    }
  },
  stonesLeft(s) { let n = 0; for (const row of s.grid) for (const x of row) if (x && x.stone) n++; return n; }
};

const Pop = {
  key: "pop", name: "فرقع", COLS: 7, ROWS: 9,
  COLORS: ["#ff6b6b", "#3ddc97", "#4d9dff", "#ffc93c", "#b388ff"],

  start(cfg = {}, hooks = {}) {
    this.cfg = Object.assign({ mode: "free", colors: 5, stones: 0, moves: 20, goal: null }, cfg);
    this.hooks = hooks; this.active = true;
    this.L = PopLogic.create({ rows: this.ROWS, cols: this.COLS, colors: this.cfg.colors, stones: this.cfg.stones });
    this.s = { score: 0, level: 1, moves: this.cfg.moves, movesTotal: this.cfg.moves, base: 0, target: 600, busy: false, grid: this.L.grid,
      collected: {}, stonesBroken: 0, bombsUsed: 0 };
    ui.stage.innerHTML = '<div class="pop-wrap"><div class="pop-board" id="popBoard" tabindex="0" aria-label="لوحة فرقع: الأسهم للتحرك و Enter للفرقعة"><div class="pop-cursor" id="popCursor"></div></div></div>';
    this.board = $("#popBoard"); this.els = new Map(); this.cur = { r: this.ROWS - 1, c: 0 };
    this.layout(); this.render();
    this.onResize = () => { this.layout(); this.render(); };
    addEventListener("resize", this.onResize);
    this.board.addEventListener("pointerdown", e => { e.preventDefault(); this.tap(e); });
    this.board.addEventListener("keydown", e => this.onKey(e));
    this.hud();
  },
  stop() { removeEventListener("resize", this.onResize); this.active = false; if (this.s) this.s.busy = true; },
  isLevel() { return this.cfg.mode === "level"; },
  // واجهة متوافقة مع الاختبارات والنسخة الأولى
  flood(r, c) { return PopLogic.flood(this.L, r, c); },
  ensurePlayable() { return PopLogic.ensurePlayable(this.L); },

  layout() {
    const w = ui.stage.clientWidth, h = ui.stage.clientHeight - 6;
    this.cell = Math.max(24, Math.floor(Math.min(w / this.COLS, h / this.ROWS)));
    this.board.style.width = this.cell * this.COLS + "px"; this.board.style.height = this.cell * this.ROWS + "px";
    this.board.style.setProperty("--cell", this.cell + "px");
    this.drawCursor();
  },
  render() {
    const cs = this.cell;
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      const cell = this.L.grid[r][c]; if (!cell) continue;
      let el = this.els.get(cell.id);
      if (!el) {
        el = document.createElement("div"); this.els.set(cell.id, el); this.board.appendChild(el);
        const sr = cell.start != null ? cell.start : r;
        el.style.transform = `translate(${c * cs}px,${sr * cs}px)`; void el.offsetWidth;
      }
      cell.start = null;
      el.className = cell.stone ? "candy stone" : "candy k" + cell.k + (cell.bomb ? " bomb" : "");
      if (!cell.stone) el.style.setProperty("--c", this.COLORS[cell.k]);
      el.style.transform = `translate(${c * cs}px,${r * cs}px)`;
    }
  },
  goalProgress() {
    const g = this.cfg.goal, s = this.s; if (!g) return 0;
    const v = g.type === "score" ? s.score : g.type === "color" ? (s.collected[g.k] || 0) : g.type === "stones" ? s.stonesBroken : s.bombsUsed;
    return { v: Math.min(v, g.n), n: g.n, frac: Math.min(1, v / g.n) };
  },
  goalLabel() {
    const g = this.cfg.goal, p = this.goalProgress();
    const icon = g.type === "color" ? `<i class="chipc" style="--c:${this.COLORS[g.k]}"></i>` : g.type === "stones" ? '<i class="chipc stone"></i>' : g.type === "bombs" ? '<i class="chipc bomb"></i>' : "";
    const word = { score: "النقط", color: "", stones: "صخور", bombs: "قنابل" }[g.type];
    return `${word}${icon} ${p.v} / ${p.n}`;
  },
  hud() {
    const s = this.s;
    if (this.isLevel()) {
      setInfo(`<span>حركات: ${s.moves}</span><span>${this.goalLabel()}</span>`);
      setBar(this.goalProgress().frac);
    } else {
      setInfo(`<span>مرحلة ${s.level}</span><span>حركات: ${s.moves}</span><span>الهدف: ${s.target}</span>`);
      setBar((s.score - s.base) / (s.target - s.base));
    }
  },
  onKey(e) {
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      this.cur.r = Math.max(0, Math.min(this.ROWS - 1, this.cur.r + moves[e.key][0]));
      this.cur.c = Math.max(0, Math.min(this.COLS - 1, this.cur.c + moves[e.key][1]));
      this.drawCursor();
    } else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.tapAt(this.cur.r, this.cur.c); }
  },
  drawCursor() { const k = $("#popCursor"); if (k) k.style.transform = `translate(${this.cur.c * this.cell}px,${this.cur.r * this.cell}px)`; },
  tap(e) {
    const rect = this.board.getBoundingClientRect();
    this.tapAt(Math.floor((e.clientY - rect.top) / this.cell), Math.floor((e.clientX - rect.left) / this.cell));
  },
  tapAt(r, c) {
    const s = this.s; if (s.busy || !this.active) return;
    if (r < 0 || c < 0 || r >= this.ROWS || c >= this.COLS) return;
    const cell = this.L.grid[r][c]; if (!cell) return;
    const tapEl = this.els.get(cell.id);
    const res = PopLogic.tap(this.L, r, c);
    if (!res) { tapEl.classList.remove("wob"); void tapEl.offsetWidth; tapEl.classList.add("wob"); sfx.blip(); return; }
    s.moves--;
    for (const { cell: g } of res.removed) {
      const el = this.els.get(g.id); if (!el) continue;
      const [px, py] = centerOf(el);
      burst(px, py, g.stone ? "#9b8fb5" : this.COLORS[g.k], res.detonated ? 10 : 6);
      el.classList.add("popping"); this.els.delete(g.id); setTimeout(() => el.remove(), 180);
    }
    s.score += res.points; setScore(s.score);
    for (const k in res.colors) s.collected[k] = (s.collected[k] || 0) + res.colors[k];
    s.stonesBroken += res.stones; if (res.detonated) s.bombsUsed++;
    const n = res.group; // حجم المجموعة (أو عدد اللي اتفجّر بالقنبلة)
    const [tx, ty] = centerOf(tapEl);
    floatText(tx, ty - 10, "+" + res.points, n >= 8 || res.detonated ? "gold" : "good");
    if (res.madeBomb) setTimeout(() => floatText(tx, ty - 60, "قنبلة!", "huge"), 120);
    else if (n >= 10) setTimeout(() => floatText(tx, ty - 60, "يا سلام!", "huge"), 120);
    if (res.stones) setTimeout(() => floatText(tx, ty + 30, res.stones > 1 ? `كسرت ${res.stones} صخور` : "كسرت صخرة", "good"), 60);
    sfx.pop(n); if (res.detonated) { sfx.boom(); shake(); }
    buzz(n >= 6 || res.detonated ? 35 : 12);
    s.busy = true;
    this.hud();
    setTimeout(() => {
      if (!this.active) return;
      PopLogic.gravity(this.L); PopLogic.ensurePlayable(this.L); this.render(); this.hud();
      setTimeout(() => { if (!this.active) return; s.busy = false; this.afterMove(); }, 240);
    }, 170);
  },
  afterMove() {
    const s = this.s;
    if (!this.active) return;
    if (this.isLevel()) {
      if (this.goalProgress().frac >= 1) this.finish(true);
      else if (s.moves <= 0) this.finish(false);
      return;
    }
    if (s.score >= s.target) {
      s.level++; s.base = s.target; s.target = Math.round(s.target * 1.6 + 400); s.moves = 20;
      sfx.level(); buzz([30, 40, 30]);
      const [cx, cy] = screenCenter(); floatText(cx, cy, "مرحلة " + s.level + "!", "huge");
      ["#ffc93c", "#3ddc97", "#ff6b6b"].forEach(c => burst(cx, cy, c, 14));
      this.hud();
    } else if (s.moves <= 0) this.finish(false);
  },
  finish(won) {
    const s = this.s; if (!this.active) return;
    this.active = false; s.busy = true;
    if (this.hooks.end) this.hooks.end({ game: "pop", won, score: s.score, movesLeft: s.moves, movesTotal: s.movesTotal, note: this.isLevel() ? "" : `وصلت لمرحلة ${s.level}` });
  },
  rank(v) { return v < 800 ? "فرقيع مبتدئ" : v < 2500 ? "فرقيع شاطر" : v < 6000 ? "ملك الفرقعة" : "أسطورة الفرقعة"; }
};
