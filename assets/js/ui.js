/**
 * CashFlow — UI Utilities (ui.js)
 */

/* ── TOAST ── */
const Toast = (() => {
  let timer;
  const el = () => document.getElementById('toast');

  return {
    show(msg, type = 'success', duration = 2800) {
      const t = el();
      if (!t) return;
      clearTimeout(timer);
      t.className = `toast ${type} visible`;
      t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> ${msg}`;
      timer = setTimeout(() => { t.classList.remove('visible'); }, duration);
    },
  };
})();

/* ── MODAL MANAGER ── */
const Modal = (() => {
  function open(id)  {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  }
  function close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  }
  function closeOnBg(e, id) {
    if (e.target === document.getElementById(id)) close(id);
  }
  return { open, close, closeOnBg };
})();

/* ── CATEGORY HELPERS ── */
const CAT_META = {
  salary:        { emoji: '💼', label: 'Salary',        pill: 'pill-salary'        },
  freelance:     { emoji: '💻', label: 'Freelance',     pill: 'pill-freelance'     },
  investment:    { emoji: '📈', label: 'Investment',    pill: 'pill-investment'    },
  food:          { emoji: '🍔', label: 'Food',          pill: 'pill-food'          },
  transport:     { emoji: '🚗', label: 'Transport',     pill: 'pill-transport'     },
  shopping:      { emoji: '🛍',  label: 'Shopping',      pill: 'pill-shopping'      },
  health:        { emoji: '💊', label: 'Health',        pill: 'pill-health'        },
  rent:          { emoji: '🏠', label: 'Rent',          pill: 'pill-rent'          },
  entertainment: { emoji: '🎮', label: 'Entertainment', pill: 'pill-entertainment' },
  utilities:     { emoji: '⚡', label: 'Utilities',     pill: 'pill-utilities'     },
  education:     { emoji: '📚', label: 'Education',     pill: 'pill-education'     },
  other:         { emoji: '📦', label: 'Other',         pill: 'pill-other'         },
};

function getCatMeta(cat) {
  return CAT_META[cat] || CAT_META.other;
}

function getCategoryPill(cat) {
  const m = getCatMeta(cat);
  return `<span class="category-pill ${m.pill}">${m.emoji} ${m.label}</span>`;
}

/* ── HTML ESCAPE ── */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── BAR CHART RENDERER ── */
function renderBarChart(containerId, data, heightPx = 110) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const maxVal = Math.max(...data.map(d => Math.max(d.inc || 0, d.exp || 0, d.val || 0)), 1);

  container.style.height = heightPx + 'px';
  container.innerHTML = data.map(d => {
    const hasInc = 'inc' in d;
    const hasExp = 'exp' in d;
    const hasVal = 'val' in d;

    let bars = '';
    if (hasInc) bars += `<div class="bar-col income-bar" style="height:${Math.max((d.inc/maxVal)*100, 2)}%" title="Income: ${Store.fmt(d.inc)}"></div>`;
    if (hasExp) bars += `<div class="bar-col expense-bar" style="height:${Math.max((d.exp/maxVal)*100, 2)}%" title="Expense: ${Store.fmt(d.exp)}"></div>`;
    if (hasVal) bars += `<div class="bar-col balance-bar" style="height:${Math.max((d.val/maxVal)*100, 2)}%" title="${Store.fmt(d.val)}"></div>`;

    return `
      <div class="bar-group">
        <div class="bar-col-wrap" style="height:${heightPx - 22}px;align-items:flex-end">
          ${bars}
        </div>
        <span class="bar-label">${d.label}</span>
      </div>`;
  }).join('');
}

/* ── DONUT CHART (SVG) ── */
function renderDonut(data, totalLabel = 'Total') {
  const size = 140;
  const r    = 52;
  const cx   = size / 2;
  const cy   = size / 2;
  const stroke = 20;
  const circ   = 2 * Math.PI * r;

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return `<svg viewBox="0 0 ${size} ${size}" class="donut-svg" width="${size}" height="${size}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-overlay)" stroke-width="${stroke}"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="11">No data</text></svg>`;

  let offset = -circ / 4; // start from top
  const slices = data.map(d => {
    const dash   = (d.value / total) * circ;
    const gap    = circ - dash;
    const slice  = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${stroke}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" style="transition:stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)"/>`;
    offset -= dash;
    return slice;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" class="donut-svg" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-overlay)" stroke-width="${stroke}"/>
      ${slices}
      <text x="${cx}" y="${cy - 7}" text-anchor="middle" dominant-baseline="middle"
            fill="var(--text-primary)" font-size="15" font-weight="700" font-family="'JetBrains Mono',monospace">
        ${Store.fmt(total)}
      </text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" dominant-baseline="middle"
            fill="var(--text-muted)" font-size="9.5" letter-spacing="1">
        ${totalLabel}
      </text>
    </svg>`;
}

/* ── TRANSACTION ROW HTML ── */
function txRowHTML(t, actions = true) {
  const m = getCatMeta(t.category);
  const bgClass = t.type === 'income' ? 'income-bg' : 'expense-bg';
  const amountSign = t.type === 'income' ? '+' : '−';

  return `
    <tr data-id="${t.id}">
      <td>
        <div class="tx-desc-cell">
          <span class="tx-emoji-wrap ${bgClass}">${m.emoji}</span>
          <div>
            <div class="tx-name">${esc(t.desc)}</div>
            ${t.note ? `<div class="tx-note">${esc(t.note)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${getCategoryPill(t.category)}</td>
      <td class="tx-date-cell">${Store.fmtDate(t.date)}</td>
      <td class="tx-amount-cell ${t.type}">${amountSign}${Store.fmt(t.amount)}</td>
      ${actions ? `<td class="tx-actions">
        <button class="icon-btn edit" onclick="App.editTx('${t.id}')" title="Edit">✎</button>
        <button class="icon-btn delete" onclick="App.deleteTx('${t.id}')" title="Delete">🗑</button>
      </td>` : '<td></td>'}
    </tr>`;
}

/* ── DATE HELPERS ── */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function monthName(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/* ── EXPORT to globals ── */
window.Toast   = Toast;
window.Modal   = Modal;
window.CAT_META      = CAT_META;
window.getCatMeta    = getCatMeta;
window.getCategoryPill = getCategoryPill;
window.renderBarChart  = renderBarChart;
window.renderDonut     = renderDonut;
window.txRowHTML       = txRowHTML;
window.todayISO        = todayISO;
window.monthName       = monthName;
window.esc             = esc;
