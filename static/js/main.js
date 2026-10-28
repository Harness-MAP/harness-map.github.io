/* Harness-MAP project page — tabs, lineage charts wired to episode videos, adaptive-resolution demo. No dependencies. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DATA = {};
  try {
    DATA.lineages = JSON.parse($('#data-lineages').textContent);
    DATA.videos = JSON.parse($('#data-videos').textContent);
  } catch (e) { console.error('embedded data missing', e); }

  /* ---------------- tabs ---------------- */
  function initTabs(group) {
    const tabs = $$(':scope > .tabs > [role="tab"]', group);   // this group's own tabs, not a nested group's
    const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));
    const select = (i, focus) => {
      tabs.forEach((t, j) => {
        const on = i === j;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
      window.dispatchEvent(new Event('tabshown'));            // charts in the revealed panel re-measure themselves
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') select((i + 1) % tabs.length, true);
        else if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length, true);
      });
    });
    select(Math.max(0, tabs.findIndex(t => t.getAttribute('aria-selected') === 'true')));
  }
  $$('[data-tabs]').forEach(initTabs);

  /* ---------------- paper button: mark "soon" until the PDF is uploaded ---------------- */
  const paper = $('#btn-paper');
  if (paper && location.protocol !== 'file:') {
    fetch(paper.getAttribute('href'), { method: 'HEAD', cache: 'no-store' })
      .then(r => { if (!r.ok) paper.classList.add('soon'); })
      .catch(() => paper.classList.add('soon'));
  }

  /* ---------------- bibtex copy ---------------- */
  const copyBtn = $('#copy-bib');
  if (copyBtn) copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText($('#bibtex').textContent.trim()).then(() => {
      copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
  });

  /* ---------------- helpers ---------------- */
  const fmt = v => (v == null ? '–' : (Math.round(v * 1000) / 10).toFixed(1) + '%');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) {
      if (k === 'fill' || k === 'stroke') e.style[k] = attrs[k];          // CSS vars need the style path
      else e.setAttribute(k, attrs[k]);
    }
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ---------------- lineage chart ---------------- */
  function lineageChart(host, L, opts) {
    opts = opts || {};
    const rows = L.rows, n = rows.length;
    let selected = -1, lastW = 0, api = null;
    function measure() { const w = host.clientWidth ? host.clientWidth - 20 : 0; return w > 200 ? Math.min(760, w) : 760; }
    function render() {
    const W = measure(); lastW = W; host.innerHTML = '';
    const narrow = W < 520;
    const H = narrow ? Math.round(W * 0.62) : (opts.height || 290), m = narrow ? { l: 38, r: 12, t: 22, b: 38 } : { l: 50, r: 20, t: 26, b: 44 };
    const fs = narrow ? 10 : 11.5;
    const xs = i => m.l + (n > 1 ? i / (n - 1) : 0.5) * (W - m.l - m.r);
    const ys = v => m.t + (1 - v) * (H - m.t - m.b);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img',
      'aria-label': `${L.title}: score of every evaluated harness, in evaluation order` });
    svg.style.fontFamily = 'inherit';
    [0, .25, .5, .75, 1].forEach(v => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), stroke: 'var(--line)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: m.l - 8, y: ys(v) + 4, 'text-anchor': 'end', 'font-size': fs - 0.5, fill: 'var(--muted)' }, svg)
        .textContent = Math.round(v * 100) + '%';
    });
    const step = n > 30 ? (narrow ? 20 : 10) : n > 12 ? 5 : (narrow && n > 8 ? 2 : 1);
    for (let i = 0; i < n; i += step)
      svgEl('text', { x: xs(i), y: H - m.b + 18, 'text-anchor': 'middle', 'font-size': fs - 0.5, fill: 'var(--muted)' }, svg).textContent = i;
    svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': fs + 0.5, fill: 'var(--muted)' }, svg)
      .textContent = 'harness evaluation order (0 = anchor)';
    const ym = (m.t + H - m.b) / 2;
    svgEl('text', { x: 13, y: ym, 'text-anchor': 'middle', 'font-size': fs + 0.5, fill: 'var(--muted)', transform: `rotate(-90 13 ${ym})` }, svg)
      .textContent = narrow ? (opts.metric || 'score') : (opts.ylabel || 'score');
    // faint parent edges first
    rows.forEach((r, i) => {
      if (r.p == null || !rows[r.p]) return;
      const onpath = r.path && rows[r.p].path;
      if (!onpath) svgEl('line', { x1: xs(r.p), y1: ys(rows[r.p].score), x2: xs(i), y2: ys(r.score), stroke: 'var(--line-2)', 'stroke-width': 1, 'stroke-opacity': .7 }, svg);
    });
    // best-so-far reference
    let best = 0, d = '';
    rows.forEach((r, i) => { best = Math.max(best, r.score); d += (i === 0 ? `M${xs(i)},${ys(best)}` : ` H${xs(i)} V${ys(best)}`); });
    svgEl('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.3, 'stroke-opacity': .5, 'stroke-dasharray': '3 3' }, svg);
    // path edges
    rows.forEach((r, i) => {
      if (r.p == null || !rows[r.p] || !(r.path && rows[r.p].path)) return;
      svgEl('line', { x1: xs(r.p), y1: ys(rows[r.p].score), x2: xs(i), y2: ys(r.score), stroke: 'var(--accent)', 'stroke-width': 2.2, 'stroke-opacity': .9 }, svg);
    });
    const rOf = r => (r.best ? 7 : r.path ? 6 : 4.5);
    const dots = rows.map((r, i) => svgEl('circle', { cx: xs(i), cy: ys(r.score), r: rOf(r),
      fill: r.best ? 'var(--warm)' : r.path ? 'var(--accent)' : 'var(--line-2)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg));
    svgEl('text', { x: xs(0) + 9, y: ys(rows[0].score) - 10, 'font-size': fs, fill: 'var(--muted)' }, svg)
      .textContent = `anchor ${fmt(rows[0].score)}`;
    const bi = rows.findIndex(r => r.best);
    if (bi >= 0) svgEl('text', { x: xs(bi) - 9, y: ys(rows[bi].score) - 11, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 700, fill: 'var(--warm-ink)' }, svg)
      .textContent = `best ${fmt(rows[bi].score)}`;
    const sel = svgEl('circle', { r: 11, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-dasharray': '3 2', opacity: 0 }, svg);
    const tip = document.createElement('div'); tip.className = 'tip';
    const hitW = Math.max(16, (W - m.l - m.r) / Math.max(1, n - 1));
    function setSelected(i, silent) {
      selected = i; sel.setAttribute('cx', xs(i)); sel.setAttribute('cy', ys(rows[i].score)); sel.setAttribute('opacity', 1);
      if (!silent && opts.onSelect) opts.onSelect(i, rows[i]);
    }
    function show(i) {
      const r = rows[i]; dots[i].setAttribute('r', rOf(r) + 1.5);
      const diff = r.diff ? `${r.diff.files} file${r.diff.files === 1 ? '' : 's'}, +${r.diff.insertions} / −${r.diff.deletions} lines` : '';
      tip.innerHTML = `<b>#${i} ${esc(r.label)}</b><br>${esc(opts.metric || 'score')} ${fmt(r.score)}` +
        (r.p != null ? ` · parent #${r.p}` : '') + (r.depth != null ? ` · cell depth ${r.depth}` : '') +
        (diff ? `<br>diff vs parent: ${diff}` : '') + (opts.clickable ? '<br><span style="opacity:.75">click to play its episode</span>' : '');
      const bb = host.getBoundingClientRect(), pt = svg.createSVGPoint(); pt.x = xs(i); pt.y = ys(r.score);
      const sp = pt.matrixTransform(svg.getScreenCTM());
      tip.style.left = (sp.x - bb.left) + 'px'; tip.style.top = (sp.y - bb.top - 12) + 'px'; tip.classList.add('on');
    }
    function hide() { rows.forEach((r, i) => dots[i].setAttribute('r', rOf(r))); tip.classList.remove('on'); }
    rows.forEach((r, i) => {
      const h = svgEl('rect', { x: xs(i) - hitW / 2, y: m.t - 12, width: hitW, height: H - m.t - m.b + 24, fill: 'transparent',
        tabindex: 0, role: opts.clickable ? 'button' : 'img', 'aria-label': `#${i} ${r.label}: ${fmt(r.score)}` }, svg);
      h.style.cursor = opts.clickable ? 'pointer' : 'default';
      h.addEventListener('mouseenter', () => show(i)); h.addEventListener('mouseleave', hide);
      h.addEventListener('focus', () => show(i)); h.addEventListener('blur', hide);
      if (opts.clickable) {
        h.addEventListener('click', () => setSelected(i));
        h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } });
      }
    });
    host.appendChild(svg); host.appendChild(tip);
    const legend = document.createElement('div'); legend.className = 'legend';
    legend.innerHTML = '<span><i style="background:var(--line-2)"></i>evaluated harness</span>' +
      '<span><i style="background:var(--accent)"></i>on the path to the best</span>' +
      '<span><i style="background:var(--warm)"></i>best harness</span>' +
      '<span><i style="background:none;border-top:2px dashed var(--accent);border-radius:0;height:0;width:14px;vertical-align:3px"></i>best so far</span>' +
      '<span><i style="background:none;border-top:2px solid var(--accent);border-radius:0;height:0;width:14px;vertical-align:3px"></i>parent → child on the path</span>';
    host.appendChild(legend);
    if (opts.hint && !narrow) { const hd = document.createElement('div'); hd.className = 'hint'; hd.textContent = opts.hint; host.appendChild(hd); }
    if (selected >= 0) setSelected(selected, true);
    api = { setSelected };
    }
    render();
    let timer = null;
    const onResize = () => { clearTimeout(timer); timer = setTimeout(() => { if (host.clientWidth && Math.abs(measure() - lastW) > 40) render(); }, 120); };
    window.addEventListener('resize', onResize); window.addEventListener('tabshown', onResize);
    return { setSelected: (i, silent) => api.setSelected(i, silent) };
  }

  /* ---------------- video player bound to a list of entries ---------------- */
  function player(host, entries, opts) {
    const video = $('video', host), cap = $('.cap .text', host), prev = $('.prev', host), next = $('.next', host);
    let idx = 0;
    function set(i, play) {
      const e = entries[i]; if (!e) return; idx = i;
      video.pause(); video.setAttribute('poster', e.poster); video.src = e.file; video.load();
      if (play) video.play().catch(() => {});
      cap.innerHTML = opts.caption(e, i);
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === entries.length - 1;
      if (opts.onChange) opts.onChange(i);
    }
    if (prev) prev.addEventListener('click', () => set(idx - 1, true));
    if (next) next.addEventListener('click', () => set(idx + 1, true));
    set(opts.start || 0, false);
    return { set };
  }
  const badge = (e, r) => (r && r.best ? '<span class="badge best">best</span>' : r && r.path ? '<span class="badge path">on the path</span>' : '') +
    (e.episode_score === 1 ? ' <span class="badge ok">solved</span>' : e.episode_score === 0 ? ' <span class="badge">failed</span>' : '');

  /* ---------------- wire the showcase ---------------- */
  if (DATA.lineages && DATA.videos) {
    // BALROG: 41 harnesses on MazeWalk-15x15 episode 00
    const LB = DATA.lineages.balrog, VB = DATA.videos.balrog.mazewalk;
    if ($('#chart-balrog') && VB.length === LB.rows.length) {
      let chart;
      const pl = player($('#player-balrog'), VB, {
        caption: (e, i) => `<b>#${i} ${esc(e.label)}</b> · search success ${fmt(e.score)} · MazeWalk-15x15 episode 00: ${esc(e.outcome)} ${badge(e, LB.rows[i])}`,
        onChange: i => chart && chart.setSelected(i, true) });
      chart = lineageChart($('#chart-balrog'), LB, { metric: 'success', ylabel: 'success on the 40 search episodes', clickable: true,
        hint: 'Hover a harness for its score and diff; click it to watch the episode it played.', onSelect: i => pl.set(i, true) });
      chart.setSelected(LB.rows.findIndex(r => r.best), true);
      pl.set(LB.rows.findIndex(r => r.best), false);
    }
    // SpatialWorld games
    const gameMeta = { maze3d_pro: ['Maze3D-Pro', 'level 7'], block3d: ['Block3D', 'level 12'], maze: ['Maze', 'level 1'], snake: ['Snake', 'seed 20'], rubik: ['Rubik', null] };
    Object.keys(gameMeta).forEach(g => {
      const L = DATA.lineages['games_' + g]; const host = $('#chart-' + g); if (!L || !host) return;
      const entries = (DATA.videos.games[g] || []).filter(e => e.i != null);
      const ph = $('#player-' + g);
      if (ph && entries.length === L.rows.length) {
        let chart;
        const pl = player(ph, entries, {
          caption: (e, i) => `<b>#${i} ${esc(e.label)}</b> · search score ${fmt(e.score)} · ${gameMeta[g][0]} ${gameMeta[g][1]}: ` +
            (e.episode_score === 1 ? `solved in ${e.steps} steps` : `not solved in ${e.steps} steps`) + ' ' + badge(e, L.rows[i]),
          onChange: i => chart && chart.setSelected(i, true) });
        chart = lineageChart(host, L, { metric: 'score', ylabel: 'score on the search levels', clickable: true,
          hint: 'Hover a harness for its score and diff; click it to watch the level it played.', onSelect: i => pl.set(i, true) });
        const bi = L.rows.findIndex(r => r.best); chart.setSelected(bi, true); pl.set(bi, false);
      } else {
        lineageChart(host, L, { metric: 'score', ylabel: 'score on the search levels', clickable: false });
      }
    });
    // SimWorld navigation
    const LN = DATA.lineages.nav_hard;
    if (LN && $('#chart-nav')) lineageChart($('#chart-nav'), LN, { metric: 'SubtaskSR', ylabel: 'Subtask SR on the 50 search tasks', clickable: false });
  }

  /* ---------------- adaptive-resolution demo ---------------- */
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, lo, hi) => Math.max(lo == null ? 0 : lo, Math.min(hi == null ? 1 : hi, v));
  function kmeans(pts, k, rand) {
    if (pts.length <= k) return pts.map(p => [p.x, p.y]);
    const cents = [pts[Math.floor(rand() * pts.length)]].map(p => [p.x, p.y]);
    while (cents.length < k) {                          // k-means++ seeding
      const d2 = pts.map(p => Math.min(...cents.map(c => (p.x - c[0]) ** 2 + (p.y - c[1]) ** 2)));
      const tot = d2.reduce((a, b) => a + b, 0); let r = rand() * tot, i = 0;
      while (i < pts.length - 1 && (r -= d2[i]) > 0) i++;
      cents.push([pts[i].x, pts[i].y]);
    }
    for (let it = 0; it < 20; it++) {
      const sums = cents.map(() => [0, 0, 0]);
      pts.forEach(p => { let bi = 0, bd = Infinity; cents.forEach((c, i) => { const d = (p.x - c[0]) ** 2 + (p.y - c[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); sums[bi][0] += p.x; sums[bi][1] += p.y; sums[bi][2]++; });
      cents.forEach((c, i) => { if (sums[i][2]) { c[0] = sums[i][0] / sums[i][2]; c[1] = sums[i][1] / sums[i][2]; } else { const p = pts[Math.floor(rand() * pts.length)]; c[0] = p.x; c[1] = p.y; } });
    }
    return cents;
  }
  function demo(root) {
    const canvas = $('canvas', root); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const Wc = 560, Hc = 400, DPR = 2; canvas.width = Wc * DPR; canvas.height = Hc * DPR;
    const PASTEL = ['#dbe9f8', '#fde2e2', '#fff4cc', '#e3f3dc', '#d9f1ee', '#ffe6d1', '#e8e2f6', '#f6e3ee', '#e4ede0', '#fbe8d2', '#dde7f3', '#f1e6d9', '#e0f0f5', '#f3e2e7', '#eaf0d9', '#e9e4f2'];
    const EDGE = ['#7aa8e0', '#e58a8a', '#e3c45a', '#8fc981', '#6fc3b8', '#f0ad6f', '#a08fd8', '#d78cb8', '#9ab891', '#e0a86f', '#8ea6c8', '#c9a98a', '#86b6c8', '#cf9aa6', '#b4c08a', '#a99cc5'];
    const RAMP = ['#f28c52', '#ea6c34', '#d4521f', '#b23d14', '#8a2d0e', '#5e1d08'];
    const fcol = f => RAMP[Math.min(RAMP.length - 1, Math.floor(clamp(f) * RAMP.length))];
    const landscape = (x, y) => { const b = (cx, cy, s) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s)); return clamp(0.12 + 0.88 * b(0.70, 0.40, 0.10) + 0.50 * b(0.22, 0.74, 0.13) + 0.32 * b(0.52, 0.82, 0.08)); };
    const logEl = $('.log', root), cellsEl = $('.cells tbody', root), ro = { cells: $('[data-ro=cells]', root), evals: $('[data-ro=evals]', root), best: $('[data-ro=best]', root) };
    let S, rand;
    function logp(text, cls) { const p = document.createElement('p'); if (cls) p.className = cls; p.textContent = text; logEl.prepend(p); }
    function reset() {
      rand = mulberry32(20261028); logEl.innerHTML = '';
      const pts = [];
      while (pts.length < 20) { const x = rand(), y = rand(); pts.push({ x, y, f: clamp(landscape(x, y) + (rand() - 0.5) * 0.08), gen: 0 }); }
      const cents = kmeans(pts, 6, rand);
      S = { pts, cells: cents.map((c, i) => ({ c, memory: null, color: i, depth: 0 })), nextColor: 6, evals: pts.length, step: 0 };
      assign(); logp('Start: 20 evaluated founders in a k₀ = 6 CVT partition (the same k-means that Harness-MAP fits on the harness corpus).', '');
      draw();
    }
    function nearest(p, cells) { let bi = 0, bd = Infinity; cells.forEach((c, i) => { const d = (p.x - c.c[0]) ** 2 + (p.y - c.c[1]) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; }
    function assign() { S.pts.forEach(p => { p.cell = S.cells[nearest(p, S.cells)]; }); }
    function stats(cell) { const mem = S.pts.filter(p => p.cell === cell); const fs = mem.map(p => p.f); return { n: mem.length, mem, elite: fs.length ? Math.max(...fs) : null, range: fs.length ? Math.max(...fs) - Math.min(...fs) : 0 }; }
    function step() {
      assign();
      let pick = null;
      S.cells.forEach(cell => { const s = stats(cell); if (s.n < 2) return; if (cell.memory != null && Math.abs(cell.memory - s.range) < 1e-9) return; if (!pick || s.range > pick.s.range) pick = { cell, s }; });
      S.step++;
      if (!pick) { logp(`Step ${S.step}: no cell qualifies for a split (every occupied cell is flat or remembered). Click the map to propose a candidate and change a cell's fitness distribution.`, 'revert'); draw(); return; }
      const parent = pick.cell, preElite = pick.s.elite, idx = S.cells.indexOf(parent);
      const sub = kmeans(pick.s.mem, 2, rand);
      const children = sub.map(c => ({ c, memory: null, color: S.nextColor++ % PASTEL.length, depth: parent.depth + 1 }));
      S.cells.splice(idx, 1, ...children); assign();
      logp(`Step ${S.step}: the occupied cell with the largest fitness range (${pick.s.range.toFixed(2)}, elite ${preElite.toFixed(2)}) is sub-split with a local 2-centroid CVT. Zero evaluations spent.`, 'split');
      const kids = children.map(ch => { const s = stats(ch); const e = s.mem.reduce((a, b) => (b.f > a.f ? b : a), s.mem[0]);
        const q = { x: clamp(e.x + (rand() - 0.5) * 0.18), y: clamp(e.y + (rand() - 0.5) * 0.18), gen: S.step }; q.f = clamp(landscape(q.x, q.y) + (rand() - 0.5) * 0.08); return q; });
      S.pts.push(...kids); S.evals += kids.length; assign();
      const elites = children.map(ch => stats(ch).elite), gain = Math.max(...elites) - preElite;
      const scored = kids.map(p => p.f.toFixed(2)).join(' and ');
      if (gain > 1e-9) logp(`Bred one child from each new cell's elite: they scored ${scored}. A child cell's elite now beats the pre-split elite by ${gain.toFixed(2)}, so the split is kept.`, 'keep');
      else {
        const pos = S.cells.indexOf(children[0]); S.cells.splice(pos, 2, parent); assign(); parent.memory = stats(parent).range;
        logp(`Bred one child from each new cell's elite: they scored ${scored}. Neither child cell beats the pre-split elite ${preElite.toFixed(2)}, so the split is reverted; the cell remembers its fitness range (${parent.memory.toFixed(2)}) and is not re-split until a new candidate changes it.`, 'revert');
      }
      draw();
    }
    function addCandidate(x, y) {
      const q = { x, y, f: clamp(landscape(x, y) + (rand() - 0.5) * 0.08), gen: S.step + 0.5 }; S.pts.push(q); S.evals++; assign();
      const ci = S.cells.indexOf(q.cell); logp(`You proposed a candidate at (${x.toFixed(2)}, ${y.toFixed(2)}): fitness ${q.f.toFixed(2)}, placed in cell ${ci + 1}.`, ''); draw();
    }
    function draw() {
      const W = canvas.width, H = canvas.height, img = ctx.createImageData(W, H), d = img.data, cs = S.cells;
      const ids = new Int16Array(W * H);
      const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const fills = cs.map(c => hex(PASTEL[c.color % PASTEL.length])), edges = cs.map(c => hex(EDGE[c.color % EDGE.length]));
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const x = px / W, y = 1 - py / H; let bi = 0, bd = Infinity;
        for (let i = 0; i < cs.length; i++) { const dd = (x - cs[i].c[0]) ** 2 + (y - cs[i].c[1]) ** 2; if (dd < bd) { bd = dd; bi = i; } }
        ids[py * W + px] = bi;
      }
      for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
        const i = py * W + px, id = ids[i];
        const edge = (px > 1 && ids[i - 2] !== id) || (py > 1 && ids[i - 2 * W] !== id) || (px < W - 2 && ids[i + 2] !== id) || (py < H - 2 && ids[i + 2 * W] !== id);
        const col = edge ? edges[id] : fills[id]; d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      ctx.save(); ctx.scale(DPR, DPR);
      cs.forEach(c => { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(c.c[0] * Wc, (1 - c.c[1]) * Hc, 2.2, 0, 7); ctx.fill(); });
      const elites = new Set(cs.map(c => { const s = stats(c); return s.mem.find(p => p.f === s.elite); }));
      S.pts.forEach(p => {
        const x = p.x * Wc, y = (1 - p.y) * Hc;
        ctx.beginPath(); ctx.arc(x, y, elites.has(p) ? 6.5 : 5, 0, 7); ctx.fillStyle = fcol(p.f); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        if (elites.has(p)) { ctx.beginPath(); ctx.arc(x, y, 9.5, 0, 7); ctx.lineWidth = 1.6; ctx.strokeStyle = '#333'; ctx.stroke(); }
        if (p.gen === S.step && S.step > 0) { ctx.beginPath(); ctx.arc(x, y, 12.5, 0, 7); ctx.lineWidth = 1.2; ctx.setLineDash([3, 2]); ctx.strokeStyle = '#333'; ctx.stroke(); ctx.setLineDash([]); }
      });
      ctx.restore();
      ro.cells.textContent = cs.length; ro.evals.textContent = S.evals; ro.best.textContent = Math.max(...S.pts.map(p => p.f)).toFixed(2);
      cellsEl.innerHTML = cs.map((c, i) => { const s = stats(c); return `<tr><td><i class="sw" style="background:${PASTEL[c.color % PASTEL.length]};border-color:${EDGE[c.color % EDGE.length]}"></i>cell ${i + 1}${c.depth ? ` <span class="muted">(depth ${c.depth})</span>` : ''}</td><td>${s.n}</td><td>${s.elite == null ? '–' : s.elite.toFixed(2)}</td><td>${s.range.toFixed(2)}</td><td>${c.memory != null ? 'yes' : ''}</td></tr>`; }).join('');
    }
    $('[data-act=step]', root).addEventListener('click', step);
    $('[data-act=reset]', root).addEventListener('click', reset);
    canvas.addEventListener('click', e => { const bb = canvas.getBoundingClientRect(); addCandidate(clamp((e.clientX - bb.left) / bb.width), clamp(1 - (e.clientY - bb.top) / bb.height)); });
    reset();
  }
  $$('[data-demo]').forEach(demo);
})();
