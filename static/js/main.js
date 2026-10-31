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
    DATA.anatomy = JSON.parse($('#data-anatomy').textContent);
    DATA.cases = JSON.parse($('#data-cases').textContent);
  } catch (e) { console.error('embedded data missing', e); }

  /* ---------------- light / dark toggle (persisted; follows the system until the first click) ---------------- */
  const toggle = $('[data-theme-toggle]');
  if (toggle) toggle.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark'; root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    window.dispatchEvent(new Event('tabshown'));
  });

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

  /* ======================================================= Table 1 as three cards (SimWorld easy + hard share one) */
  const T1 = {
    cards: [
      { title: 'SpatialWorld-3DGames', sub: 'Task success rate (%) · 110 levels across five games', n: 50, cols: [{ id: 'games', label: '' }] },
      { title: 'SimWorld-MMNav', sub: 'Subtask success rate (%) · 50 search tasks per setting', n: 16, wide: true, cols: [{ id: 'easy', label: 'easy' }, { id: 'hard', label: 'hard' }] },
      { title: 'BALROG-MiniHack', sub: 'Task success rate (%) · 40 episodes across eight tasks, ± standard error', n: 50, cols: [{ id: 'minihack', label: '' }] }],
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
    const val = (r, id) => (r.v[id] == null ? null : Array.isArray(r.v[id]) ? r.v[id][0] : r.v[id]);
    const se = (r, id) => (Array.isArray(r.v[id]) ? r.v[id][1] : null);
    T1.cards.forEach(c => {
      const rows = T1.rows.filter(r => c.cols.some(col => val(r, col.id) != null));
      const range = {}; c.cols.forEach(col => { const vs = rows.map(r => val(r, col.id)).filter(v => v != null); range[col.id] = [Math.min(...vs), Math.max(...vs)]; });
      const shade = (v, id) => { const [lo, hi] = range[id]; return (0.22 + 0.78 * (hi > lo ? (v - lo) / (hi - lo) : 1)).toFixed(2); };
      let html = `<div class="chart-top"><div><h4>${esc(c.title)}</h4><p>${esc(c.sub)}</p></div><span class="chart-tag">N = ${c.n}</span></div>`;
      if (c.cols.length > 1) html += `<div class="bar-row head" style="--cols:${c.cols.length}"><span></span>${c.cols.map(col => `<span>${esc(col.label)}</span>`).join('')}</div>`;
      let grp = '';
      rows.forEach(r => {
        if (r.group !== grp) { grp = r.group; html += `<div class="bar-group">${grp === 'direct' ? 'Direct inference, no search' : grp === 'search' ? 'Harness search, same budget' : 'Ours'}</div>`; }
        const cells = c.cols.map(col => {
          const v = val(r, col.id), s = se(r, col.id);
          if (v == null) return `<span class="bar-track"></span><span class="bar-value na">–</span>`;
          const p = shade(v, col.id);
          return `<span class="bar-track"><span class="bar-fill" style="width:${v}%;--op:${p}"></span>` +
            (s != null ? `<span class="bar-se" style="left:${Math.max(0, v - s)}%;width:${Math.min(100, v + s) - Math.max(0, v - s)}%"></span>` : '') +
            `</span><span class="bar-value" style="--op:${p}">${v.toFixed(1)}${s != null ? `<small> ±${s.toFixed(1)}</small>` : ''}</span>`;
        }).join('');
        const label = c.cols.map(col => { const v = val(r, col.id); return v == null ? `${col.label || ''} –` : `${col.label ? col.label + ' ' : ''}${v.toFixed(1)}`; }).join(', ');
        html += `<div class="bar-row ${r.group}${r.anchor ? ' anchor' : ''}" style="--cols:${c.cols.length}" tabindex="0" aria-label="${esc(r.name)}: ${esc(label)}"><span class="bar-name">${esc(r.name)}</span>${cells}</div>`;
      });
      host.appendChild(el('article', 'chart-card' + (c.wide ? ' wide' : ''), html));
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
    const step = xmax > 30 ? 10 : xmax > 14 ? (cfg.axis === 'n' ? 2 : 5) : xmax > 7 ? 2 : 1;
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

  /* ======================================================= enlarge any chart in a lightbox */
  function openLightbox(title, renderBig, grid) {
    let lb = $('#lightbox');
    if (!lb) {
      lb = el('div', 'lightbox'); lb.id = 'lightbox';
      lb.innerHTML = '<div class="lb-box" role="dialog" aria-modal="true"><div class="lb-head"><span class="lb-title"></span><button type="button" class="lb-close" aria-label="Close">×</button></div><div class="lb-body chart"></div></div>';
      document.body.appendChild(lb);
      lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-close')) closeLightbox(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
    }
    $('.lb-title', lb).textContent = title; const body = $('.lb-body', lb); body.innerHTML = ''; body.className = 'lb-body' + (grid ? ' grid' : ' chart');
    lb.classList.add('on'); document.body.style.overflow = 'hidden';
    const w = Math.min(1160, window.innerWidth - 48) - 34; renderBig(body, grid ? Math.floor((w - 12) / 2) - 20 : w);
  }
  function closeLightbox() { const lb = $('#lightbox'); if (lb) { lb.classList.remove('on'); document.body.style.overflow = ''; } }
  function zoomable(host, title, renderBig) {
    const b = el('button', 'zoom-btn', '⤢'); b.type = 'button'; b.title = 'Enlarge'; b.setAttribute('aria-label', 'Enlarge ' + title);
    b.addEventListener('click', () => openLightbox(title, renderBig)); host.appendChild(b);
  }
  const gridCols = (w, n) => (n >= 5 ? (w >= 860 ? (n === 5 ? 5 : 4) : w >= 520 ? (n === 5 ? 3 : 2) : w >= 360 ? 2 : 1) : n === 2 ? (w >= 480 ? 2 : 1) : n >= 3 ? (w >= 700 ? n : w >= 420 ? 2 : 1) : 1);

  /* ======================================================= search dynamics panel (Figures 3, 6, 7) */
  const BCOL = { 'Meta-Harness': 'var(--c-mh)', 'DGM': 'var(--c-dgm)', 'GEPA': 'var(--c-gepa)', 'ShinkaEvolve': 'var(--c-shinka)', 'OpenEvolve': 'var(--c-oe)' };
  const MODE_LABEL = { adaptive: 'adaptive', fixed: 'fixed', hier: 'hierarchical' };
  const BENCH = [{ id: 'games', label: 'SpatialWorld-3DGames', cap: 50 }, { id: 'balrog', label: 'BALROG-MiniHack', cap: 50 }, { id: 'nav_easy', label: 'SimWorld-MMNav · easy', cap: 16 }, { id: 'nav_hard', label: 'SimWorld-MMNav · hard', cap: 16 }];
  const isNav = b => b.startsWith('nav');
  function dynamicsPanel(root) {
    const D = DATA.curves; if (!D) return;
    const K0 = D.meta.k0, BASES = D.meta.baselines;
    const st = { bench: 'games', view: 'agg', axis: 'n', mode: 'adaptive', reveal: null,
      show: { k0: Object.fromEntries(K0.map(k => [k, true])), base: Object.fromEntries(BASES.map(b => [b, true])) } };
    root.innerHTML = `<div class="toolbar">
      <div class="seg" data-ctl="bench">${BENCH.map(b => `<button type="button" data-v="${b.id}">${b.label}</button>`).join('')}</div>
      <div class="seg" data-ctl="view"><button type="button" data-v="agg">Aggregate</button><button type="button" data-v="per">Per game</button></div>
      <div class="seg" data-ctl="axis"><button type="button" data-v="n">vs. evaluations N</button><button type="button" data-v="t">vs. steps T</button></div>
      <div class="seg" data-ctl="mode"><button type="button" data-v="adaptive">adaptive</button><button type="button" data-v="fixed">fixed</button><button type="button" data-v="hier">hierarchical</button></div>
    </div><div class="legend-toggles" data-legend></div><div class="charts" data-charts></div>
    <div class="reveal"><button type="button" class="play" data-play>Replay the search</button><input type="range" min="1" max="50" value="50" step="1" data-slider aria-label="Reveal the search up to this budget"><span class="readout" data-readout></span></div>
    <p class="note small muted" data-note></p>`;
    const chartsEl = $('[data-charts]', root), legendEl = $('[data-legend]', root), slider = $('[data-slider]', root), readout = $('[data-readout]', root), playBtn = $('[data-play]', root), noteEl = $('[data-note]', root);
    let charts = [], xmax = 50, playing = null;
    const block = key => (st.bench === 'games' ? (key === 'agg' ? D.games.agg : D.games.pergame[key]) : st.bench === 'balrog' ? (key === 'agg' ? D.balrog.agg : D.balrog.pertask[key]) : D[st.bench].agg);
    const panels = () => (st.view === 'agg' || isNav(st.bench) ? [{ key: 'agg', title: null }] :
      st.bench === 'games' ? D.games.order.map(g => ({ key: g, title: D.games.names[g] })) : D.balrog.order.map(t => ({ key: t, title: t })));
    function seriesFor(b) {
      const out = [];
      BASES.forEach(n => { const s = b.baselines[n]; if (s && st.show.base[n] && s[st.axis].length) out.push({ key: 'b:' + n, label: n, color: BCOL[n], pts: s[st.axis], w: 1.5, z: 1 }); });
      K0.forEach(k => { const s = b.ours[st.mode] && b.ours[st.mode][k]; if (s && st.show.k0[k] && s[st.axis].length) out.push({ key: 'k:' + k, label: `Harness-MAP ${MODE_LABEL[st.mode]}, k${SUB[k]}`, color: `var(--k${k})`, pts: s[st.axis], w: 2.3, z: 2, marker: true }); });
      return out;
    }
    function anchorFor(b) {
      if (st.bench === 'games') return b.anchor != null ? { value: b.anchor, label: 'Qwen3-VL-30B, no search' } : null;
      if (isNav(st.bench)) return { value: b.anchor.mean, band: [b.anchor.min, b.anchor.max], label: 'anchor harness, no search (replicates)' };
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
      const cols = multi ? gridCols(w, ps.length) : 1; chartsEl.className = 'charts'; chartsEl.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      const cw = Math.floor((w - 12 * (cols - 1)) / cols) - 20;
      const sets = ps.map(p => { const b = block(p.key); return { p, b, series: seriesFor(b), anchor: anchorFor(b) }; });
      const cap = BENCH.find(b => b.id === st.bench).cap;
      xmax = st.axis === 'n' ? cap : Math.max(1, ...sets.flatMap(s => s.series.map(q => q.pts[q.pts.length - 1][0])));
      chartsEl.innerHTML = ''; charts = [];
      sets.forEach(s => {
        const host = el('div', 'chart'); chartsEl.appendChild(host);
        const cfg = { width: Math.max(200, cw), small: multi, title: s.p.title, series: s.series, anchor: s.anchor, axis: st.axis, xmax,
          xlabel: st.axis === 'n' ? 'harness evaluations N' : 'sequential proposal steps T',
          ylabel: st.bench === 'games' && st.view === 'agg' ? 'best-so-far success, mean over 5 games (%)' : isNav(st.bench) ? 'best-so-far subtask success (%)' : 'best-so-far success rate (%)',
          aria: `${BENCH.find(b => b.id === st.bench).label} ${s.p.title || 'aggregate'}: best-so-far success against ${st.axis === 'n' ? 'evaluations' : 'steps'}` };
        charts.push(curveChart(host, cfg));
        zoomable(host, `${BENCH.find(b => b.id === st.bench).label}${s.p.title ? ' · ' + s.p.title : ''}`, (body, bw) => curveChart(body, Object.assign({}, cfg, { width: bw, small: false })));
      });
      slider.max = xmax; slider.min = st.axis === 'n' ? 1 : 0;
      if (!keepReveal || st.reveal == null || st.reveal > xmax) st.reveal = xmax;
      slider.value = st.reveal; applyReveal();
      const nav = isNav(st.bench);
      $('[data-ctl=view]', root).style.display = nav ? 'none' : ''; $('[data-ctl=mode]', root).style.display = nav ? 'none' : '';
      noteEl.innerHTML = st.bench === 'games'
        ? 'Success rate is the mean of the five games\u2019 best-so-far task success (the paper\u2019s Table 1 convention). Dashed line: the frozen Qwen3-VL-30B without a search, 11.3% on this mean (10.7% when games are weighted by task count, as in Table 1). Curves for fixed and hierarchical resolution at k₀ = 16 and 32 end one point below Table 8 because the archived logs predate the final re-seeds.'
        : st.bench === 'balrog' ? `Best-so-far success over the 40 search episodes (8 tasks × 5 seeds). Dashed line and band: mean and range of ${D.balrog.agg.anchor.n} replicate evaluations of BALROG\u2019s naive agent with the same frozen model.`
        : `Best-so-far subtask success over the 50 search tasks, read at the N = 16 budget; only adaptive resolution was run on SimWorld, at k₀ = 2, 4 and 8. Dashed line and band: mean and range of ${D[st.bench].agg.anchor.n} evaluations of the frozen anchor harness inside the runs (Table 1\u2019s direct-inference row is the ReAct baseline without the harness layout). Every baseline\u2019s first evaluation is its own re-score of that anchor.`;
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
          if (ctl === 'bench') { $('[data-ctl=view] [data-v=per]', root).textContent = st.bench === 'games' ? 'Per game' : 'Per task'; if (isNav(st.bench)) { st.view = 'agg'; st.mode = 'adaptive'; $$('[data-ctl=view] button, [data-ctl=mode] button', root).forEach(x => x.classList.toggle('on', x.dataset.v === 'agg' || x.dataset.v === 'adaptive')); } }
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
    const RB = [{ id: 'games', label: 'SpatialWorld-3DGames' }, { id: 'balrog', label: 'BALROG-MiniHack' }, { id: 'nav', label: 'SimWorld-MMNav' }];
    const st = { bench: 'games', show: { k0: Object.fromEntries(K0.map(k => [k, true])), mode: Object.fromEntries(MODES.map(m => [m, true])) } };
    root.innerHTML = `<div class="toolbar"><div class="seg" data-ctl="bench">${RB.map(b => `<button type="button" data-v="${b.id}">${b.label}</button>`).join('')}</div></div>
      <div class="legend-toggles" data-legend></div><div class="charts" data-charts></div><div class="charts-tools" data-tools></div><p class="note small muted" data-note></p>`;
    const chartsEl = $('[data-charts]', root), legendEl = $('[data-legend]', root), noteEl = $('[data-note]', root), toolsEl = $('[data-tools]', root);
    function legend() {
      legendEl.innerHTML = '';
      const add = (label, sw, on, cb) => { const b = el('button', '', `<i class="${sw.cls || ''}" style="--sw:${sw.color}"></i>${label}`); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.addEventListener('click', () => { cb(); render(); }); legendEl.appendChild(b); };
      legendEl.appendChild(el('span', 'lbl', 'Resolution mode'));
      MODES.forEach(mo => add(MODE_LABEL[mo], { color: 'var(--ink-2)', cls: MODE_CLS[mo] }, st.show.mode[mo], () => { st.show.mode[mo] = !st.show.mode[mo]; }));
      legendEl.appendChild(el('span', 'lbl', 'Initial k₀'));
      K0.forEach(k => add(`k${SUB[k]} = ${k}`, { color: `var(--k${k})` }, st.show.k0[k], () => { st.show.k0[k] = !st.show.k0[k]; }));
    }
    const toSeries = list => list.filter(s => st.show.mode[s.mode] && st.show.k0[s.k0]).map(s => ({ mode: s.mode, k0: s.k0, exact: s.exact, pts: s.pts, color: `var(--k${s.k0})`, label: `${MODE_LABEL[s.mode]}, k${SUB[s.k0]}` }));
    const panelsFor = () => (st.bench === 'games' ? D.games.order.map(g => ({ title: D.games.names[g], series: toSeries(R.games[g] || []) }))
      : st.bench === 'balrog' ? [{ title: 'BALROG-MiniHack', series: toSeries(R.balrog) }]
      : [{ title: 'SimWorld-MMNav · easy', series: toSeries(R.nav_easy || []) }, { title: 'SimWorld-MMNav · hard', series: toSeries(R.nav_hard || []) }]);
    function cfgFor(p, width, small) { return { width, small, title: p.title, series: p.series, xmax: Math.max(1, ...p.series.map(s => s.pts[s.pts.length - 1][0])), aria: `${p.title}: archive cells against sequential step` }; }
    function render() {
      const w = chartsEl.clientWidth || 900; const ps = panelsFor();
      const cols = ps.length === 5 ? gridCols(w, 5) : (w >= 480 ? 2 : 1);     // BALROG's single panel takes one of two slots, so it matches the SimWorld panels
      chartsEl.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      const cw = Math.floor((w - 12 * (cols - 1)) / cols) - 20, small = cols > 2;
      chartsEl.innerHTML = '';
      ps.forEach(p => { const host = el('div', 'chart'); chartsEl.appendChild(host); resChart(host, cfgFor(p, Math.max(200, cw), small));
        zoomable(host, `${p.title} · archive cells vs. step T`, (body, bw) => resChart(body, cfgFor(p, bw, false))); });
      toolsEl.innerHTML = '';
      if (ps.length > 1) { const b = el('button', '', `Enlarge all ${ps.length} panels`); b.type = 'button'; b.addEventListener('click', () => openLightbox(`${RB.find(x => x.id === st.bench).label} · archive cells vs. step T`, (body, bw) => { ps.forEach(p => { const h = el('div', 'chart'); body.appendChild(h); resChart(h, cfgFor(p, bw, false)); }); }, true)); toolsEl.appendChild(b); }
      noteEl.innerHTML = st.bench === 'games'
        ? 'One archive per game. Faded lines were reconstructed from the driver log of an equivalent-configuration run; solid lines are the exact per-step trace. Fixed-resolution arms are flat by construction and are shown where a trace survives.'
        : st.bench === 'balrog' ? 'One archive per arm: a single harness plays all eight tasks, so the three modes are directly comparable. Fixed resolution never splits; hierarchical expansion grows the archive on a prepared ladder; adaptive resolution splits on fitness variance and retreats when a split did not pay.'
        : 'SimWorld ran adaptive resolution only, at k₀ = 2, 4 and 8 within the N = 16 budget. Hard (right) has per-step traces: the archive grows by one or two cells and retreats when a split did not pay. The easy driver persisted only the final archive, so each faded line on the left joins the initial k₀ to the final cell count (k₀ = 2: 6 splits and 2 retreats, 4 cells; k₀ = 4: 2 splits, 1 retreat, 5 cells; k₀ = 8: 2 splits, 1 retreat, 9 cells).';
    }
    $$('.seg button', root).forEach(b => { b.classList.toggle('on', b.dataset.v === st.bench); b.addEventListener('click', () => { st.bench = b.dataset.v; $$('.seg button', root).forEach(x => x.classList.toggle('on', x === b)); render(); }); });
    legend(); render();
    let lastW = chartsEl.clientWidth;
    onResize(() => { if (chartsEl.clientWidth && Math.abs(chartsEl.clientWidth - lastW) > 30) { lastW = chartsEl.clientWidth; render(); } });
  }
  $$('[data-dyn]').forEach(r => (r.dataset.dyn === 'search' ? dynamicsPanel(r) : resolutionPanel(r)));

  /* ======================================================= Figure-2 style cards: component graph + pseudocode */
  const F2ROLES = { orchestrator: 'var(--r-orch)', capture: 'var(--r-capture)', perception: 'var(--r-perc)', controller: 'var(--r-ctrl)', solver: 'var(--r-solver)' };
  const codeHtml = src => esc(src).replace(/«u»/g, '<u>').replace(/«\/u»/g, '</u>').replace(/«h»/g, '<mark>').replace(/«\/h»/g, '</mark>');
  /* graph: main node on top, the other modules in a row; `edges` are [from,to] module names, `stages` the pipeline order */
  function graphSvg(g) {
    const kids = g.nodes.filter(n => n.name !== g.main), n = kids.length, rows = n > 4 ? 3 : 2, fs = n > 5 ? 8.5 : 9.5;
    const labelPx = Math.max(0, ...kids.map(k => (k.label || k.name).length)) * fs * 0.6, margin = Math.max(36, labelPx / 2 + 8);
    const span = n > 1 ? (n > 5 ? 46 : 52) * (n - 1) : 0, W = Math.max(260, span + 2 * margin), H = 112 + rows * 11, top = [W / 2, 30], color = nd => (F2ROLES[nd.role] || `var(--r-${nd.role})`);
    const x0 = (W - span) / 2;
    const pos = {}, idx = {}; pos[g.main] = top; kids.forEach((k, i) => { pos[k.name] = [n > 1 ? x0 + i * span / (n - 1) : W / 2, 96]; idx[k.name] = i; });
    let s = `<svg viewBox="0 0 ${W} ${H}" style="max-width:${Math.round(W * 1.45)}px" role="img" aria-label="component graph"><defs><marker id="f2arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--bar)"/></marker></defs>`;
    (g.edges || []).forEach(([a, b, dashed]) => {
      const p = pos[a], q = pos[b]; if (!p || !q || a === b) return; const dash = dashed === true ? ' stroke-dasharray="3 3"' : '';
      if (p[1] !== q[1]) { const dir = q[1] > p[1] ? 1 : -1; s += `<path d="M${p[0]},${p[1] + dir * 12} L${q[0]},${q[1] - dir * 12}" stroke="var(--bar)" stroke-width="1.5" fill="none" marker-end="url(#f2arr)"${dash}/>`; }
      else { const d = Math.abs(idx[a] - idx[b]), dir = q[0] > p[0] ? 1 : -1;
        if (d === 1) s += `<path d="M${p[0] + dir * 13},${p[1]} L${q[0] - dir * 13},${q[1]}" stroke="var(--bar)" stroke-width="1.6" fill="none" marker-end="url(#f2arr)"${dash}/>`;
        else s += `<path d="M${p[0]},${p[1] - 11} Q${(p[0] + q[0]) / 2},${p[1] - 16 - 6 * d} ${q[0]},${q[1] - 11}" stroke="var(--bar)" stroke-width="1.2" fill="none" marker-end="url(#f2arr)"${dash}/>`; }
    });
    if (g.loop) { const [a, b] = g.loop; const p = pos[a], q = pos[b]; if (p && q) { s += `<path d="M${p[0]},${p[1] + 13} C${p[0] - 10},${p[1] + 42} ${q[0] + 10},${q[1] + 42} ${q[0]},${q[1] + 13}" stroke="var(--r-ctrl)" stroke-width="1.4" fill="none" marker-end="url(#f2arr)"/><text x="${(p[0] + q[0]) / 2}" y="${p[1] + 44}" text-anchor="middle" font-size="8.5" fill="var(--r-ctrl)" font-weight="700">${esc(g.loopLabel || '')}</text>`; } }
    s += `<path d="M${top[0] - 12},${top[1] + 2} C${top[0] - 34},${top[1] + 8} ${top[0] - 34},${top[1] - 20} ${top[0] - 9},${top[1] - 10}" stroke="var(--r-orch)" stroke-width="1.3" fill="none" marker-end="url(#f2arr)"/><text x="${top[0] - 36}" y="${top[1] + 2}" text-anchor="end" font-size="8.5" fill="var(--r-orch)" font-weight="700">per-step</text>`;
    g.nodes.forEach(nd => { const [x, y] = pos[nd.name], main = nd.name === g.main, i = kids.indexOf(nd), below = main ? -1 : (i % rows) + 1;
      s += `<circle cx="${x}" cy="${y}" r="${main ? 12 : 10}" fill="${color(nd)}" stroke="var(--surface)" stroke-width="1.5"><title>${esc(nd.name)} · ${esc(nd.role)}</title></circle>`;
      s += `<text x="${x}" y="${main ? y - 20 : y + 12 + below * 11}" text-anchor="middle" font-size="${main ? 9.5 : fs}" font-weight="${main ? 700 : 500}" fill="var(--ink)" font-family="var(--mono)">${esc(nd.label || nd.name)}</text>`; });
    return s + '</svg>';
  }
  function f2card(c) {
    return `<div class="f2card ${c.cls || ''}"><div class="f2head"><span class="badge-letter">${esc(c.letter)}</span>${esc(c.name)}${c.rel ? `<span class="rel">${esc(c.rel)}</span>` : ''}${c.score != null ? `<span class="score">${c.scoreLabel || 'success'} ${c.score.toFixed(3)}</span>` : ''}</div>` +
      `<div class="f2body"><div><div class="ph">Component graph</div>${graphSvg(c.graph)}${c.files ? `<div class="f2files">${c.files}</div>` : ''}</div><div><div class="ph">${esc(c.codeLabel || 'Pseudocode')}</div><pre class="code">${codeHtml(c.code)}</pre></div></div>` +
      (c.note ? `<p class="f2note">${c.note}</p>` : '') +
      (c.entry ? `<details><summary>Actual entry function · ${esc(c.entry.file)} · ${esc(c.entry.name)}</summary><pre class="code">${esc(c.entry.src)}</pre></details>` : '') + '</div>';
  }
  const FIG2 = [
    { letter: 'a', name: 'anchor', cls: 'a', graph: { main: 'main.py', nodes: [{ name: 'main.py', role: 'orchestrator' }, { name: 'vlm.py', role: 'controller' }], edges: [['main.py', 'vlm.py']] },
      code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    async def step(frame):\n        # frozen VLM emits the move\n        return await «u»vlm.decide«/u»(frame)\n    return step',
      note: 'One frozen VLM emits every move — no perception, no solver of its own.' },
    { letter: 'b', name: 'cand_r004_0', cls: 'b', rel: 'different s from a', graph: { main: 'main.py', nodes: [{ name: 'main.py', role: 'orchestrator' }, { name: 'frame.py', role: 'capture' }, { name: 'sticker.py', role: 'perception' }, { name: 'vlm.py', role: 'controller' }, { name: 'action.py', role: 'solver' }], edges: [['main.py', 'frame.py'], ['main.py', 'sticker.py'], ['main.py', 'vlm.py'], ['main.py', 'action.py'], ['frame.py', 'sticker.py'], ['sticker.py', 'vlm.py'], ['vlm.py', 'action.py']] },
      code: 'def build_agent(ev):\n    ev.prompt = ROLE + «h»READ«/h» + RULES\n    lens = «h»sticker.StickerLens«/h»()\n    solver = action.CubeSolver()\n    async def step(frame):\n        px = «u»frame.capture«/u»()\n        fl = «u»lens.read«/u»(px)\n        state = «u»vlm.identify«/u»(fl)\n        return «u»solver.solve«/u»(state)\n    return step',
      note: 'Reads facelets through a sticker lens, then hands a full solve to action.py.' },
    { letter: 'c', name: 'cand_r004_1', cls: 'c', rel: 'same s as b, different θ', graph: { main: 'main.py', nodes: [{ name: 'main.py', role: 'orchestrator' }, { name: 'frame.py', role: 'capture' }, { name: 'grounding.py', role: 'perception' }, { name: 'vlm.py', role: 'controller' }, { name: 'action.py', role: 'solver' }], edges: [['main.py', 'frame.py'], ['main.py', 'grounding.py'], ['main.py', 'vlm.py'], ['main.py', 'action.py'], ['frame.py', 'grounding.py'], ['grounding.py', 'vlm.py'], ['vlm.py', 'action.py']] },
      code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    eyes = «h»grounding.Eyes«/h»()\n    solver = action.CubeSolver()\n    async def step(frame):\n        px = «u»frame.capture«/u»()\n        obs = «u»eyes.read«/u»(px)\n        plan = «u»vlm.decide«/u»(obs)\n        return «u»solver.step«/u»(plan)\n    return step',
      note: 'Same four-stage pipeline as b; different grounding module and call names.' },
    { letter: 'd', name: 'cand_r005_1', cls: 'd', rel: 'different s and θ from b', graph: { main: 'main.py', nodes: [{ name: 'main.py', role: 'orchestrator' }, { name: 'frame.py', role: 'capture' }, { name: 'vlm.py', role: 'controller' }, { name: 'action.py', role: 'solver' }], edges: [['main.py', 'frame.py'], ['main.py', 'vlm.py'], ['main.py', 'action.py'], ['frame.py', 'vlm.py'], ['vlm.py', 'action.py']], loop: ['action.py', 'vlm.py'], loopLabel: 'belief update' },
      code: 'def build_agent(ev):\n    ev.prompt = ROLE + RULES\n    belief = «h»action.ScramblePosterior«/h»()\n    async def step(frame):\n        if «h»belief.worth_asking«/h»():  # VoI\n            c = «u»vlm.ask«/u»(frame)\n            belief.update(c)\n        return «u»belief.best_move«/u»()\n    return step',
      note: 'No perception module: keeps a belief over the scramble; asks when it pays.' }];
  if ($('#fig2')) $('#fig2').innerHTML = FIG2.map(f2card).join('') + `<div class="f2legend" style="grid-column:1/-1">${Object.keys(F2ROLES).map(r => `<span><i style="background:${F2ROLES[r]}"></i>${r}</span>`).join('')}<span><i class="ul"></i>structure-bearing call — adds a graph edge</span><span><i class="hl"></i>token-only difference — same graph</span></div>`;

  /* ======================================================= case analysis: findings tied to candidates */
  function caseGraph(c) {   // from cases.json: module-level nodes with the release's roles
    const main = (c.modules.find(m => m.main) || c.modules[0]).name;
    const nodes = c.modules.map(m => ({ name: m.name, label: m.name + '.py', role: m.main ? 'orchestrator' : m.role }));
    const edges = c.edges.map(e => [e[0], e[1]]);
    return { main, nodes, edges };
  }
  const CASE_TEXT = {
    case1_n03: { mod: '<code>tools/chart.py</code>: fixed spatial logic in Chart.observe', code: "def act(self, obs, prev_action):\n    self._refresh_legal(...)\n    update_observation(...)\n    chart = «u»chart_mod.parse_map«/u»(...)\n    if self.last_how in ('kick-dir', 'modal'):\n        observe(...)\n    self._rung(...)\n    if action is not None:\n        return self._emit(response, action, how)" },
    case1_n05: { mod: '<code>push_plan</code> in harness.py: a Sokoban BFS planner', code: "def act(self, obs, prev_action):\n    update_observation(...)\n    chart = parse_map(...)\n    if planned is not None:\n        # zero-token call\n        return self.emit(shell, «u»planned«/u», 'push-tape')" },
    case1_n15: { mod: '<code>tools/quest.py</code>: the QuestErrand interaction protocol', code: "def act(self, obs, prev_action):\n    update_observation(...)\n    armed = «u»quest_mod.armed«/u»(...)\n    if armed:\n        ans = prompt(...)\n        if ans is not None:\n            return self._shell(*ans)" },
    case1_n21: { mod: 'recombined from r016_0: the quest and push modules in one dispatch', code: "def act(self, obs, prev_action):\n    for module in self.modules:\n        plan = «u»claim«/u»(...)\n        if plan is not None and _no_call(plan[1]):\n            return self._shell(action, how)" },
    case1_n39: { mod: 'VolleyOwner added to the owner ladder', code: "def act(self, obs, prev_action):\n    tick(...)\n    plan = «u»self.claim_step«/u»(...)\n    if plan is not None:\n        out = self.emit(...)" },
    case1_n47: { mod: 'MeleeOwner added; the arm’s champion', code: "def act(self, obs, prev_action):\n    tick(...)\n    plan = «u»self.claim_step«/u»(...)\n    if plan is not None:\n        out = self.emit(...)" },
    champ_k2: { para: '8-rung VetoBoard', code: "def act(self, obs, prev_action):\n    self._mount(...)\n    frame = parse_frame(...)\n    planner = StepPlanner(...)\n    self._arbitrate(...)\n    if need is not None:\n        response = generate(...)" },
    champ_k4: { para: '9-entry priority owner ladder', code: "def act(self, obs, prev_action):\n    plan = self.claim_step(...)\n    if plan is not None:\n        out = self.emit(...)" },
    champ_k8: { para: 'Situational routing + LLM', code: "def act(self, obs, prev_action):\n    self._classify(...)\n    messages = build_messages(...)\n    response = generate(...)\n    action = self._match(...)" },
    champ_k16: { para: 'Pure compiled symbolic logic, zero LLM calls', code: "def act(self, obs, prev_action):\n    fr = parse_glyph_map(...)\n    c = Quest.armed(...)\n    for solver in (Sokoban, Quest, Chart):\n        got = getattr(solver, 'solve')(...)\n        if got is not None:\n            return got" },
    champ_k32: { para: 'Lexicographic arbiter key', code: "def act(self, obs, prev_action):\n    messages = build_messages(...)\n    response = generate(...)" },
    stall: { code: "def act(self, obs, prev_action):\n    if stall and self.reflections < REFLECT_BUDGET:\n        base = build_messages(...)\n        «h»absorb_reflection«/h»(...)  # iterations spent, no elite bred" },
    overadmit: { code: "def act(self, obs, prev_action):\n    owned = «h»self.reflex«/h»(...)         # overly permissive predicate\n    if owned and owned[0] in legal:\n        return self.reply(*owned)    # overrides the LLM fallback" } };
  function caseCard(key, extra) {
    const c = DATA.cases && DATA.cases[key]; const t = CASE_TEXT[key] || {}; extra = extra || {};
    if (!c) return `<div class="f2card ${extra.cls || ''}"><div class="f2head"><span class="badge-letter">${esc(extra.letter || '?')}</span>${esc(extra.name || key)}</div><div class="f2body"><div><div class="ph">Component graph</div><p class="small muted">Not resolvable from the archived ledger.</p></div><div><div class="ph">Pseudocode</div><pre class="code">${codeHtml(extra.code || t.code || '')}</pre></div></div>${extra.note ? `<p class="f2note">${extra.note}</p>` : ''}</div>`;
    return f2card({ letter: extra.letter || c.display.replace(/[^0-9k₀=]/g, '').slice(0, 3) || 'N', name: `${c.display} · ${c.label}`, cls: extra.cls || '', score: c.score, scoreLabel: 'success',
      graph: caseGraph(c), code: c.pseudo || extra.code || t.code || '', codeLabel: c.pseudo ? 'Pseudocode · entry functions, real arguments' : 'Pseudocode', entry: c.entry,
      note: (extra.note || t.mod || (t.para ? `<b>${esc(t.para)}</b>` : '')) + (c.parent ? ` · parent ${esc(c.parent.replace(/cand_r0*(\d+)_/, 'cand_r$1_'))}${c.parent_score != null ? ` (${c.parent_score.toFixed(3)})` : ''}` : '') });
  }
  function caseBlocks(host) {
    const blocks = [
      { idx: 'Finding 1 · Case 1, the k₀ = 4 arm', h: 'Performance consistently improves through incremental modular edits.',
        finding: 'Success rates rise from 0.275 to 0.850 through incremental additions of deterministic code-owner modules (spatial pathfinding fixes, Sokoban BFS solvers, interaction protocols). Performance growth is primarily driven by MAP-archive recombination, combining dispatch skeletons with byte-identical modules from disparate cell elites rather than direct linear mutations.',
        text: 'The candidates named in §A.9, in evaluation order of the k₀ = 4 arm (N is the position in that arm’s evaluation history).',
        cards: [['case1_n03', { letter: '1' }], ['case1_n05', { letter: '2' }], ['case1_n15', { letter: '3' }], ['case1_n21', { letter: '4' }], ['case1_n39', { letter: '5' }], ['case1_n47', { letter: '6', cls: 'top' }]] },
      { idx: 'Finding 2 · Case 2, five champions', h: 'Discovered optimal harnesses exhibit high structural and algorithmic diversity.',
        finding: 'The champions show high design diversity (pairwise textual similarity below 0.093) and complementary task coverage, achieving 100% success via an oracle selector. Perception converges on shared parsers, while control paradigms diverge across BFS and heuristic search. Performance correlates inversely with token cost: the top-performing harness (k₀ = 16, 0.900) uses traditional algorithms without any LLM calls during evaluation, whereas the most token-expensive elite (k₀ = 32) yields the lowest score (0.400).',
        text: 'The best harness of each initial resolution.',
        cards: [['champ_k2', { letter: '2' }], ['champ_k4', { letter: '4' }], ['champ_k8', { letter: '8' }], ['champ_k16', { letter: '16', cls: 'top' }], ['champ_k32', { letter: '32', cls: 'bad' }]] },
      { idx: 'Finding 3 · Case 3, failure modes', h: 'Search failures stem from excessively fine resolution and wasteful parent selection.',
        finding: 'Uniform selection repeatedly samples low-scoring cells, wasting compute and capping k₀ = 32 performance at 0.400. Overly permissive rules in new modules incorrectly override the LLM fallback logic, causing severe performance drops (0.900 → 0.225).',
        text: '<b>Allocation stalls</b> (arm k₀ = 32, capped at 0.400): candidates N44–N46 spend their iterations absorbing reflections without breeding elites. <b>Over-admitting predicates</b> (arm k₀ = 16): an unsound reflex predicate prematurely overrides the LLM fallback.',
        cards: [['fail_k32_n44', { letter: '44', cls: 'bad' }], ['fail_k32_n45', { letter: '45', cls: 'bad' }], ['fail_k32_n46', { letter: '46', cls: 'bad' }], ['fail_k16_n43', { letter: '43', cls: 'bad', note: 'The paper\u2019s over-admitting regression in the k₀ = 16 arm: a chart plus a router now decide and the model is only the fallback. Running best 0.900 at N = 41; this candidate 0.250 (the paper rounds the drop to 0.225)' }]] },
      { idx: 'Finding 4 · Case 4, map dynamics', h: 'Dynamic map partitioning focuses search on high-potential regions.',
        finding: 'All major breakthroughs originate from newly subdivided cells (Cell 23 yielding the 0.900 champion). The system self-corrects by merging uninformative sub-trees while expanding resolution in high-variance regions.',
        text: '<span class="cellnote"><span><b>Cell 3</b>depth-1 split in round 1 on a score spread of 0.05; the sub-elites failed to outperform the parent, merged back in round 2</span><span><b>Cell 21</b>partitioned in round 5, producing cand_r052 (0.600) and tools/quest.py</span><span><b>Cell 23</b>depth-2 high-variance partition in round 8; its children averaged 0.756 and yielded the champion</span></span>',
        cards: [['cell21_r52', { letter: '21', note: 'Cell 21 child; introduces <code>tools/quest.py</code>' }], ['cell23_r64', { letter: '23', cls: 'top', note: 'Cell 23 child, cand_r064; the 0.900 champion cand_r068 reuses its stage table' }]] }];
    host.innerHTML = blocks.map(b => `<div class="case-block"><div class="finding"><div><span class="idx">${esc(b.idx)}</span><h3>${esc(b.h)}</h3><p>${esc(b.finding)}</p></div><div class="case-text">${b.text}</div></div><div class="case-cards">${b.cards.map(([k, x]) => caseCard(k, x)).join('')}</div></div>`).join('');
  }
  if ($('#case-blocks')) caseBlocks($('#case-blocks'));

  /* ======================================================= floating contents: scroll-spy, hide/show */
  (function () {
    const toc = $('.sidetoc'), closeB = $('.sidetoc-close'), openB = $('.sidetoc-open');
    if (toc && closeB && openB) {
      const setHidden = h => { toc.classList.toggle('hidden', h); openB.hidden = !h; try { localStorage.setItem('toc-hidden', h ? '1' : '0'); } catch (e) {} };
      closeB.addEventListener('click', () => setHidden(true)); openB.addEventListener('click', () => setHidden(false));
      try { if (localStorage.getItem('toc-hidden') === '1') setHidden(true); } catch (e) {}
    }
    const links = $$('.sidetoc a'); if (!links.length) return;
    const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    let current = null;
    const update = () => { const y = window.scrollY + 120; let best = null; targets.forEach(t => { if (t.offsetTop <= y) best = t; });
      if (best !== current) { current = best; links.forEach(a => a.classList.toggle('on', best && a.getAttribute('href') === '#' + best.id)); } };
    window.addEventListener('scroll', update, { passive: true }); update();
  })();

  /* ======================================================= equations (KaTeX, loaded before this script) */
  if (window.renderMathInElement) renderMathInElement(document.body, { delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }], throwOnError: false });


  /* ======================================================= Table 2: QD-score and coverage across k0 */
  const T2 = { k0: [2, 4, 8, 16, 32], series: [
    { label: 'Meta-Harness', color: BCOL['Meta-Harness'], qd: [0.93, 1.30, 1.46, 2.27, 2.20], cov: [100, 70, 45, 32, 16] },
    { label: 'DGM', color: BCOL['DGM'], qd: [0.96, 1.48, 1.62, 2.14, 1.97], cov: [100, 70, 45, 29, 12] },
    { label: 'GEPA', color: BCOL['GEPA'], qd: [0.43, 0.49, 0.70, 0.83, 1.15], cov: [100, 70, 57, 32, 21] },
    { label: 'ShinkaEvolve', color: BCOL['ShinkaEvolve'], qd: [0.36, 0.36, 0.46, 0.46, 0.46], cov: [90, 50, 30, 20, 8] },
    { label: 'OpenEvolve', color: BCOL['OpenEvolve'], qd: [0.27, 0.29, 0.29, 0.29, 0.29], cov: [90, 55, 25, 15, 9] },
    { label: 'Harness-MAP adaptive', color: 'var(--accent)', w: 2.6, qd: [1.16, 1.48, 2.43, 3.51, 7.25], cov: [100, 70, 64, 58, 57] },
    { label: 'Harness-MAP fixed', color: 'var(--accent)', w: 1.8, dash: '7 4', qd: [1.15, 1.40, 2.38, 3.23, 7.89], cov: [100, 65, 55, 52, 52] },
    { label: 'Harness-MAP hierarchical', color: 'var(--accent)', w: 1.8, dash: '2 4', qd: [1.25, 1.22, 2.30, 2.71, 6.68], cov: [100, 65, 57, 42, 49] }] };
  function catLineChart(host, cfg) {
    const W = cfg.width, H = Math.max(240, Math.min(360, Math.round(W * 0.62))), m = { l: 44, r: 16, t: 26, b: 40 }, fs = 11;
    const n = cfg.cats.length, xs = i => m.l + (i + 0.5) / n * (W - m.l - m.r), ys = v => m.t + (1 - v / cfg.ymax) * (H - m.t - m.b);
    host.innerHTML = '';
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.title }, host); svg.style.fontFamily = 'inherit'; svg.style.overflow = 'visible';
    svgEl('text', { x: m.l, y: 15, 'font-size': fs + 1.5, 'font-weight': 700, fill: 'var(--ink)' }, svg).textContent = cfg.title;
    cfg.yticks.forEach(v => { svgEl('line', { x1: m.l, x2: W - m.r, y1: ys(v), y2: ys(v), stroke: 'var(--line)' }, svg); svgEl('text', { x: m.l - 6, y: ys(v) + 3.5, 'text-anchor': 'end', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = v; });
    cfg.cats.forEach((c, i) => svgEl('text', { x: xs(i), y: H - m.b + 16, 'text-anchor': 'middle', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = c);
    svgEl('text', { x: (m.l + W - m.r) / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': fs, fill: 'var(--muted)' }, svg).textContent = cfg.xlabel;
    cfg.series.forEach(s => {
      const v = s[cfg.key];
      svgEl('path', { d: v.map((y, i) => (i ? 'L' : 'M') + xs(i) + ',' + ys(y)).join(' '), fill: 'none', stroke: s.color, 'stroke-width': s.w || 1.5, 'stroke-dasharray': s.dash || 'none', 'stroke-linejoin': 'round' }, svg);
      v.forEach((y, i) => svgEl('circle', { cx: xs(i), cy: ys(y), r: s.w > 2 ? 3.4 : 2.6, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 1.2 }, svg));
    });
    const vline = svgEl('line', { x1: 0, x2: 0, y1: m.t, y2: ys(0), stroke: 'var(--ink)', 'stroke-opacity': .5, opacity: 0 }, svg);
    const hit = svgEl('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    const tip = el('div', 'tip'); host.appendChild(tip);
    hit.addEventListener('mousemove', ev => {
      const bb = svg.getBoundingClientRect(); const px = (ev.clientX - bb.left) * (W / bb.width);
      const i = Math.max(0, Math.min(n - 1, Math.floor((px - m.l) / (W - m.l - m.r) * n)));
      vline.setAttribute('x1', xs(i)); vline.setAttribute('x2', xs(i)); vline.setAttribute('opacity', 1);
      const rows = cfg.series.map(s => ({ s, v: s[cfg.key][i] })).sort((a, b) => b.v - a.v);
      tip.innerHTML = `<b>${cfg.catLabel} = ${cfg.cats[i]}</b>` + rows.map(r => `<div><i style="background:${r.s.color}${r.s.dash ? ';border-radius:0' : ''}"></i>${esc(r.s.label)}<span>${cfg.fmt(r.v)}</span></div>`).join('');
      const hb = host.getBoundingClientRect(); const sx = bb.left - hb.left + xs(i) * (bb.width / W); const left = sx > hb.width * 0.58;
      tip.style.left = (sx + (left ? -12 : 12)) + 'px'; tip.style.top = (ev.clientY - hb.top + 12) + 'px'; tip.classList.toggle('left', left); tip.classList.add('on');
    });
    hit.addEventListener('mouseleave', () => { vline.setAttribute('opacity', 0); tip.classList.remove('on'); });
  }
  function qdCharts(host) {
    function render() {
      host.innerHTML = ''; const w = host.clientWidth || 900; const cw = w > 760 ? Math.floor((w - 12) / 2) - 20 : w - 20;
      [['qd', 'QD-score (sum of elite scores)', 8, [0, 2, 4, 6, 8], v => v.toFixed(2)], ['cov', 'Coverage (% of cells occupied)', 100, [0, 25, 50, 75, 100], v => v + '%']].forEach(([key, title, ymax, yt, fmt]) => {
        const h = el('div', 'chart'); host.appendChild(h);
        catLineChart(h, { width: cw, title, key, ymax, yticks: yt, fmt, cats: T2.k0, catLabel: 'k₀', xlabel: 'initial map resolution k₀', series: T2.series });
      });
      const sw = s => `<i class="line" style="background:${s.dash === '7 4' ? 'repeating-linear-gradient(90deg,' + s.color + ' 0 6px,transparent 6px 9px)' : s.dash === '2 4' ? 'repeating-linear-gradient(90deg,' + s.color + ' 0 2px,transparent 2px 5px)' : s.color}"></i>`;
      const lg = el('div', 'chart-legend', T2.series.map(s => `<span>${sw(s)}${esc(s.label)}</span>`).join(''));
      lg.style.gridColumn = '1 / -1'; host.appendChild(lg);
    }
    render(); let lastW = host.clientWidth; onResize(() => { if (host.clientWidth && Math.abs(host.clientWidth - lastW) > 30) { lastW = host.clientWidth; render(); } });
  }
  if ($('#qd-charts')) qdCharts($('#qd-charts'));

  /* ======================================================= Table 5: generalization as dumbbells (search -> held-out) */
  const T5 = { rows: [
    { name: 'Qwen3-VL-30B, no search', short: 'no search', group: 'direct', snake: [10.7, 0.0], easy: [32.0, 32.5], hard: [29.0, 27.5], mhA: [10.0, 10.0], mhB: [10.0, 0.0] },
    { name: 'Meta-Harness', group: 'base', snake: [100, 100], easy: [39.0, 40.0], hard: [36.0, 37.5], mhA: [75.0, 67.5], mhB: [75.0, 72.5] },
    { name: 'GEPA', group: 'base', snake: [10, 5], easy: [41.0, 52.5], hard: [33.3, 34.0], mhA: [30, 20], mhB: [30, 30] },
    { name: 'DGM', group: 'base', snake: [100, 100], easy: [40, 40], hard: [38.5, 45.0], mhA: [72.5, 55.0], mhB: [72.5, 65.0] },
    { name: 'ShinkaEvolve', group: 'base', snake: [8, 5], easy: [40.5, 40.0], hard: [34.0, 42.5], mhA: [20, 10], mhB: [20, 27.5] },
    { name: 'OpenEvolve', group: 'base', snake: [10, 5], easy: [36.5, 30.0], hard: [37.0, 35.0], mhA: [27.5, 17.5], mhB: [27.5, 15.0] },
    { name: 'Harness-MAP k₀ = 2', short: 'k₀ = 2', group: 'ours', snake: [100, 100], easy: [46.5, 35.0], hard: [38.0, 32.5], mhA: [75, 57.5], mhB: [75, 62.5] },
    { name: 'Harness-MAP k₀ = 4', short: 'k₀ = 4', group: 'ours', snake: [100, 100], easy: [44.0, 50.0], hard: [55.0, 60.0], mhA: [85, 70], mhB: [85, 57.5] },
    { name: 'Harness-MAP k₀ = 8', short: 'k₀ = 8', group: 'ours', snake: [100, 100], easy: [45.5, 45.0], hard: [41.0, 25.0], mhA: [82.5, 75], mhB: [82.5, 60] },
    { name: 'Harness-MAP k₀ = 16', short: 'k₀ = 16', group: 'ours', snake: [100, 100], easy: null, hard: null, mhA: [90, 72.5], mhB: [90, 47.5] },
    { name: 'Harness-MAP k₀ = 32', short: 'k₀ = 32', group: 'ours', snake: [100, 100], easy: null, hard: null, mhA: [40, 35], mhB: [40, 50] }],
    panels: [{ id: 'snake', title: 'SpatialWorld Snake · SR', held: 'unseen seeds' }, { id: 'easy', title: 'SimWorld-MMNav easy · SubSR', held: '10 unseen maps' }, { id: 'hard', title: 'SimWorld-MMNav hard · SubSR', held: '10 unseen maps' }, { id: 'mhA', title: 'MiniHack · holdout A', held: 'unseen seeds, same tasks' }, { id: 'mhB', title: 'MiniHack · holdout B', held: 'eight unseen tasks' }] };
  function genPanel(h, p, W, small) {
    const rows = T5.rows.filter(r => r[p.id]), nrows = Math.max(...T5.panels.map(q => T5.rows.filter(r => r[q.id]).length));
    const rh = small ? 18 : 24, m = { l: small ? 78 : 110, r: 14, t: 44, b: 28 }, H = m.t + nrows * rh + m.b, fs = small ? 9.5 : 11.5;
    const xs = v => m.l + v / 100 * (W - m.l - m.r);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${p.title}: search-split score and held-out score per method` }, h); svg.style.fontFamily = 'inherit'; svg.style.overflow = 'visible';
    svgEl('text', { x: 4, y: 14, 'font-size': fs + 1.5, 'font-weight': 700, fill: 'var(--ink)' }, svg).textContent = p.title;
    svgEl('text', { x: 4, y: 29, 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = `○ search split   ● ${p.held}`;
    [0, 50, 100].forEach(v => { svgEl('line', { x1: xs(v), x2: xs(v), y1: m.t - 6, y2: H - m.b + 2, stroke: 'var(--line)' }, svg); svgEl('text', { x: xs(v), y: H - m.b + 14, 'text-anchor': 'middle', 'font-size': fs - 1, fill: 'var(--muted)' }, svg).textContent = v; });
    const tip = el('div', 'tip'); h.appendChild(tip);
    rows.forEach((r, i) => {
      const y = m.t + i * rh + rh / 2, [a, b] = r[p.id], col = r.group === 'ours' ? 'var(--accent)' : r.group === 'base' ? 'var(--ink-2)' : 'var(--muted)';
      svgEl('text', { x: m.l - 8, y: y + 3.5, 'text-anchor': 'end', 'font-size': fs, 'font-weight': r.group === 'ours' ? 700 : 400, fill: r.group === 'ours' ? 'var(--accent-ink)' : 'var(--ink-2)' }, svg).textContent = r.short || r.name;
      svgEl('line', { x1: xs(a), x2: xs(b), y1: y, y2: y, stroke: col, 'stroke-width': 2, 'stroke-opacity': .55 }, svg);
      svgEl('circle', { cx: xs(a), cy: y, r: small ? 3.8 : 5, fill: 'var(--surface)', stroke: col, 'stroke-width': 2 }, svg);
      svgEl('circle', { cx: xs(b), cy: y, r: small ? 3.8 : 5, fill: col }, svg);
      const hit = svgEl('rect', { x: 0, y: y - rh / 2, width: W - m.r, height: rh, fill: 'transparent', tabindex: 0, role: 'img', 'aria-label': `${r.name}: search ${a}, held-out ${b}` }, svg);
      const show = () => { tip.innerHTML = `<b>${esc(r.name)}</b><div>search split<span>${a.toFixed(1)}</span></div><div>${esc(p.held)}<span>${b.toFixed(1)}</span></div><div>change<span>${(b - a) >= 0 ? '+' : ''}${(b - a).toFixed(1)}</span></div>`;
        const bb = svg.getBoundingClientRect(), hb = h.getBoundingClientRect(); const sx = bb.left - hb.left + xs(Math.max(a, b)) * (bb.width / W); const left = sx > hb.width * 0.55;
        tip.style.left = (sx + (left ? -10 : 10)) + 'px'; tip.style.top = (bb.top - hb.top + y * (bb.height / H) - 10) + 'px'; tip.classList.toggle('left', left); tip.classList.add('on'); };
      hit.addEventListener('mouseenter', show); hit.addEventListener('focus', show); hit.addEventListener('mouseleave', () => tip.classList.remove('on')); hit.addEventListener('blur', () => tip.classList.remove('on'));
    });
  }
  function genCharts(host) {
    function render() {
      host.innerHTML = ''; const w = host.clientWidth || 900; const cols = gridCols(w, 5); host.style.gridTemplateColumns = `repeat(${cols},1fr)`;
      const W = Math.floor((w - 12 * (cols - 1)) / cols) - 20, small = cols > 2;
      T5.panels.forEach(p => { const h = el('div', 'chart'); host.appendChild(h); genPanel(h, p, Math.max(200, W), small); zoomable(h, `${p.title} · search → held-out`, (body, bw) => genPanel(body, p, bw, false)); });
      const tools = el('div', 'charts-tools'); tools.style.gridColumn = '1 / -1'; const b = el('button', '', 'Enlarge all 5 panels'); b.type = 'button';
      b.addEventListener('click', () => openLightbox('Generalization · search split → held-out', (body, bw) => T5.panels.forEach(p => { const h = el('div', 'chart'); body.appendChild(h); genPanel(h, p, bw, false); }), true)); tools.appendChild(b); host.appendChild(tools);
    }
    render(); let lastW = host.clientWidth; onResize(() => { if (host.clientWidth && Math.abs(host.clientWidth - lastW) > 30) { lastW = host.clientWidth; render(); } });
  }
  if ($('#gen-charts')) genCharts($('#gen-charts'));

  /* ======================================================= harness anatomy: modules, roles, entry function (evolution packs) */
  const ROLE_KEYS = ['controller', 'policy', 'recovery', 'perception', 'parse', 'spatial', 'prompt', 'toolcall', 'memory', 'validity', 'data', 'logic', 'tool'];
  const roleColor = r => `var(--r-${ROLE_KEYS.includes(r) ? r : 'logic'})`;
  function anatomyPanel(host, rows, pack, metric) {
    const A = DATA.anatomy && DATA.anatomy[pack];
    if (!host || !A) { if (host) host.remove(); return { show() {} }; }
    function show(i) {
      const a = A[i], r = rows[i];
      if (!a) { host.innerHTML = `<div class="f2card"><div class="f2head"><span class="badge-letter">#${i}</span>${esc(r.label)}</div><p class="f2note">No source is available for this harness.</p></div>`; return; }
      const g = caseGraph(a), roles = Array.from(new Set(g.nodes.map(n => n.role)));
      const diff = r.diff ? `diff vs parent: ${r.diff.files} file${r.diff.files === 1 ? '' : 's'}, +${r.diff.insertions} / −${r.diff.deletions}` : '';
      host.innerHTML = f2card({ letter: '#' + i, name: r.label, cls: r.best ? 'top' : '', score: r.score, scoreLabel: metric || 'score', graph: g,
        code: a.entry ? a.entry.src : '', codeLabel: a.entry ? `Entry function · ${a.entry.file} · ${a.entry.name}` : 'Source',
        files: a.modules.map(m => `<span>${esc(m.file)} <i>${m.lines}</i></span>`).join(''),
        note: `${esc(a.heading || '')}${a.heading && diff ? ' · ' : ''}${esc(diff)}` }) +
        `<div class="f2legend">${roles.map(ro => `<span><i style="background:${F2ROLES[ro] || `var(--r-${ro})`}"></i>${esc(ro)}</span>`).join('')}</div>`;
    }
    return { show };
  }

  /* ======================================================= case analysis: the k0 = 4 arm module by module, and five champions */
  const LADDER = [
    { cand: 'candidate N03', score: 0.350, mod: '<code>tools/chart.py</code>: fixed spatial logic in Chart.observe', code: "def act(self, obs, prev_action):\n    self._refresh_legal(...)\n    update_observation(...)\n    chart = chart_mod.parse_map(...)\n    if self.last_how in ('kick-dir', 'modal'):\n        observe(...)\n    self._rung(...)\n    if action is not None:\n        return self._emit(response, action, how)" },
    { cand: 'candidate N05', score: 0.600, mod: '<code>push_plan</code> in harness.py: a Sokoban BFS planner', code: "def act(self, obs, prev_action):\n    update_observation(...)\n    chart = parse_map(...)\n    if planned is not None:\n        # zero-token call\n        return self.emit(shell, planned, 'push-tape')" },
    { cand: 'candidate N15', score: 0.720, mod: '<code>tools/quest.py</code>: the QuestErrand interaction protocol', code: "def act(self, obs, prev_action):\n    update_observation(...)\n    armed = quest_mod.armed(...)\n    if armed:\n        ans = prompt(...)\n        if ans is not None:\n            return self._shell(*ans)" },
    { cand: 'candidate N21', score: 0.775, mod: 'recombined from r016_0: the quest and push modules in one dispatch', code: "def act(self, obs, prev_action):\n    for module in self.modules:\n        plan = claim(...)\n        if plan is not None and _no_call(plan[1]):\n            return self._shell(action, how)" },
    { cand: 'candidates N39–N47', score: 0.850, from: 0.800, mod: 'VolleyOwner and MeleeOwner added to the owner ladder', code: "def act(self, obs, prev_action):\n    tick(...)\n    plan = self.claim_step(...)\n    if plan is not None:\n        out = self.emit(...)" }];
  const CHAMPS = [
    { k: 2, score: 0.750, para: '8-rung VetoBoard', code: "def act(self, obs, prev_action):\n    self._mount(...)\n    frame = parse_frame(...)\n    planner = StepPlanner(...)\n    self._arbitrate(...)\n    if need is not None:\n        response = generate(...)" },
    { k: 4, score: 0.850, para: '9-entry priority owner ladder', code: "def act(self, obs, prev_action):\n    plan = self.claim_step(...)\n    if plan is not None:\n        out = self.emit(...)" },
    { k: 8, score: 0.825, para: 'Situational routing + LLM', code: "def act(self, obs, prev_action):\n    self._classify(...)\n    messages = build_messages(...)\n    response = generate(...)\n    action = self._match(...)" },
    { k: 16, score: 0.900, para: 'Pure compiled symbolic logic', llm: 'zero LLM calls', zero: true, top: true, code: "def act(self, obs, prev_action):\n    fr = parse_glyph_map(...)\n    c = Quest.armed(...)\n    for solver in (Sokoban, Quest, Chart):\n        got = getattr(solver, 'solve')(...)\n        if got is not None:\n            return got" },
    { k: 32, score: 0.400, para: 'Lexicographic arbiter key', llm: 'most token-expensive', code: "def act(self, obs, prev_action):\n    messages = build_messages(...)\n    response = generate(...)" }];
  if ($('#case-ladder')) $('#case-ladder').innerHTML = LADDER.map(r => `<div class="rung"><span class="cand">${esc(r.cand)}</span><span class="score">${r.score.toFixed(3)}${r.from ? `<small>from ${r.from.toFixed(3)}</small>` : ''}</span><div class="bar"><i style="width:${r.score * 100}%"></i></div><span class="mod">${r.mod}</span><pre class="code">${esc(r.code)}</pre></div>`).join('');
  if ($('#case-champions')) $('#case-champions').innerHTML = CHAMPS.map(c => `<div class="champ${c.top ? ' top' : ''}"><span class="k">k₀ = ${c.k}</span><div class="score" style="color:${c.top ? 'var(--accent-ink)' : 'var(--ink)'}">${c.score.toFixed(3)}</div><div class="para">${esc(c.para)}</div>${c.llm ? `<span class="llm${c.zero ? ' zero' : ''}">${esc(c.llm)}</span>` : ''}<pre class="code">${esc(c.code)}</pre></div>`).join('');

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
      const an = anatomyPanel($('#anat-balrog'), LB.rows, 'balrog', 'success');
      const pl = player($('#player-balrog'), VB, {
        caption: (e, i) => `<b>#${i} ${esc(e.label)}</b> · search success ${fmt(e.score)} · MazeWalk-15x15 episode 00: ${esc(e.outcome)} ${badge(e, LB.rows[i])}`,
        onChange: i => { if (chart) chart.setSelected(i, true); an.show(i); } });
      chart = lineageChart($('#chart-balrog'), LB, { metric: 'success', ylabel: 'success on the 40 search episodes', clickable: true,
        hint: 'Hover a harness for its score and diff; click it to see its structure and watch the episode it played.', onSelect: i => pl.set(i, true) });
      const bi = LB.rows.findIndex(r => r.best); chart.setSelected(bi, true); pl.set(bi, false);
    }
    const gameMeta = { maze3d_pro: ['Maze3D-Pro', 'level 7'], block3d: ['Block3D', 'level 12'], maze: ['Maze', 'level 1'], snake: ['Snake', 'seed 20'], rubik: ['Rubik', null] };
    Object.keys(gameMeta).forEach(g => {
      const L = DATA.lineages['games_' + g]; const host = $('#chart-' + g); if (!L || !host) return;
      const entries = (DATA.videos.games[g] || []).filter(e => e.i != null);
      const ph = $('#player-' + g);
      const an = anatomyPanel($('#anat-' + g), L.rows, 'games_' + g, 'score');
      const bi = L.rows.findIndex(r => r.best);
      if (ph && entries.length === L.rows.length) {
        let chart;
        const pl = player(ph, entries, {
          caption: (e, i) => `<b>#${i} ${esc(e.label)}</b> · search score ${fmt(e.score)} · ${gameMeta[g][0]} ${gameMeta[g][1]}: ` +
            (e.episode_score === 1 ? `solved in ${e.steps} steps` : `not solved in ${e.steps} steps`) + ' ' + badge(e, L.rows[i]),
          onChange: i => { if (chart) chart.setSelected(i, true); an.show(i); } });
        chart = lineageChart(host, L, { metric: 'score', ylabel: 'score on the search levels', clickable: true,
          hint: 'Hover a harness for its score and diff; click it to see its structure and watch the level it played.', onSelect: i => pl.set(i, true) });
        chart.setSelected(bi, true); pl.set(bi, false);
      } else {
        const chart = lineageChart(host, L, { metric: 'score', ylabel: 'score on the search levels', clickable: true,
          hint: 'Hover a harness for its score and diff; click it to see its structure.', onSelect: i => an.show(i) });
        chart.setSelected(bi, true); an.show(bi);
      }
    });
    const LN = DATA.lineages.nav_hard;
    if (LN && $('#chart-nav')) {
      const an = anatomyPanel($('#anat-nav'), LN.rows, 'nav_hard', 'SubtaskSR');
      const chart = lineageChart($('#chart-nav'), LN, { metric: 'SubtaskSR', ylabel: 'Subtask SR on the 50 search tasks', clickable: true,
        hint: 'Hover a harness for its score and diff; click it to see its structure.', onSelect: i => an.show(i) });
      const bi = LN.rows.findIndex(r => r.best); chart.setSelected(bi, true); an.show(bi);
    }
    const LE = DATA.lineages.nav_easy;
    if (LE && $('#chart-nav-easy')) lineageChart($('#chart-nav-easy'), LE, { metric: 'SubtaskSR', ylabel: 'Subtask SR on the 50 search tasks', clickable: false });
  }
})();
