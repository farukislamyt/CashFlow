/* CashFlow — UI v4.0 */
'use strict';

/* ── Category registry ── */
const CATS = Object.freeze({
  salary:       { emoji:'💼', key:'cat_salary',        pill:'pill-salary'        },
  freelance:    { emoji:'💻', key:'cat_freelance',      pill:'pill-freelance'     },
  investment:   { emoji:'📈', key:'cat_investment',     pill:'pill-investment'    },
  business:     { emoji:'🏪', key:'cat_business',       pill:'pill-business'      },
  food:         { emoji:'🍔', key:'cat_food',           pill:'pill-food'          },
  transport:    { emoji:'🚗', key:'cat_transport',      pill:'pill-transport'     },
  shopping:     { emoji:'🛍', key:'cat_shopping',       pill:'pill-shopping'      },
  health:       { emoji:'💊', key:'cat_health',         pill:'pill-health'        },
  rent:         { emoji:'🏠', key:'cat_rent',           pill:'pill-rent'          },
  entertainment:{ emoji:'🎮', key:'cat_entertainment',  pill:'pill-entertainment' },
  utilities:    { emoji:'⚡', key:'cat_utilities',      pill:'pill-utilities'     },
  education:    { emoji:'📚', key:'cat_education',      pill:'pill-education'     },
  other:        { emoji:'📦', key:'cat_other',          pill:'pill-other'         },
});

const INC_CATS  = ['salary','freelance','investment','business','other'];
const EXP_CATS  = ['food','transport','shopping','health','rent','entertainment','utilities','education','other'];

function catMeta(c)   { return CATS[c] || CATS.other; }
function catLabel(c)  { const m = catMeta(c); return m.emoji + ' ' + t(m.key); }
function catPill(c)   { const m = catMeta(c); return `<span class="pill ${m.pill}">${m.emoji} ${h(t(m.key))}</span>`; }
function catOpts(type) {
  return (type==='income' ? INC_CATS : EXP_CATS).map(c => {
    const m = catMeta(c);
    return `<option value="${h(c)}">${m.emoji} ${h(t(m.key))}</option>`;
  }).join('');
}

/* ── XSS escape ── */
function h(v) {
  return String(v==null?'':v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

/* ── DOM helpers ── */
function el(id)       { return document.getElementById(id); }
function setText(id,v){ const e=el(id); if(e) e.textContent = v!=null?String(v):''; }
function setHTML(id,v){ const e=el(id); if(e) e.innerHTML = v; }
function setVal(id,v) { const e=el(id); if(e) e.value = v!=null?String(v):''; }
function getVal(id)   { const e=el(id); return e ? e.value : ''; }
function show(id,d)   { const e=el(id); if(e) e.style.display = d||'block'; }
function hide(id)     { const e=el(id); if(e) e.style.display = 'none'; }
function query(sel)   { return document.querySelector(sel); }
function queryAll(sel){ return document.querySelectorAll(sel); }

/* ── Toast ── */
const Toast = (() => {
  let _timer;
  function show(msg, type='success', ms=2800) {
    const e = el('toast');
    if (!e) return;
    clearTimeout(_timer);
    e.className = `toast ${type} show`;
    e.innerHTML = `<span class="t-dot"></span><span>${h(msg)}</span>`;
    _timer = setTimeout(() => e.classList.remove('show'), ms);
  }
  return { show };
})();

/* ── Modal ── */
const Modal = (() => {
  function open(id) {
    const e = el(id);
    if (!e) return;
    e.classList.add('open');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const f = e.querySelector('input:not([type=hidden]),select,textarea');
      if (f) f.focus();
    });
  }
  function close(id) {
    const e = el(id);
    if (!e) return;
    e.classList.remove('open');
    // Only restore scroll if no other modals open
    if (!document.querySelector('.modal-overlay.open, .confirm-overlay.open')) {
      document.body.style.overflow = '';
    }
  }
  function onBg(evt, id) { if (evt.target === evt.currentTarget) close(id); }
  return { open, close, onBg };
})();

/* ── Confirm dialog ── */
function Confirm(msg, onYes, title) {
  const ov = el('confirm-overlay');
  if (!ov) { if (window.confirm(msg)) onYes(); return; }
  setText('confirm-title', title || t('btn_confirm'));
  setText('confirm-msg', msg);
  ov.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Replace buttons to clear old listeners
  ['confirm-yes','confirm-no'].forEach(id => {
    const old = el(id);
    if (old) { const clone = old.cloneNode(true); old.parentNode.replaceChild(clone, old); }
  });

  function done() { ov.classList.remove('open'); document.body.style.overflow = ''; }
  el('confirm-yes')?.addEventListener('click', () => { done(); onYes(); });
  el('confirm-no')?.addEventListener('click', done);
}

/* ── Relative date display ── */
function relDate(dateStr) {
  return I18n?.relativeDate ? I18n.relativeDate(dateStr) : dateStr;
}

/* ── Transaction row ── */
function txRow(tx, opts = {}) {
  const { selectable = false } = opts;
  const m    = catMeta(tx.category);
  const bg   = tx.type === 'income' ? 'bg-inc' : 'bg-exp';
  const sign = tx.type === 'income' ? '+' : '−';
  const cls  = tx.type === 'income' ? 'inc' : 'exp';
  const sid  = h(tx.id);
  const rel  = relDate(tx.date);

  return `<tr data-id="${sid}" class="${opts.compact?'tx-compact':''}">
    ${selectable ? `<td style="width:32px;padding:11px 8px 11px 18px"><input type="checkbox" class="tx-check" data-id="${sid}" style="width:15px;height:15px;accent-color:var(--acc);cursor:pointer"/></td>` : ''}
    <td>
      <div class="tx-desc-wrap">
        <span class="tx-cat-icon ${bg}" aria-hidden="true">${m.emoji}</span>
        <div style="min-width:0">
          <div class="tx-name" title="${h(tx.desc)}">${h(tx.desc)}${tx.recurId?'<span class="recur-badge" title="Recurring">↻</span>':''}</div>
          ${tx.note ? `<div class="tx-sub">${h(tx.note)}</div>` : `<div class="tx-sub hide-desktop">${h(rel)}</div>`}
        </div>
      </div>
    </td>
    <td class="hide-mobile">${catPill(tx.category)}</td>
    <td class="tx-date hide-mobile">${h(Store.fmtDate(tx.date))}</td>
    <td><span class="tx-amt ${cls}">${sign}${h(Store.fmt(tx.amount))}</span></td>
    <td>
      <div class="tx-acts">
        <button class="act-btn" data-action="edit"   data-id="${sid}" title="${h(t('edit'))}"   aria-label="${h(t('edit'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
        </button>
        <button class="act-btn del" data-action="delete" data-id="${sid}" title="${h(t('delete'))}" aria-label="${h(t('delete'))}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
        </button>
      </div>
    </td>
  </tr>`;
}

/* ── Table event delegation ── */
function bindTable(tbodyId) {
  const tb = el(tbodyId);
  if (!tb) return;
  tb.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.action;
    if (act === 'edit')   App.editTx(id);
    if (act === 'delete') App.deleteTx(id);
  });
}

/* ── Trend arrow ── */
function trendHTML(pct) {
  if (pct === 0) return `<span class="trend" style="color:var(--t2)">— 0%</span>`;
  const up = pct > 0;
  return `<span class="trend ${up?'up':'down'}">${up?'↑':'↓'} ${Math.abs(pct)}% vs last month</span>`;
}

/* ── Storage gauge ── */
function storageGauge(info) {
  const c = info.pct >= 80 ? 'danger' : info.pct >= 60 ? 'warn' : 'safe';
  return `<div style="margin-bottom:var(--sp3)">
    <div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:5px">
      <span style="color:var(--t1)">${h(t('set_storage'))}: <strong>${h(info.used)}</strong> / ${h(info.limit)}</span>
      <span style="font-family:var(--ff-mono);font-weight:700;color:${c==='danger'?'var(--red)':c==='warn'?'var(--acc)':'var(--grn)'}">${info.pct}%</span>
    </div>
    <div class="prog-track" style="height:8px">
      <div class="prog-fill ${c}" style="width:${info.pct}%"></div>
    </div>
    ${info.repaired>0?`<div style="font-size:11px;color:var(--acc);margin-top:4px">⚠ Repaired ${info.repaired} invalid entr${info.repaired===1?'y':'ies'} on last load.</div>`:''}
    ${info.lastBackup?`<div style="font-size:11px;color:var(--t2);margin-top:3px">Last backup: ${h(info.lastBackup)}</div>`:''}
  </div>`;
}

/* ── Goal add-amount prompt — uses modal instead of window.prompt ── */
function openGoalAddModal(goalId, goalName) {
  setVal('goal-add-id', goalId);
  setText('goal-add-name', goalName);
  setVal('goal-add-amt', '');
  Modal.open('goal-add-modal');
}

/* ── Download helper ── */
function download(content, name, mime='text/plain') {
  try {
    const b = new Blob([content], { type:mime });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(u), 3000);
  } catch(e) { console.error('Download failed', e); }
}

/* ── i18n DOM updater — updates all [data-i18n] elements ── */
function applyI18n() {
  queryAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  queryAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.placeholder = t(key);
  });
  queryAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (key) el.title = t(key);
  });
}

/* ── Language selector HTML ── */
function langSelectorHTML() {
  const langs  = I18n.getLangs();
  const current = I18n.getLang();
  return langs.map(l => `
    <button class="lang-btn ${l.code===current?'active':''}" data-lang="${h(l.code)}" onclick="App.setLanguage('${h(l.code)}')" title="${h(l.name)}">
      <span class="lang-flag">${l.flag}</span>
      <span class="lang-name">${h(l.name)}</span>
    </button>`).join('');
}

/* ── Export to global ── */
window.CATS     = CATS;
window.INC_CATS = INC_CATS;
window.EXP_CATS = EXP_CATS;
window.catMeta  = catMeta;
window.catLabel = catLabel;
window.catPill  = catPill;
window.catOpts  = catOpts;
window.Toast    = Toast;
window.Modal    = Modal;
window.Confirm  = Confirm;
window.h        = h;
window.el       = el;
window.setText  = setText;
window.setHTML  = setHTML;
window.setVal   = setVal;
window.getVal   = getVal;
window.show     = show;
window.hide     = hide;
window.query    = query;
window.queryAll = queryAll;
window.txRow    = txRow;
window.bindTable = bindTable;
window.trendHTML = trendHTML;
window.storageGauge = storageGauge;
window.relDate      = relDate;
window.download     = download;
window.applyI18n    = applyI18n;
window.langSelectorHTML = langSelectorHTML;
window.openGoalAddModal = openGoalAddModal;
