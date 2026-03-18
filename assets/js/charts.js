/* CashFlow — Charts v4.0
   Pure SVG/HTML chart engine. No external dependencies.
   Charts: Bar, Line/Area, Donut, Heatmap, Sparkline
*/
'use strict';

const Charts = (() => {

  const COLORS = ['#f05672','#f0c14b','#2dd98f','#4e8ef7','#a78bfa','#fb923c','#f472b6','#7dd3fc','#34d399','#60a5fa','#fbbf24','#818cf8'];
  const C_INC  = '#2dd98f';
  const C_EXP  = '#f05672';
  const C_ACC  = '#f0c14b';
  const GRID   = 'rgba(255,255,255,.05)';
  const AXIS   = 'rgba(255,255,255,.15)';

  /* ── helpers ── */
  function _fmtAmt(n) {
    const abs = Math.abs(n);
    if (abs >= 1e6) return (n/1e6).toFixed(1)+'M';
    if (abs >= 1e3) return (n/1e3).toFixed(1)+'K';
    return n.toFixed(0);
  }

  function _nice(max, steps=5) {
    if (max <= 0) return { max: 100, step: 20 };
    const raw  = max / steps;
    const mag  = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1,2,2.5,5,10].map(f => f*mag).find(v => v >= raw) || raw;
    return { max: nice * steps, step: nice };
  }

  /* ════════════════════════════════════════
     BAR CHART (grouped, with axis + grid)
  ════════════════════════════════════════ */
  function bar(containerId, data, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el || !data?.length) return;

    const {
      height    = 180,
      barWidth  = 0.6,
      showGrid  = true,
      showAxis  = true,
      animate   = true,
      colors    = [C_INC, C_EXP],
      keys      = ['inc','exp'],
      tooltip   = true,
    } = opts;

    const W       = el.offsetWidth || 400;
    const padL    = 42, padR = 8, padT = 12, padB = 28;
    const innerW  = W - padL - padR;
    const innerH  = height - padT - padB;
    const n       = data.length;
    const barW    = (innerW / n) * barWidth;
    const gap     = (innerW / n) * (1 - barWidth) / 2;

    const maxVal  = Math.max(...data.map(d => Math.max(...keys.map(k => d[k]||0))), 1);
    const { max: niceMax, step } = _nice(maxVal);

    let svg = `<svg viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" style="overflow:visible" role="img" aria-label="Bar chart">`;

    // Grid lines + Y labels
    if (showGrid || showAxis) {
      const gridSteps = Math.ceil(niceMax / step);
      for (let i = 0; i <= gridSteps; i++) {
        const val = i * step;
        const y   = padT + innerH - (val / niceMax) * innerH;
        if (showGrid && i > 0) svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
        if (showAxis) svg += `<text x="${padL-5}" y="${y+4}" text-anchor="end" font-size="9" fill="${'rgba(255,255,255,.4)'}">
          ${_fmtAmt(val)}</text>`;
      }
    }

    // X axis line
    svg += `<line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="${AXIS}" stroke-width="1"/>`;

    // Bars
    data.forEach((d, i) => {
      const groupX = padL + i * (innerW / n) + gap;

      keys.forEach((k, ki) => {
        const val   = d[k] || 0;
        const hPx   = (val / niceMax) * innerH;
        const x     = groupX + ki * (barW / keys.length);
        const w     = (barW / keys.length) - 1.5;
        const y     = padT + innerH - hPx;
        const color = colors[ki] || COLORS[ki];

        if (val > 0) {
          const animDur  = animate ? '0.6s' : '0s';
          const animDelay= animate ? `${i * 0.04}s` : '0s';
          // Use CSS animation via a clip-path trick (native SVG animateTransform)
          svg += `<rect x="${x}" y="${y}" width="${w}" height="${hPx}" rx="3" fill="${color}"
            fill-opacity="0.9"
            style="transform-origin:${x+w/2}px ${padT+innerH}px"
            ${animate ? `class="chart-bar-anim" style="animation:barRise ${animDur} ${animDelay} var(--ease) both"` : ''}>
            <title>${d.label || ''}: ${Store.fmt(val)}</title>
          </rect>`;
        }
      });

      // X label
      svg += `<text x="${groupX + barW/2}" y="${padT+innerH+16}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.4)">${h(d.label||'')}</text>`;
    });

    svg += '</svg>';

    // Inject animation keyframe if not present
    if (animate && !document.getElementById('cf-chart-anim')) {
      const style = document.createElement('style');
      style.id = 'cf-chart-anim';
      style.textContent = `@keyframes barRise{from{transform:scaleY(0)}to{transform:scaleY(1)}}.chart-bar-anim{transform-box:fill-box;transform-origin:bottom}`;
      document.head.appendChild(style);
    }

    el.innerHTML = svg;
  }

  /* ════════════════════════════════════════
     LINE / AREA CHART
  ════════════════════════════════════════ */
  function line(containerId, data, opts = {}) {
    const el = document.getElementById(containerId);
    if (!el || !data?.length) return;

    const {
      height  = 160,
      keys    = ['exp'],
      colors  = [C_EXP, C_INC],
      area    = true,
      smooth  = true,
      dots    = true,
      animate = true,
      showGrid = true,
    } = opts;

    const W      = el.offsetWidth || 400;
    const padL   = 42, padR = 12, padT = 12, padB = 26;
    const innerW = W - padL - padR;
    const innerH = height - padT - padB;
    const n      = data.length;
    if (n < 2) return;

    const maxVal = Math.max(...data.map(d => Math.max(...keys.map(k => d[k]||0))), 1);
    const { max: niceMax, step } = _nice(maxVal);

    let svg = `<svg viewBox="0 0 ${W} ${height}" width="${W}" height="${height}" style="overflow:visible" role="img" aria-label="Line chart">`;

    // Grid
    if (showGrid) {
      const gridSteps = Math.ceil(niceMax / step);
      for (let i = 0; i <= gridSteps; i++) {
        const val = i * step;
        const y   = padT + innerH - (val / niceMax) * innerH;
        svg += `<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="${GRID}" stroke-width="1"/>`;
        svg += `<text x="${padL-4}" y="${y+4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,.35)">${_fmtAmt(val)}</text>`;
      }
    }

    svg += `<line x1="${padL}" y1="${padT+innerH}" x2="${W-padR}" y2="${padT+innerH}" stroke="${AXIS}" stroke-width="1"/>`;

    keys.forEach((k, ki) => {
      const color  = colors[ki] || COLORS[ki];
      const points = data.map((d, i) => {
        const x = padL + (i / (n-1)) * innerW;
        const y = padT + innerH - ((d[k]||0) / niceMax) * innerH;
        return [x, y];
      });

      // Path
      let d_attr = '';
      if (smooth && points.length > 2) {
        d_attr = `M ${points[0][0]} ${points[0][1]}`;
        for (let i = 1; i < points.length; i++) {
          const [x0,y0] = points[i-1], [x1,y1] = points[i];
          const cx = (x0+x1)/2;
          d_attr += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
        }
      } else {
        d_attr = points.map((p,i) => (i===0?'M':'L') + p[0]+' '+p[1]).join(' ');
      }

      // Area fill
      if (area) {
        const areaPath = d_attr + ` L ${points[points.length-1][0]} ${padT+innerH} L ${points[0][0]} ${padT+innerH} Z`;
        svg += `<defs><linearGradient id="lg${ki}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>`;
        svg += `<path d="${areaPath}" fill="url(#lg${ki})"/>`;
      }

      // Line
      const totalLen = Math.sqrt(innerW*innerW + innerH*innerH) * 2;
      svg += `<path d="${d_attr}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        ${animate ? `stroke-dasharray="${totalLen}" stroke-dashoffset="${totalLen}" style="animation:lineGrow 0.8s ${ki*0.1}s var(--ease) forwards"` : ''}/>`;

      // Dots
      if (dots) {
        points.forEach(([x,y]) => {
          svg += `<circle cx="${x}" cy="${y}" r="3" fill="${color}" stroke="var(--s1)" stroke-width="1.5" opacity="0.9"/>`;
        });
      }
    });

    // X Labels
    data.forEach((d, i) => {
      if (n <= 12 || i % Math.ceil(n/12) === 0) {
        const x = padL + (i/(n-1)) * innerW;
        svg += `<text x="${x}" y="${padT+innerH+16}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,.35)">${h(d.label||'')}</text>`;
      }
    });

    svg += '</svg>';

    // Inject line animation
    if (animate && !document.getElementById('cf-line-anim')) {
      const style = document.createElement('style');
      style.id    = 'cf-line-anim';
      style.textContent = `@keyframes lineGrow{to{stroke-dashoffset:0}}`;
      document.head.appendChild(style);
    }

    el.innerHTML = svg;
  }

  /* ════════════════════════════════════════
     DONUT / PIE CHART (animated on mount)
  ════════════════════════════════════════ */
  function donut(data, label = '', size = 130) {
    const r = size * 0.37, cx = size/2, cy = size/2, sw = size * 0.14;
    const circ  = 2 * Math.PI * r;
    const total = data.reduce((s, d) => s + (d.value||0), 0);

    if (!total) {
      return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--t2)" font-size="10">${h(t('no_data'))}</text>
      </svg>`;
    }

    let offset = -(circ / 4);
    let slices  = '';
    const id = 'donut_' + Math.random().toString(36).slice(2,6);

    data.forEach((d, i) => {
      const pct  = (d.value||0) / total;
      const dash = pct * circ, gap = circ - dash;
      const delay = i * 0.05;
      slices += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${h(d.color)}" stroke-width="${sw}"
        stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
        stroke-dashoffset="${(circ + offset).toFixed(2)}"
        style="transition:stroke-dashoffset 0s; animation:donutSpin_${id} 0.7s ${delay}s var(--ease) forwards">
        <title>${h(d.label)}: ${h(Store.fmt(d.value))}</title>
      </circle>`;
      offset -= dash;
    });

    // Inject donut animation (unique per instance)
    if (!document.getElementById('cf-donut-' + id)) {
      const style = document.createElement('style');
      style.id    = 'cf-donut-' + id;
      style.textContent = `@keyframes donutSpin_${id}{from{stroke-dashoffset:${circ};opacity:0}to{opacity:1}}`;
      document.head.appendChild(style);
    }

    const totalFmt = Store.fmt(total);
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Donut chart, total ${totalFmt}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
      ${slices}
      <text x="${cx}" y="${cy-6}" text-anchor="middle" dominant-baseline="middle" fill="var(--t0)" font-size="11" font-weight="700" font-family="'IBM Plex Mono',monospace">${h(totalFmt)}</text>
      <text x="${cx}" y="${cy+9}" text-anchor="middle" dominant-baseline="middle" fill="var(--t2)" font-size="8.5" letter-spacing="1">${h(label.toUpperCase())}</text>
    </svg>`;
  }

  /* ════════════════════════════════════════
     SPARKLINE (inline mini chart)
  ════════════════════════════════════════ */
  function sparkline(data, opts = {}) {
    const { w=72, ht=24, color='var(--grn)', fill=true } = opts;
    const vals = Array.isArray(data) ? data.map(Number) : [];
    if (!vals.length || vals.every(v=>v===0)) return '';
    const max  = Math.max(...vals, 1), min = Math.min(...vals, 0);
    const range = max - min || 1;
    const step  = w / (vals.length - 1 || 1);
    const pts   = vals.map((v,i) => `${i*step},${ht-((v-min)/range)*(ht-2)}`).join(' ');
    const area  = fill ? `<polygon points="${pts} ${w},${ht} 0,${ht}" fill="${color}" fill-opacity="0.15"/>` : '';
    return `<svg width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" style="overflow:visible">
      ${area}
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* ════════════════════════════════════════
     HEATMAP
  ════════════════════════════════════════ */
  function heatmap(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const data  = Store.heatmapData();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DAYS   = ['S','M','T','W','T','F','S'];

    let html = `<div style="overflow-x:auto;padding-bottom:4px">
      <div style="display:inline-flex;flex-direction:column;gap:3px;min-width:100%">`;

    // Month labels row
    html += `<div style="display:flex;gap:3px;margin-bottom:2px;padding-left:18px">`;
    let lastMonth = -1;
    data.forEach((week, wi) => {
      const m = week[0]?.month;
      if (m !== lastMonth && m !== undefined) {
        html += `<div style="font-size:9px;color:var(--t2);min-width:14px;text-align:left">${MONTHS[m] || ''}</div>`;
        lastMonth = m;
      } else {
        html += `<div style="min-width:14px"></div>`;
      }
    });
    html += `</div>`;

    // Day labels + cells
    for (let day = 0; day < 7; day++) {
      html += `<div style="display:flex;gap:3px;align-items:center">`;
      html += `<span style="font-size:9px;color:var(--t2);width:14px;text-align:right;margin-right:2px">${day%2===1?DAYS[day]:''}</span>`;
      data.forEach(week => {
        const cell = week[day];
        if (cell) {
          const cls = `heat-${cell.level}`;
          const tip = `${cell.date}: ${cell.exp > 0 ? Store.fmt(cell.exp) : 'No spending'}`;
          html += `<div class="heat-cell ${cls}" title="${h(tip)}" role="img" aria-label="${h(tip)}"></div>`;
        } else {
          html += `<div class="heat-cell heat-0" style="opacity:0"></div>`;
        }
      });
      html += `</div>`;
    }

    html += `</div></div>`;

    // Legend
    html += `<div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--t2)">
      <span>${t('no_data')}</span>
      ${[0,1,2,3,4].map(l=>`<div class="heat-cell heat-${l}" style="width:12px;height:12px;border-radius:3px"></div>`).join('')}
      <span>More</span>
    </div>`;

    el.innerHTML = html;
  }

  /* ════════════════════════════════════════
     HELPER: h() — escape for chart text
  ════════════════════════════════════════ */
  function h(v) {
    return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return Object.freeze({ bar, line, donut, sparkline, heatmap, COLORS, C_INC, C_EXP, C_ACC });
})();

window.Charts = Charts;
