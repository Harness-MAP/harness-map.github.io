/* Harness-MAP project page — tabs, Table 1 bar cards, interactive search/resolution dynamics, factorization lab,
   lineage charts wired to episode videos. No dependencies. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const DATA = {};
  try {
    DATA.lineages = JSON.parse($('#data-lineages').textContent);
    DATA.videos = JSON.parse($('#data-videos').textContent);
    DATA.curves = JSON.parse($('#data-curves').textContent);
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
    navigator.clipboard.writeText($('#bibtex-text').textContent.trim()).then(() => {
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
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  function onResize(fn) {
    let t = null; const h = () => { clearTimeout(t); t = setTimeout(fn, 120); };
    window.addEventListener('resize', h); window.addEventListener('tabshown', h);
  }
  const valueAt = (pts, x) => { let v = null; for (const p of pts) { if (p[0] <= x) v = p[1]; else break; } return v; };
  const stepPath = (pts, xs, ys) => pts.map((p, i) => (i ? ` H${xs(p[0])} V${ys(p[1])}` : `M${xs(p[0])},${ys(p[1])}`)).join('');
  const SUB = { 2: '₂', 4: '₄', 8: '₈', 16: '₁₆', 32: '₃₂' };

  /* ======================================================= Table 1 as bar cards */
  const T1 = {
    benches: [
      { id: 'games', title: 'SpatialWorld-3DGames', metric: 'Task success rate', n: 50, note: '110 levels across five games' },
      { id: 'easy', title: 'SimWorld-MMNav · easy', metric: 'Subtask success rate', n: 16, note: '50 search tasks' },
      { id: 'hard', title: 'SimWorld-MMNav · hard', metric: 'Subtask success rate', n: 16, note: '50 search tasks' },
      { id: 'minihack', title: 'BALROG-MiniHack', metric: 'Task success rate', n: 50, note: '40 episodes across eight tasks, ± standard error' }],
    rows: [
      { name: 'GPT-4o', group: 'direct', v: { games: null, easy: 33.1, hard: 34.4, minihack: [10.0, 4.7] } },
      { name: 'GPT-5', group: 'direct', v: { games: 36.4, easy: null, hard: null, minihack: [20.3, 7.3] } },
      { name: 'Qwen2.5-VL-72B-Instruct', group: 'direct', v: { games: 7.6, easy: 23.8, hard: 23.9, minihack: [5.0, 3.4] } },
      { name: 'Qwen3-VL-30B-Instruct', group: 'direct', anchor: true, v: { games: 10.7, easy: 32.0, hard: 29.0, minihack: [10.0, 4.7] } },
      { name: 'Meta-Harness', group: 'search', v: { games: 68.6, easy: 39.0, hard: 46.0, minihack: [75.0, 6.8] } },
      { name: 'GEPA', group: 'search', v: { games: 18.6, easy: 41.0, hard: 34.0, minihack: [30.0, 7.2] } },
      { name: 'DGM', group: 'search', v: { games: 34.6, easy: 40.0, hard: 38.5, minihack: [72.5, 7.1] } },
      { name: 'ShinkaEvolve', group: 'search', v: { games: 60.6, easy: 40.5, hard: 39.0, minihack: [20.0, 6.3] } },
      { name: 'OpenEvolve', group: 'search', v: { games: 21.2, easy: 36.5, hard: 37.0, minihack: [27.5, 7.1] } },
      { name: 'Harness-MAP', group: 'ours', v: { games: 100.0, easy: 46.5, hard: 55.5, minihack: [90.0, 4.7] } }]
  };
  function barCards(host) {
    host.innerHTML = '';
    T1.benches.forEach(b => {
      const rows = T1.rows.filter(r => r.v[b.id] != null);
      const val = r => (Array.isArray(r.v[b.id]) ? r.v[b.id][0] : r.v[b.id]);
      const se = r => (Array.isArray(r.v[b.id]) ? r.v[b.id][1] : null);
      const ours = rows.find(r => r.group === 'ours'), search = rows.filter(r => r.group === 'search');
      const bestBase = search.reduce((a, r) => (val(r) > val(a) ? r : a), search[0]);
      const anchor = rows.find(r => r.anchor);
      let html = `<div class="chart-top"><div><h4>${esc(b.title)}</h4><p>${esc(b.metric)} (%) · ${esc(b.note)}</p></div><span class="chart-tag">N = ${b.n}</span></div>`;
      let grp = '';
      rows.forEach(r => {
        if (r.group !== grp) { grp = r.group; html += `<div class="bar-group">${grp === 'direct' ? 'Direct inference, no search' : grp === 'search' ? 'Harness search, same budget' : 'Ours'}</div>`; }
        const v = val(r), s = se(r);
        html += `<div class="bar-row ${r.group}${r.anchor ? ' anchor' : ''}" tabindex="0" aria-label="${esc(r.name)}: ${v.toFixed(1)}${s != null ? ' ± ' + s.toFixed(1) : ''}">` +
          `<span class="bar-name">${esc(r.name)}</span><span class="bar-track"><span class="bar-fill" style="width:${v}%"></span>` +
          (s != null ? `<span class="bar-se" style="left:${Math.max(0, v - s)}%;width:${Math.min(100, v + s) - Math.max(0, v - s)}%"></span>` : '') +
          `</span><span class="bar-value">${v.toFixed(1)}${s != null ? `<small> ±${s.toFixed(1)}</small>` : ''}</span></div>`;
      });
      html += `<div class="chart-bottom"><strong>+${(val(ours) - val(bestBase)).toFixed(1)} pts</strong> over the best search baseline (${esc(bestBase.name)}, ${val(bestBase).toFixed(1)})` +
        (anchor ? `; <strong>+${(val(ours) - val(anchor)).toFixed(1)} pts</strong> over the frozen model without a search (${val(anchor).toFixed(1)}).` : '.') + '</div>';
      const card = el('article', 'chart-card' + (b.id === 'games' ? ' spot' : ''), html);
      host.appendChild(card);
    });
  }
  if ($('#barcards')) barCards($('#barcards'));

  /* ======================================================= generic best-so-far step chart */
  function curveChart(host, cfg) {
    const W = cfg.width, small = !!cfg.small;
    const H = small ? Math.round(W * 0.74) : Math.max(260, Math.min(430, Math.round(W * 0.52)));
    const m = small ? { l: 32, r: 34, t: cfg.title ? 26 : 10, b: 30 } : { l: 46, r: 54, t: 14, b: 42 };
    const fs = small ? 10 : 11.5;
    const xmax = cfg.xmax, xdom = xmax * 1.06, x0 = cfg.axis === 'n' ? 1 : 0;
    const xs = x => m.l + (x / xdom) * (W - m.l - m.r), ys = v => m.t + (1 - v / 100) * (H - m.t - m.b);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || cfg.title || 'search curve' }, host);
    svg.style.fontFamily = 'inherit'; svg.style.overflow = 'visible';
    if (cfg.title) svgEl('text', { x: m.l, y: 15, 'font-size': fs + 1.5, 'font-weight': 700, fill: 'var(--ink)' }, svg).textContent = cfg.title;
    [0, 20, 40, 60, 80, 100].forEach(v => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), stroke: 'var(--line)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: m.l - 6, y: ys(v) + 3.5, 'text-anchor': 'end', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = v;
    });
    const step = cfg.axis === 'n' ? 10 : (xmax > 30 ? 10 : xmax > 14 ? 5 : xmax > 7 ? 2 : 1);
    for (let x = 0; x <= xmax; x += step) {
      svgEl('line', { x1: xs(x), x2: xs(x), y1: ys(0), y2: ys(0) + 4, stroke: 'var(--line-2)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: xs(x), y: ys(0) + 15, 'text-anchor': 'middle', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = x;
    }
    svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': fs, fill: 'var(--muted)' }, svg).textContent = cfg.xlabel;
    if (!small) { const ym = (m.t + H - m.b) / 2; svgEl('text', { x: 12, y: ym, 'text-anchor': 'middle', 'font-size': fs, fill: 'var(--muted)', transform: `rotate(-90 12 ${ym})` }, svg).textContent = cfg.ylabel; }
    if (cfg.anchor) {
      if (cfg.anchor.band) svgEl('rect', { x: m.l, y: ys(cfg.anchor.band[1]), width: xs(xmax) - m.l, height: Math.max(0, ys(cfg.anchor.band[0]) - ys(cfg.anchor.band[1])), fill: 'var(--ink)', 'fill-opacity': .06 }, svg);
      svgEl('line', { x1: m.l, x2: xs(xmax), y1: ys(cfg.anchor.value), y2: ys(cfg.anchor.value), stroke: 'var(--muted)', 'stroke-dasharray': '4 3', 'stroke-width': 1 }, svg);
    }
    const cid = 'clip' + Math.random().toString(36).slice(2, 9);
    const crect = svgEl('rect', { x: m.l, y: 0, width: W - m.l, height: H }, svgEl('clipPath', { id: cid }, svgEl('defs', {}, svg)));
    const g = svgEl('g', { 'clip-path': `url(#${cid})` }, svg);
    const sorted = cfg.series.slice().sort((a, b) => (a.z || 0) - (b.z || 0));
    sorted.forEach(s => {
      svgEl('path', { d: stepPath(s.pts, xs, ys), fill: 'none', stroke: s.color, 'stroke-width': s.w || 1.6, 'stroke-dasharray': s.dash || 'none', 'stroke-opacity': s.opacity == null ? 1 : s.opacity, 'stroke-linejoin': 'round' }, g);
      const last = s.pts[s.pts.length - 1];
      if (s.marker) svgEl('circle', { cx: xs(last[0]), cy: ys(last[1]), r: small ? 2.4 : 3.2, fill: s.color }, g);
    });
    const labels = svgEl('g', {}, svg); labels.style.transition = 'opacity .2s';
    if (!small) {
      const ends = sorted.map(s => { const p = s.pts[s.pts.length - 1]; return { color: s.color, bold: true, y: ys(p[1]), v: p[1] }; });
      if (cfg.anchor) ends.push({ color: 'var(--muted)', bold: false, y: ys(cfg.anchor.value), v: cfg.anchor.value });
      ends.sort((a, b) => a.y - b.y);
      let prev = -1e9; const lx = xs(xmax) + 6;             // one right-hand column, stacked apart vertically
      ends.forEach(e => { let y = e.y; if (y < prev + 11) y = prev + 11; prev = y; svgEl('text', { x: lx, y: y + 3.5, 'font-size': fs - 1, 'font-weight': e.bold ? 700 : 400, fill: e.color }, labels).textContent = e.v.toFixed(1); });
    }
    const vline = svgEl('line', { x1: 0, x2: 0, y1: m.t, y2: ys(0), stroke: 'var(--ink)', 'stroke-width': 1, 'stroke-opacity': .5, opacity: 0 }, svg);
    const hit = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const tip = el('div', 'tip'); host.appendChild(tip);
    let reveal = null;
    function move(ev) {
      const bb = svg.getBoundingClientRect(); const px = (ev.clientX - bb.left) * (W / bb.width);
      let x = Math.round(((px - m.l) / (W - m.l - m.r)) * xdom); x = Math.max(x0, Math.min(xmax, x)); if (reveal != null) x = Math.min(x, reveal);
      vline.setAttribute('x1', xs(x)); vline.setAttribute('x2', xs(x)); vline.setAttribute('opacity', 1);
      const rows = cfg.series.map(s => ({ s, v: valueAt(s.pts, x) })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
      tip.innerHTML = `<b>${cfg.axis === 'n' ? 'N' : 'T'} = ${x}${cfg.title ? ' · ' + esc(cfg.title) : ''}</b>` +
        rows.map(r => `<div><i style="background:${r.s.color}"></i>${esc(r.s.label)}<span>${r.v.toFixed(1)}</span></div>`).join('') +
        (cfg.anchor ? `<div><i style="background:var(--muted)"></i>${esc(cfg.anchor.label)}<span>${cfg.anchor.value.toFixed(1)}</span></div>` : '');
      const hb = host.getBoundingClientRect(); const sx = bb.left - hb.left + xs(x) * (bb.width / W); const left = sx > hb.width * 0.58;
      tip.style.left = (sx + (left ? -12 : 12)) + 'px'; tip.style.top = (ev.clientY - hb.top + 12) + 'px'; tip.classList.toggle('left', left); tip.classList.add('on');
    }
    hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', () => { vline.setAttribute('opacity', 0); tip.classList.remove('on'); });
    hit.addEventListener('touchstart', e => move(e.touches[0]), { passive: true });
    return { setReveal(x) { const full = x >= xmax; crect.setAttribute('width', full ? W - m.l : Math.max(0, xs(x) - m.l + 1.5)); labels.style.opacity = full ? 1 : 0; reveal = full ? null : x; } };
  }

  /* ======================================================= search dynamics panel (Figures 3, 6, 7) */
  const BCOL = { 'Meta-Harness': 'var(--c-mh)', 'DGM': 'var(--c-dgm)', 'GEPA': 'var(--c-gepa)', 'ShinkaEvolve': 'var(--c-shinka)', 'OpenEvolve': 'var(--c-oe)' };
  const MODE_LABEL = { adaptive: 'adaptive', fixed: 'fixed', hier: 'hierarchical' };
  function dynamicsPanel(root) {
    const D = DATA.curves; if (!D) return;
    const K0 = D.meta.k0, BASES = D.meta.baselines;
    const st = { bench: 'games', view: 'agg', axis: 'n', mode: 'adaptive', reveal: null,
      show: { k0: Object.fromEntries(K0.map(k => [k, true])), base: Object.fromEntries(BASES.map(b => [b, true])) } };
    root.innerHTML = `<div class="toolbar">
      <div class="seg" data-ctl="bench"><button type="button" data-v="games">SpatialWorld-3DGames</button><button type="button" data-v="balrog">BALROG-MiniHack</button></div>
      <div class="seg" data-ctl="view"><button type="button" data-v="agg">Aggregate</button><button type="button" data-v="per">Per game</button></div>
      <div class="seg" data-ctl="axis"><button type="button" data-v="n">vs. evaluations N</button><button type="button" data-v="t">vs. steps T</button></div>
      <div class="seg" data-ctl="mode"><button type="button" data-v="adaptive">adaptive</button><button type="button" data-v="fixed">fixed</button><button type="button" data-v="hier">hierarchical</button></div>
    </div><div class="legend-toggles" data-legend></div><div class="charts" data-charts></div>
    <div class="reveal"><button type="button" class="play" data-play>Replay the search</button><input type="range" min="1" max="50" value="50" step="1" data-slider aria-label="Reveal the search up to this budget"><span class="readout" data-readout></span></div>
    <p class="note small muted" data-note></p>`;
    const chartsEl = $('[data-charts]', root), legendEl = $('[data-legend]', root), slider = $('[data-slider]', root), readout = $('[data-readout]', root), playBtn = $('[data-play]', root), noteEl = $('[data-note]', root);
    let charts = [], xmax = 50, playing = null;
    const block = key => (st.bench === 'games' ? (key === 'agg' ? D.games.agg : D.games.pergame[key]) : (key === 'agg' ? D.balrog.agg : D.balrog.pertask[key]));
    const panels = () => (st.view === 'agg' ? [{ key: 'agg', title: null }] :
      st.bench === 'games' ? D.games.order.map(g => ({ key: g, title: D.games.names[g] })) : D.balrog.order.map(t => ({ key: t, title: t })));
    function seriesFor(b) {
      const out = [];
      BASES.forEach(n => { const s = b.baselines[n]; if (s && st.show.base[n] && s[st.axis].length) out.push({ key: 'b:' + n, label: n, color: BCOL[n], pts: s[st.axis], w: 1.5, z: 1 }); });
      K0.forEach(k => { const s = b.ours[st.mode] && b.ours[st.mode][k]; if (s && st.show.k0[k] && s[st.axis].length) out.push({ key: 'k:' + k, label: `Harness-MAP ${MODE_LABEL[st.mode]}, k${SUB[k]}`, color: `var(--k${k})`, pts: s[st.axis], w: 2.3, z: 2, marker: true }); });
      return out;
    }
    function anchorFor(b) {
      if (st.bench === 'games') return b.anchor != null ? { value: b.anchor, label: 'Qwen3-VL-30B, no search' } : null;
      if (st.view === 'agg') return { value: b.anchor.mean, band: [b.anchor.min, b.anchor.max], label: 'BALROG naive agent, no search' };
      return b.anchor != null ? { value: b.anchor, label: 'naive agent, no search' } : null;
    }
    function legend() {
      legendEl.innerHTML = '';
      const add = (label, sw, on, cb) => { const b = el('button', '', `<i class="${sw.cls || ''}" style="--sw:${sw.color}"></i>${label}`); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', () => { cb(); render(true); }); legendEl.appendChild(b); };
      legendEl.appendChild(el('span', 'lbl', 'Harness-MAP'));
      K0.forEach(k => add(`k${SUB[k]} = ${k}`, { color: `var(--k${k})` }, st.show.k0[k], () => { st.show.k0[k] = !st.show.k0[k]; }));
      legendEl.appendChild(el('span', 'lbl', 'Baselines'));
      BASES.forEach(n => add(n, { color: BCOL[n], cls: 'thin' }, st.show.base[n], () => { st.show.base[n] = !st.show.base[n]; }));
    }
    function render(keepReveal) {
      const ps = panels(); const w = chartsEl.clientWidth || 900; const multi = ps.length > 1;
      chartsEl.className = 'charts' + (multi ? ' multi' : '');
      const cols = multi ? Math.max(1, Math.floor(w / 240)) : 1; const cw = multi ? Math.floor((w - 12 * (cols - 1)) / cols) - 18 : w - 20;
      const sets = ps.map(p => { const b = block(p.key); return { p, b, series: seriesFor(b), anchor: anchorFor(b) }; });
      xmax = st.axis === 'n' ? D.meta.ncap : Math.max(1, ...sets.flatMap(s => s.series.map(q => q.pts[q.pts.length - 1][0])));
      chartsEl.innerHTML = ''; charts = [];
      sets.forEach(s => {
        const host = el('div', 'chart'); chartsEl.appendChild(host);
        charts.push(curveChart(host, { width: Math.max(220, cw), small: multi, title: s.p.title, series: s.series, anchor: s.anchor, axis: st.axis, xmax,
          xlabel: st.axis === 'n' ? 'harness evaluations N' : 'sequential proposal steps T',
          ylabel: st.bench === 'games' && st.view === 'agg' ? 'best-so-far success, mean over 5 games (%)' : 'best-so-far success rate (%)',
          aria: `${st.bench === 'games' ? 'SpatialWorld-3DGames' : 'BALROG-MiniHack'} ${s.p.title || 'aggregate'}: best-so-far success against ${st.axis === 'n' ? 'evaluations' : 'steps'}` }));
      });
      slider.max = xmax; slider.min = st.axis === 'n' ? 1 : 0;
      if (!keepReveal || st.reveal == null || st.reveal > xmax) st.reveal = xmax;
      slider.value = st.reveal; applyReveal();
      noteEl.innerHTML = st.bench === 'games'
        ? 'Success rate is the mean of the five games’ best-so-far task success (the paper’s Table 1 convention). Dashed line: the frozen Qwen3-VL-30B without a search, 11.3% on this mean (10.7% when games are weighted by task count, as in Table 1). Curves for fixed and hierarchical resolution at k₀ = 16 and 32 end one point below Table 8 because the archived logs predate the final re-seeds.'
        : `Best-so-far success over the 40 search episodes (8 tasks × 5 seeds). Dashed line and band: mean and range of ${D.balrog.agg.anchor.n} replicate evaluations of BALROG’s naive agent with the same frozen model.`;
    }
    function applyReveal() { readout.textContent = `${st.axis === 'n' ? 'N' : 'T'} = ${st.reveal}`; charts.forEach(c => c.setReveal(st.reveal)); }
    slider.addEventListener('input', () => { stop(); st.reveal = +slider.value; applyReveal(); });
    function stop() { if (playing) { cancelAnimationFrame(playing); playing = null; playBtn.classList.remove('playing'); playBtn.textContent = 'Replay the search'; } }
    playBtn.addEventListener('click', () => {
      if (playing) { stop(); return; }
      const lo = +slider.min, start = performance.now(), dur = 5200 + 60 * xmax;
      playBtn.classList.add('playing'); playBtn.textContent = 'Pause';
      const tick = now => { const f = Math.min(1, (now - start) / dur); st.reveal = Math.round(lo + f * (xmax - lo)); slider.value = st.reveal; applyReveal(); if (f < 1) playing = requestAnimationFrame(tick); else stop(); };
      st.reveal = lo; playing = requestAnimationFrame(tick);
    });
    $$('.seg', root).forEach(seg => {
      const ctl = seg.dataset.ctl;
      $$('button', seg).forEach(b => {
        b.classList.toggle('on', b.dataset.v === st[ctl]);
        b.addEventListener('click', () => {
          stop(); st[ctl] = b.dataset.v; $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
          if (ctl === 'bench') $('[data-ctl=view] [data-v=per]', root).textContent = st.bench === 'games' ? 'Per game' : 'Per task';
          render(false);
        });
      });
    });
    legend(); render(false);
    let lastW = chartsEl.clientWidth;
    onResize(() => { if (chartsEl.clientWidth && Math.abs(chartsEl.clientWidth - lastW) > 30) { lastW = chartsEl.clientWidth; render(true); } });
  }

  /* ======================================================= archive resolution panel (Figures 4, 8) */
  const MODE_DASH = { adaptive: 'none', fixed: '7 4', hier: '2 4' }, MODE_CLS = { adaptive: '', fixed: 'dash', hier: 'dot' };
  function resChart(host, cfg) {
    const W = cfg.width, small = !!cfg.small;
    const H = small ? Math.round(W * 0.8) : Math.max(280, Math.min(440, Math.round(W * 0.6)));
    const m = small ? { l: 30, r: 10, t: cfg.title ? 26 : 10, b: 30 } : { l: 44, r: 16, t: 14, b: 42 };
    const fs = small ? 10 : 11.5, lo = Math.log2(1.7), hi = Math.log2(60);
    const xmax = Math.max(1, cfg.xmax);
    const xs = x => m.l + (x / xmax) * (W - m.l - m.r), ys = v => m.t + (1 - (Math.log2(v) - lo) / (hi - lo)) * (H - m.t - m.b);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.aria || 'archive resolution' }, host);
    svg.style.fontFamily = 'inherit'; svg.style.overflow = 'visible';
    if (cfg.title) svgEl('text', { x: m.l, y: 15, 'font-size': fs + 1.5, 'font-weight': 700, fill: 'var(--ink)' }, svg).textContent = cfg.title;
    [2, 4, 8, 16, 32, 48].forEach(v => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), stroke: 'var(--line)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: m.l - 6, y: ys(v) + 3.5, 'text-anchor': 'end', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = v;
    });
    const step = xmax > 30 ? 10 : xmax > 14 ? 5 : xmax > 7 ? 2 : 1; const yb = ys(1.7);
    for (let x = 0; x <= xmax; x += step) { svgEl('line', { x1: xs(x), x2: xs(x), y1: yb, y2: yb + 4, stroke: 'var(--line-2)', 'stroke-width': 1 }, svg); svgEl('text', { x: xs(x), y: yb + 15, 'text-anchor': 'middle', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = x; }
    svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': fs, fill: 'var(--muted)' }, svg).textContent = 'sequential step T';
    if (!small) { const ym = (m.t + H - m.b) / 2; svgEl('text', { x: 12, y: ym, 'text-anchor': 'middle', 'font-size': fs, fill: 'var(--muted)', transform: `rotate(-90 12 ${ym})` }, svg).textContent = 'archive cells (log₂)'; }
    cfg.series.forEach(s => {
      const d = s.pts.map((p, i) => (i ? 'L' : 'M') + xs(p[0]) + ',' + ys(p[1])).join(' ');
      svgEl('path', { d, fill: 'none', stroke: s.color, 'stroke-width': s.mode === 'adaptive' ? 2.2 : 1.6, 'stroke-dasharray': MODE_DASH[s.mode], 'stroke-opacity': s.exact ? 1 : .45, 'stroke-linejoin': 'round' }, svg);
      s.pts.forEach(p => {
        const cx = xs(p[0]), cy = ys(p[1]), r = small ? 2.2 : 2.8, a = { fill: s.color, 'fill-opacity': s.exact ? 1 : .5 };
        if (s.mode === 'adaptive') svgEl('circle', Object.assign({ cx, cy, r }, a), svg);
        else if (s.mode === 'fixed') svgEl('rect', Object.assign({ x: cx - r, y: cy - r, width: 2 * r, height: 2 * r }, a), svg);
        else svgEl('path', Object.assign({ d: `M${cx},${cy - r - 1} L${cx + r + 1},${cy + r} L${cx - r - 1},${cy + r} Z` }, a), svg);
      });
    });
    const vline = svgEl('line', { x1: 0, x2: 0, y1: m.t, y2: yb, stroke: 'var(--ink)', 'stroke-width': 1, 'stroke-opacity': .5, opacity: 0 }, svg);
    const hit = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const tip = el('div', 'tip'); host.appendChild(tip);
    function move(ev) {
      const bb = svg.getBoundingClientRect(); const px = (ev.clientX - bb.left) * (W / bb.width);
      const x = Math.max(0, Math.min(xmax, Math.round(((px - m.l) / (W - m.l - m.r)) * xmax)));
      vline.setAttribute('x1', xs(x)); vline.setAttribute('x2', xs(x)); vline.setAttribute('opacity', 1);
      const rows = cfg.series.map(s => ({ s, v: valueAt(s.pts, x) })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
      tip.innerHTML = `<b>T = ${x}${cfg.title ? ' · ' + esc(cfg.title) : ''}</b>` + rows.map(r => `<div><i style="background:${r.s.color}"></i>${esc(r.s.label)}<span>${r.v} cells</span></div>`).join('');
      const hb = host.getBoundingClientRect(); const sx = bb.left - hb.left + xs(x) * (bb.width / W); const left = sx > hb.width * 0.58;
      tip.style.left = (sx + (left ? -12 : 12)) + 'px'; tip.style.top = (ev.clientY - hb.top + 12) + 'px'; tip.classList.toggle('left', left); tip.classList.add('on');
    }
    hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', () => { vline.setAttribute('opacity', 0); tip.classList.remove('on'); });
    hit.addEventListener('touchstart', e => move(e.touches[0]), { passive: true });
  }
  function resolutionPanel(root) {
    const D = DATA.curves; if (!D) return;
    const R = D.resolution, K0 = D.meta.k0, MODES = D.meta.modes;
    const st = { bench: 'games', show: { k0: Object.fromEntries(K0.map(k => [k, true])), mode: Object.fromEntries(MODES.map(m => [m, true])) } };
    root.innerHTML = `<div class="toolbar"><div class="seg" data-ctl="bench"><button type="button" data-v="games">SpatialWorld-3DGames</button><button type="button" data-v="balrog">BALROG-MiniHack</button></div></div>
      <div class="legend-toggles" data-legend></div><div class="charts" data-charts></div><p class="note small muted" data-note></p>`;
    const chartsEl = $('[data-charts]', root), legendEl = $('[data-legend]', root), noteEl = $('[data-note]', root);
    function legend() {
      legendEl.innerHTML = '';
      const add = (label, sw, on, cb) => { const b = el('button', '', `<i class="${sw.cls || ''}" style="--sw:${sw.color}"></i>${label}`); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', () => { cb(); render(); }); legendEl.appendChild(b); };
      legendEl.appendChild(el('span', 'lbl', 'Resolution mode'));
      MODES.forEach(mo => add(MODE_LABEL[mo], { color: 'var(--ink-2)', cls: MODE_CLS[mo] }, st.show.mode[mo], () => { st.show.mode[mo] = !st.show.mode[mo]; }));
      legendEl.appendChild(el('span', 'lbl', 'Initial k₀'));
      K0.forEach(k => add(`k${SUB[k]} = ${k}`, { color: `var(--k${k})` }, st.show.k0[k], () => { st.show.k0[k] = !st.show.k0[k]; }));
    }
    const toSeries = list => list.filter(s => st.show.mode[s.mode] && st.show.k0[s.k0]).map(s => ({ mode: s.mode, k0: s.k0, exact: s.exact, pts: s.pts, color: `var(--k${s.k0})`, label: `${MODE_LABEL[s.mode]}, k${SUB[s.k0]}` }));
    function render() {
      const w = chartsEl.clientWidth || 900;
      const ps = st.bench === 'games' ? D.games.order.map(g => ({ title: D.games.names[g], series: toSeries(R.games[g] || []) })) : [{ title: null, series: toSeries(R.balrog) }];
      const multi = ps.length > 1; chartsEl.className = 'charts' + (multi ? ' multi' : '');
      const cols = multi ? Math.max(1, Math.floor(w / 240)) : 1; const cw = multi ? Math.floor((w - 12 * (cols - 1)) / cols) - 18 : Math.min(w - 20, 760);
      chartsEl.innerHTML = '';
      ps.forEach(p => { const host = el('div', 'chart'); chartsEl.appendChild(host);
        resChart(host, { width: Math.max(220, cw), small: multi, title: p.title, series: p.series, xmax: Math.max(1, ...p.series.map(s => s.pts[s.pts.length - 1][0])), aria: `${st.bench} ${p.title || ''} archive cells against sequential step` }); });
      noteEl.innerHTML = st.bench === 'games'
        ? 'One archive per game. Faded lines were reconstructed from the driver log of an equivalent-configuration run; solid lines are the exact per-step trace. Fixed-resolution arms are flat by construction and are shown where a trace survives.'
        : 'One archive per arm: a single harness plays all eight tasks, so the three modes are directly comparable. Fixed resolution never splits; hierarchical expansion grows the archive on a prepared ladder; adaptive resolution splits on fitness variance and retreats when a split did not pay.';
    }
    $$('.seg button', root).forEach(b => { b.classList.toggle('on', b.dataset.v === st.bench); b.addEventListener('click', () => { st.bench = b.dataset.v; $$('.seg button', root).forEach(x => x.classList.toggle('on', x === b)); render(); }); });
    legend(); render();
    let lastW = chartsEl.clientWidth;
    onResize(() => { if (chartsEl.clientWidth && Math.abs(chartsEl.clientWidth - lastW) > 30) { lastW = chartsEl.clientWidth; render(); } });
  }
  $$('[data-dyn]').forEach(r => (r.dataset.dyn === 'search' ? dynamicsPanel(r) : resolutionPanel(r)));

  /* ======================================================= factorization lab (Figure 2's four Rubik's-cube candidates) */
  function factorLab(root) {
    const ROLES = ['orchestrator', 'capture', 'perception', 'controller', 'solver'];
    const RCOL = { orchestrator: 'var(--r-orch)', capture: 'var(--r-capture)', perception: 'var(--r-perc)', controller: 'var(--r-ctrl)', solver: 'var(--r-solver)' };
    const C = [
      { id: 'a', name: 'anchor', files: 'main.py · vlm.py',
        code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    async def step(frame):\n        # frozen VLM emits the move\n        return await vlm.decide(frame)\n    return step',
        note: 'One frozen VLM emits every move: no perception, no solver of its own.',
        nodes: [['main.py', 'orchestrator'], ['vlm.py', 'controller']], edges: [[0, 1]], cell: 'A', pos: [72, 148], from: null,
        delta: 'The reference harness. Its component graph has one edge, and the descriptor places it in cell A.' },
      { id: 'b', name: 'cand_r004_0', files: 'main.py · frame.py · sticker.py · vlm.py · action.py',
        code: 'def build_agent(ev):\n    ev.prompt = ROLE + READ + RULES\n    lens = sticker.StickerLens()\n    solver = action.CubeSolver()\n    async def step(frame):\n        px = frame.capture()\n        fl = lens.read(px)\n        state = vlm.identify(fl)\n        return solver.solve(state)\n    return step',
        note: 'Reads facelets through a sticker lens, then hands a full solve to action.py.',
        nodes: [['main.py', 'orchestrator'], ['frame.py', 'capture'], ['sticker.py', 'perception'], ['vlm.py', 'controller'], ['action.py', 'solver']], edges: [[0, 1], [0, 2], [0, 3], [0, 4]], cell: 'B', pos: [206, 108], from: 'a',
        delta: 'Δs versus a: three new modules and three new call edges change φS, and the harness moves from cell A to cell B.' },
      { id: 'c', name: 'cand_r004_1', files: 'main.py · frame.py · grounding.py · vlm.py · action.py',
        code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    eyes = grounding.Eyes()\n    solver = action.CubeSolver()\n    async def step(frame):\n        px = frame.capture()\n        obs = eyes.read(px)\n        plan = vlm.decide(obs)\n        return solver.step(plan)\n    return step',
        note: 'Same four-stage pipeline as b; different grounding module and call names.',
        nodes: [['main.py', 'orchestrator'], ['frame.py', 'capture'], ['grounding.py', 'perception'], ['vlm.py', 'controller'], ['action.py', 'solver']], edges: [[0, 1], [0, 2], [0, 3], [0, 4]], cell: 'B', pos: [224, 124], from: 'b',
        delta: 'Δθ only versus b: the component graph and φS are identical, so only the token descriptor moves, a little, and the cell stays B.' },
      { id: 'd', name: 'cand_r005_1', files: 'main.py · frame.py · vlm.py · action.py',
        code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    belief = action.ScramblePosterior()\n    async def step(frame):\n        if belief.worth_asking():  # VoI\n            c = vlm.ask(frame)\n            belief.update(c)\n        return belief.best_move()\n    return step',
        note: 'No perception module: keeps a belief over the scramble; asks the VLM when it pays.',
        nodes: [['main.py', 'orchestrator'], ['frame.py', 'capture'], ['vlm.py', 'controller'], ['action.py', 'solver']], edges: [[0, 1], [0, 2], [0, 3], [3, 2]], cell: 'B', pos: [204, 62], from: 'b',
        delta: 'Δs and Δθ versus b: a different graph (no perception, a belief loop) and different code, yet structure-token proximity still maps it to cell B.' }];
    const tabsEl = $('.cand-tabs', root), fx = k => $(`[data-fx=${k}]`, root);
    C.forEach((c, i) => { const b = el('button', '', `<i>${c.id}</i>${esc(c.name)}`); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', () => show(i)); tabsEl.appendChild(b); });
    fx('legend').innerHTML = ROLES.map(r => `<span><i style="background:${RCOL[r]}"></i>${r}</span>`).join('') + '<span><i class="edge"></i>structure-bearing call: adds a graph edge</span><span><i class="edge tok"></i>token-only difference: same graph</span>';
    function show(i) {
      const c = C[i];
      $$('button', tabsEl).forEach((b, j) => b.setAttribute('aria-selected', i === j ? 'true' : 'false'));
      fx('code').textContent = c.code; fx('files').textContent = c.files; fx('note').textContent = c.note;
      // component graph: orchestrator left, modules in a column on the right, calls as edges
      const g = fx('graph'); g.innerHTML = '';
      const W = 360, H = 250, others = c.nodes.slice(1), gap = Math.min(52, (H - 40) / others.length);
      const P = c.nodes.map((n, k) => (k === 0 ? [70, H / 2] : [262, H / 2 - gap * (others.length - 1) / 2 + gap * (k - 1)]));
      const defs = svgEl('defs', {}, g);
      const mk = svgEl('marker', { id: 'arr-' + c.id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
      svgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ink-2)' }, mk);
      c.edges.forEach(([a, b]) => {
        const [x1, y1] = P[a], [x2, y2] = P[b], loop = a !== 0;
        const d = loop ? `M${x2 + 54},${y2 + 6} C${x2 + 92},${y2 + 6} ${x2 + 92},${y1 - 6} ${x2 + 54},${y1 - 6}` : `M${x1 + 50},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2 - 56},${y2}`;
        svgEl('path', { d, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.6, 'stroke-dasharray': loop ? '3 3' : 'none', 'marker-end': `url(#arr-${c.id})` }, g);
        if (loop) svgEl('text', { x: x2 + 96, y: (y1 + y2) / 2 + 4, 'font-size': 9.5, fill: 'var(--muted)' }, g).textContent = 'asks when it pays';
      });
      c.nodes.forEach(([name, role], k) => {
        const [x, y] = P[k], w = k === 0 ? 100 : 112;
        svgEl('rect', { x: x - w / 2, y: y - 19, width: w, height: 38, rx: 8, fill: 'var(--surface-2)', stroke: RCOL[role], 'stroke-width': 2 }, g);
        svgEl('rect', { x: x - w / 2, y: y - 19, width: 6, height: 38, rx: 3, fill: RCOL[role] }, g);
        svgEl('text', { x: x + 4, y: y - 3, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: 'var(--ink)', 'font-family': 'var(--mono)' }, g).textContent = name;
        svgEl('text', { x: x + 4, y: y + 12, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' }, g).textContent = role;
      });
      // φS at t = 0: proportion of components carrying each role
      const n = c.nodes.length;
      fx('hist').innerHTML = ROLES.map(r => { const p = c.nodes.filter(x => x[1] === r).length / n; return `<span class="role"><i style="background:${RCOL[r]}"></i>${r}</span><span class="track"><span class="bar" style="width:${p * 100}%;background:${RCOL[r]}"></span></span><span>${p.toFixed(2)}</span>`; }).join('');
      // the map: two cells, four candidates, the selected one highlighted, the compared one linked
      const mp = fx('map'); mp.innerHTML = '';
      svgEl('polygon', { points: '0,0 168,0 132,250 0,250', fill: 'var(--cell1)', stroke: 'var(--line-2)' }, mp);
      svgEl('polygon', { points: '168,0 300,0 300,250 132,250', fill: 'var(--cell3)', stroke: 'var(--line-2)' }, mp);
      svgEl('text', { x: 16, y: 24, 'font-size': 12, 'font-weight': 700, fill: 'var(--muted)' }, mp).textContent = 'cell A';
      svgEl('text', { x: 262, y: 24, 'font-size': 12, 'font-weight': 700, fill: 'var(--muted)' }, mp).textContent = 'cell B';
      [[60, 140], [226, 118]].forEach(([x, y]) => { svgEl('path', { d: `M${x - 4},${y - 4} L${x + 4},${y + 4} M${x - 4},${y + 4} L${x + 4},${y - 4}`, stroke: 'var(--muted)', 'stroke-width': 1.5 }, mp); });
      svgEl('text', { x: 150, y: 242, 'text-anchor': 'middle', 'font-size': 9.5, fill: 'var(--muted)' }, mp).textContent = '× centroids · nearest-centroid lookup places a candidate';
      if (c.from) { const f = C.find(x => x.id === c.from); svgEl('line', { x1: f.pos[0], y1: f.pos[1], x2: c.pos[0], y2: c.pos[1], stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, mp);
        const vert = Math.abs(c.pos[0] - f.pos[0]) < Math.abs(c.pos[1] - f.pos[1]), mx = (f.pos[0] + c.pos[0]) / 2, my = (f.pos[1] + c.pos[1]) / 2;
        svgEl('text', { x: vert ? mx - 9 : mx + 6, y: vert ? my + 4 : my - 6, 'text-anchor': vert ? 'end' : 'start', 'font-size': 11, 'font-weight': 700, fill: 'var(--ink-2)' }, mp).textContent = c.id === 'b' ? 'Δs' : c.id === 'c' ? 'Δθ' : 'Δs, Δθ'; }
      C.forEach(x => { const on = x === c; svgEl('circle', { cx: x.pos[0], cy: x.pos[1], r: on ? 7 : 5, fill: on ? 'var(--accent)' : 'var(--line-2)', stroke: 'var(--surface)', 'stroke-width': 2 }, mp);
        if (on) svgEl('circle', { cx: x.pos[0], cy: x.pos[1], r: 12, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '3 2' }, mp);
        svgEl('text', { x: x.pos[0] + (x.id === 'a' ? 12 : 12), y: x.pos[1] + 4, 'font-size': 12, 'font-weight': 700, fill: on ? 'var(--accent-ink)' : 'var(--muted)' }, mp).textContent = x.id; });
      fx('cell').textContent = c.delta;
    }
    show(1);
  }
  if ($('#lab-factor')) factorLab($('#lab-factor'));

  /* ======================================================= lineage chart (evolution packs) */
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
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${L.title}: score of every evaluated harness, in evaluation order` });
    svg.style.fontFamily = 'inherit';
    [0, .25, .5, .75, 1].forEach(v => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), stroke: 'var(--line)', 'stroke-width': 1 }, svg);
      svgEl('text', { x: m.l - 8, y: ys(v) + 4, 'text-anchor': 'end', 'font-size': fs - 0.5, fill: 'var(--muted)' }, svg).textContent = Math.round(v * 100) + '%';
    });
    const step = n > 30 ? (narrow ? 20 : 10) : n > 12 ? 5 : (narrow && n > 8 ? 2 : 1);
    for (let i = 0; i < n; i += step) svgEl('text', { x: xs(i), y: H - m.b + 18, 'text-anchor': 'middle', 'font-size': fs - 0.5, fill: 'var(--muted)' }, svg).textContent = i;
    svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': fs + 0.5, fill: 'var(--muted)' }, svg).textContent = 'harness evaluation order (0 = anchor)';
    const ym = (m.t + H - m.b) / 2;
    svgEl('text', { x: 13, y: ym, 'text-anchor': 'middle', 'font-size': fs + 0.5, fill: 'var(--muted)', transform: `rotate(-90 13 ${ym})` }, svg).textContent = narrow ? (opts.metric || 'score') : (opts.ylabel || 'score');
    rows.forEach((r, i) => {
      if (r.p == null || !rows[r.p]) return;
      const onpath = r.path && rows[r.p].path;
      if (!onpath) svgEl('line', { x1: xs(r.p), y1: ys(rows[r.p].score), x2: xs(i), y2: ys(r.score), stroke: 'var(--line-2)', 'stroke-width': 1, 'stroke-opacity': .7 }, svg);
    });
    let best = 0, d = '';
    rows.forEach((r, i) => { best = Math.max(best, r.score); d += (i === 0 ? `M${xs(i)},${ys(best)}` : ` H${xs(i)} V${ys(best)}`); });
    svgEl('path', { d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.3, 'stroke-opacity': .5, 'stroke-dasharray': '3 3' }, svg);
    rows.forEach((r, i) => {
      if (r.p == null || !rows[r.p] || !(r.path && rows[r.p].path)) return;
      svgEl('line', { x1: xs(r.p), y1: ys(rows[r.p].score), x2: xs(i), y2: ys(r.score), stroke: 'var(--accent)', 'stroke-width': 2.2, 'stroke-opacity': .9 }, svg);
    });
    const rOf = r => (r.best ? 7 : r.path ? 6 : 4.5);
    const dots = rows.map((r, i) => svgEl('circle', { cx: xs(i), cy: ys(r.score), r: rOf(r), fill: r.best ? 'var(--warm)' : r.path ? 'var(--accent)' : 'var(--line-2)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg));
    svgEl('text', { x: xs(0) + 9, y: ys(rows[0].score) - 10, 'font-size': fs, fill: 'var(--muted)' }, svg).textContent = `anchor ${fmt(rows[0].score)}`;
    const bi = rows.findIndex(r => r.best);
    if (bi >= 0) svgEl('text', { x: xs(bi) - 9, y: ys(rows[bi].score) - 11, 'text-anchor': 'end', 'font-size': fs, 'font-weight': 700, fill: 'var(--warm-ink)' }, svg).textContent = `best ${fmt(rows[bi].score)}`;
    const sel = svgEl('circle', { r: 11, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 2, 'stroke-dasharray': '3 2', opacity: 0 }, svg);
    const tip = el('div', 'tip');
    const hitW = Math.max(16, (W - m.l - m.r) / Math.max(1, n - 1));
    function setSelected(i, silent) {
      selected = i; sel.setAttribute('cx', xs(i)); sel.setAttribute('cy', ys(rows[i].score)); sel.setAttribute('opacity', 1);
      if (!silent && opts.onSelect) opts.onSelect(i, rows[i]);
    }
    function show(i) {
      const r = rows[i]; dots[i].setAttribute('r', rOf(r) + 1.5);
      const diff = r.diff ? `${r.diff.files} file${r.diff.files === 1 ? '' : 's'}, +${r.diff.insertions} / −${r.diff.deletions} lines` : '';
      tip.innerHTML = `<b>#${i} ${esc(r.label)}</b>${esc(opts.metric || 'score')} ${fmt(r.score)}` +
        (r.p != null ? ` · parent #${r.p}` : '') + (r.depth != null ? ` · cell depth ${r.depth}` : '') +
        (diff ? `<br>diff vs parent: ${diff}` : '') + (opts.clickable ? '<br><span style="opacity:.75">click to play its episode</span>' : '');
      const bb = host.getBoundingClientRect(), pt = svg.createSVGPoint(); pt.x = xs(i); pt.y = ys(r.score);
      const sp = pt.matrixTransform(svg.getScreenCTM());
      tip.style.left = (sp.x - bb.left) + 'px'; tip.style.top = (sp.y - bb.top - 12) + 'px'; tip.style.transform = 'translate(-50%,-110%)'; tip.style.whiteSpace = 'normal'; tip.classList.add('on');
    }
    function hide() { rows.forEach((r, i) => dots[i].setAttribute('r', rOf(r))); tip.classList.remove('on'); }
    rows.forEach((r, i) => {
      const h = svgEl('rect', { x: xs(i) - hitW / 2, y: m.t - 12, width: hitW, height: H - m.t - m.b + 24, fill: 'transparent', tabindex: 0, role: opts.clickable ? 'button' : 'img', 'aria-label': `#${i} ${r.label}: ${fmt(r.score)}` }, svg);
      h.style.cursor = opts.clickable ? 'pointer' : 'default';
      h.addEventListener('mouseenter', () => show(i)); h.addEventListener('mouseleave', hide);
      h.addEventListener('focus', () => show(i)); h.addEventListener('blur', hide);
      if (opts.clickable) {
        h.addEventListener('click', () => setSelected(i));
        h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } });
      }
    });
    host.appendChild(svg); host.appendChild(tip);
    const legend = el('div', 'legend', '<span><i style="background:var(--line-2)"></i>evaluated harness</span>' +
      '<span><i style="background:var(--accent)"></i>on the path to the best</span>' +
      '<span><i style="background:var(--warm)"></i>best harness</span>' +
      '<span><i style="background:none;border-top:2px dashed var(--accent);border-radius:0;height:0;width:14px;vertical-align:3px"></i>best so far</span>' +
      '<span><i style="background:none;border-top:2px solid var(--accent);border-radius:0;height:0;width:14px;vertical-align:3px"></i>parent → child on the path</span>');
    host.appendChild(legend);
    if (opts.hint && !narrow) host.appendChild(el('div', 'hint', esc(opts.hint)));
    if (selected >= 0) setSelected(selected, true);
    api = { setSelected };
    }
    render();
    onResize(() => { if (host.clientWidth && Math.abs(measure() - lastW) > 40) render(); });
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
    const LN = DATA.lineages.nav_hard;
    if (LN && $('#chart-nav')) lineageChart($('#chart-nav'), LN, { metric: 'SubtaskSR', ylabel: 'Subtask SR on the 50 search tasks', clickable: false });
  }
})();
