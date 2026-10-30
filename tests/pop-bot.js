// لاعب "طمّاع" بسيط لفرقع (من غير تخطيط لقدّام). بيتحقن في الصفحة للاختبارات وأداة المعايرة.
window.__popBot = function play(cfg, seed) {
  const PopLogic = __mal3ab.PopLogic;
  let x = seed; const rng = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
  const s = PopLogic.create({ rows: 9, cols: 7, colors: cfg.colors, stones: cfg.stones }, rng);
  const g = cfg.goal; let moves = cfg.moves, score = 0, col = 0, stones = 0, bombs = 0;
  const prog = () => g.type === 'score' ? score : g.type === 'color' ? col : g.type === 'stones' ? stones : bombs;
  while (moves > 0 && prog() < g.n) {
    let best = null;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 7; c++) {
      const cell = s.grid[r][c]; if (!cell || cell.stone) continue;
      const grp = cell.bomb ? null : PopLogic.flood(s, r, c);
      if (!cell.bomb && grp.length < 2 && !PopLogic.touchesStone(s, r, c)) continue;
      let v;
      if (cell.bomb) v = g.type === 'bombs' ? 1e6 : g.type === 'stones' ? 500 : 300;
      else {
        const n = grp.length; v = n;
        if (g.type === 'color') v = (cell.k === g.k && n >= 2 ? 100 * n : 0) + n;
        if (g.type === 'stones') { const near = new Set(); for (const [y, xx] of grp) for (const [dy, dx] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ny = y + dy, nx = xx + dx; if (ny >= 0 && nx >= 0 && ny < 9 && nx < 7 && s.grid[ny][nx] && s.grid[ny][nx].stone) near.add(ny * 9 + nx); } v = near.size * 100 + n; }
        if (g.type === 'bombs') v = n >= 6 ? 1000 + n : n;
        if (g.type === 'score') v = n < 2 ? 0 : n * n;
      }
      if (!best || v > best.v) best = { r, c, v };
    }
    if (!best) { PopLogic.ensurePlayable(s); continue; }
    const out = PopLogic.tap(s, best.r, best.c); moves--;
    score += out.points; col += out.colors[g.k] || 0; stones += out.stones; if (out.detonated) bombs++;
    PopLogic.gravity(s); PopLogic.ensurePlayable(s);
  }
  return { won: prog() >= g.n, left: moves };
};
window.__popStats = function (cfg, runs, salt) {
  let wins = 0, left = 0, three = 0;
  for (let i = 0; i < runs; i++) { const r = window.__popBot(cfg, 1000 + i * 7919 + salt); if (r.won) { wins++; left += r.left; if (r.left / cfg.moves >= 0.25) three++; } }
  return { win: wins / runs, three: three / runs, avgLeft: wins ? +(left / wins).toFixed(1) : 0 };
};
