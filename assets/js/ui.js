/* CashFlow — UI v3.0 */
'use strict';

/* ── Categories ── */
const CATS = Object.freeze({
  salary:       { emoji:'💼', label:'Salary',        pill:'pill-salary'        },
  freelance:    { emoji:'💻', label:'Freelance',      pill:'pill-freelance'     },
  investment:   { emoji:'📈', label:'Investment',     pill:'pill-investment'    },
  business:     { emoji:'🏪', label:'Business',       pill:'pill-business'      },
  food:         { emoji:'🍔', label:'Food & Dining',  pill:'pill-food'          },
  transport:    { emoji:'🚗', label:'Transport',      pill:'pill-transport'     },
  shopping:     { emoji:'🛍', label:'Shopping',       pill:'pill-shopping'      },
  health:       { emoji:'💊', label:'Health',         pill:'pill-health'        },
  rent:         { emoji:'🏠', label:'Rent',           pill:'pill-rent'          },
  entertainment:{ emoji:'🎮', label:'Entertainment',  pill:'pill-entertainment' },
  utilities:    { emoji:'⚡', label:'Utilities',      pill:'pill-utilities'     },
  education:    { emoji:'📚', label:'Education',      pill:'pill-education'     },
  other:        { emoji:'📦', label:'Other',          pill:'pill-other'         },
});

const INC_CATS  = ['salary','freelance','investment','business','other'];
const EXP_CATS  = ['food','transport','shopping','health','rent','entertainment','utilities','education','other'];
const COLORS    = ['#f05672','#f0c14b','#2dd98f','#4e8ef7','#a78bfa','#fb923c','#f472b6','#7dd3fc','#34d399','#60a5fa','#fbbf24','#818cf8'];

function catMeta(c)  { return CATS[c] || CATS.other; }
function catPill(c)  { const m=catMeta(c); return `<span class="pill ${m.pill}">${m.emoji} ${m.label}</span>`; }
function catOpts(t)  {
  return (t==='income'?INC_CATS:EXP_CATS).map(c=>{ const m=catMeta(c); return `<option value="${h(c)}">${m.emoji} ${m.label}</option>`; }).join('');
}

/* ── XSS-safe escape ── */
function h(v) {
  return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

/* ── DOM ── */
function el(id)      { return document.getElementById(id); }
function setText(id,v){ const e=el(id); if(e) e.textContent = v!=null?String(v):''; }
function setHTML(id,v){ const e=el(id); if(e) e.innerHTML=v; }
function setVal(id,v) { const e=el(id); if(e) e.value = v!=null?String(v):''; }
function getVal(id)   { const e=el(id); return e?e.value:''; }
function show(id)     { const e=el(id); if(e) e.style.display='block'; }
function hide(id)     { const e=el(id); if(e) e.style.display='none'; }

/* ── Toast ── */
const Toast = (() => {
  let _t;
  function show(msg, type='success', ms=2800) {
    const e=el('toast'); if(!e) return;
    clearTimeout(_t);
    e.className=`toast ${type} show`;
    e.innerHTML=`<span class="t-dot"></span><span>${h(msg)}</span>`;
    _t=setTimeout(()=>e.classList.remove('show'), ms);
  }
  return { show };
})();

/* ── Modal ── */
const Modal = (() => {
  function open(id) {
    const e=el(id); if(!e) return;
    e.classList.add('open'); document.body.style.overflow='hidden';
    requestAnimationFrame(()=>{ const f=e.querySelector('input:not([type=hidden]),select,textarea,button:not(.modal-close)'); if(f) f.focus(); });
  }
  function close(id) {
    const e=el(id); if(!e) return;
    e.classList.remove('open'); document.body.style.overflow='';
  }
  function onBg(evt, id) { if(evt.target===evt.currentTarget) close(id); }
  return { open, close, onBg };
})();

/* ── Confirm dialog ── */
function Confirm(msg, onYes, title='Confirm') {
  const ov=el('confirm-overlay');
  if(!ov) { if(window.confirm(msg)) onYes(); return; }
  setText('confirm-title', title);
  setText('confirm-msg', msg);
  ov.classList.add('open'); document.body.style.overflow='hidden';

  // Clone to kill old listeners
  const y = el('confirm-yes'), n = el('confirm-no');
  const ny=y.cloneNode(true), nn=n.cloneNode(true);
  y.parentNode.replaceChild(ny,y); n.parentNode.replaceChild(nn,n);

  function done() { ov.classList.remove('open'); document.body.style.overflow=''; }
  el('confirm-yes').addEventListener('click',()=>{ done(); onYes(); });
  el('confirm-no') .addEventListener('click', done);
}

/* ── Bar chart ── */
function renderBarChart(containerId, data, hPx=110) {
  const c=el(containerId); if(!c||!Array.isArray(data)||!data.length) return;
  const max=Math.max(...data.map(d=>Math.max(d.inc??0,d.exp??0,d.val??0,0)),1);
  c.style.height=hPx+'px'; c.className='bchart';
  c.innerHTML=data.map(d=>{
    const bH=hPx-22;
    const bars=[
      d.inc!==undefined ? `<div class="bar inc" style="height:${Math.max((d.inc/max)*100,d.inc>0?1.5:0)}%" title="${h('Inc: '+Store.fmt(d.inc))}"></div>` : '',
      d.exp!==undefined ? `<div class="bar exp" style="height:${Math.max((d.exp/max)*100,d.exp>0?1.5:0)}%" title="${h('Exp: '+Store.fmt(d.exp))}"></div>` : '',
      d.val!==undefined ? `<div class="bar acc" style="height:${Math.max((d.val/max)*100,d.val>0?1.5:0)}%" title="${h(Store.fmt(d.val))}"></div>` : '',
    ].join('');
    return `<div class="bchart-grp"><div class="bchart-bars" style="height:${bH}px;align-items:flex-end">${bars}</div><span class="bchart-lbl">${h(d.label)}</span></div>`;
  }).join('');
}

/* ── Donut chart ── */
function renderDonut(data, label='') {
  const sz=130,r=48,cx=65,cy=65,sw=18, circ=2*Math.PI*r;
  const total=data.reduce((s,d)=>s+(d.value||0),0);
  if(!total) return `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/><text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--t2)" font-size="10">No data</text></svg>`;
  let off=-(circ/4);
  const slices=data.map(d=>{
    const pct=(d.value||0)/total, dash=pct*circ, gap=circ-dash;
    const s=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${h(d.color)}" stroke-width="${sw}" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" style="transition:stroke-dashoffset .75s var(--ease)"><title>${h(d.label)}: ${h(Store.fmt(d.value))}</title></circle>`;
    off-=dash; return s;
  }).join('');
  return `<svg viewBox="0 0 ${sz} ${sz}" width="${sz}" height="${sz}" role="img" aria-label="Expense chart">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--s3)" stroke-width="${sw}"/>
    ${slices}
    <text x="${cx}" y="${cy-7}" text-anchor="middle" dominant-baseline="middle" fill="var(--t0)" font-size="12" font-weight="700" font-family="'IBM Plex Mono',monospace">${h(Store.fmt(total))}</text>
    <text x="${cx}" y="${cy+9}" text-anchor="middle" dominant-baseline="middle" fill="var(--t2)" font-size="8.5" letter-spacing="1.2">${h(label)}</text>
  </svg>`;
}

/* ── Mini sparkline ── */
function sparkline(data, w=80, h=28, color='var(--grn)') {
  if(!data.length) return '';
  const max=Math.max(...data,1), min=Math.min(...data,0);
  const range=max-min||1, step=w/(data.length-1||1);
  const pts=data.map((v,i)=>`${i*step},${h-(v-min)/range*h}`).join(' ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ── Heatmap ── */
function renderHeatmap(containerId) {
  const c=el(containerId); if(!c) return;
  const data=Store.heatmapData();
  const days=['S','M','T','W','T','F','S'];
  let html=`<div style="display:flex;gap:3px;font-size:9px;color:var(--t2)">`;
  data.forEach(week=>{
    html+=`<div style="display:flex;flex-direction:column;gap:3px">`;
    week.forEach(d=>{
      html+=`<div class="heat-cell heat-${d.level}" title="${h(d.date+': '+Store.fmt(d.exp))}"></div>`;
    });
    html+=`</div>`;
  });
  html+=`</div>`;
  html+=`<div style="display:flex;align-items:center;gap:6px;margin-top:var(--sp3);font-size:11px;color:var(--t2)">
    <span>Less</span>
    ${[0,1,2,3,4].map(l=>`<div class="heat-cell heat-${l}" style="width:12px;height:12px"></div>`).join('')}
    <span>More</span>
  </div>`;
  c.innerHTML=html;
}

/* ── Transaction row ── */
function txRow(tx) {
  const m=catMeta(tx.category), bg=tx.type==='income'?'bg-inc':'bg-exp';
  const sign=tx.type==='income'?'+':'−', cls=tx.type==='income'?'inc':'exp';
  const sid=h(tx.id);
  return `<tr data-id="${sid}">
    <td><div class="tx-desc-wrap">
      <span class="tx-cat-icon ${bg}">${m.emoji}</span>
      <div style="min-width:0">
        <div class="tx-name" title="${h(tx.desc)}">${h(tx.desc)}${tx.recurId?'<span class="recur-badge">↻</span>':''}</div>
        ${tx.note?`<div class="tx-sub">${h(tx.note)}</div>`:''}
      </div>
    </div></td>
    <td class="hide-mobile">${catPill(tx.category)}</td>
    <td class="tx-date hide-mobile">${h(Store.fmtDate(tx.date))}</td>
    <td><span class="tx-amt ${cls}">${sign}${h(Store.fmt(tx.amount))}</span></td>
    <td><div class="tx-acts">
      <button class="act-btn" data-action="edit"   data-id="${sid}" title="Edit"   aria-label="Edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
      </button>
      <button class="act-btn del" data-action="delete" data-id="${sid}" title="Delete" aria-label="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
      </button>
    </div></td>
  </tr>`;
}

/* ── Table event delegation ── */
function bindTable(tbodyId) {
  const t=el(tbodyId); if(!t) return;
  t.addEventListener('click', e=>{
    const btn=e.target.closest('[data-action]'); if(!btn) return;
    const id=btn.dataset.id, act=btn.dataset.action;
    if(act==='edit')   App.editTx(id);
    if(act==='delete') App.deleteTx(id);
  });
}

/* ── Trend arrow ── */
function trendHTML(pct) {
  if(pct===0) return `<span class="trend" style="color:var(--t2)">— 0%</span>`;
  const up=pct>0;
  return `<span class="trend ${up?'up':'down'}">${up?'↑':'↓'} ${Math.abs(pct)}% vs last month</span>`;
}

/* ── Download ── */
function download(content, name, mime='text/plain') {
  try {
    const b=new Blob([content],{type:mime}), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download=name; document.body.appendChild(a); a.click();
    document.body.removeChild(a); setTimeout(()=>URL.revokeObjectURL(u),3000);
  } catch(e) { console.error('Download failed',e); }
}

window.Toast=Toast; window.Modal=Modal; window.Confirm=Confirm;
window.CATS=CATS; window.INC_CATS=INC_CATS; window.EXP_CATS=EXP_CATS; window.COLORS=COLORS;
window.catMeta=catMeta; window.catPill=catPill; window.catOpts=catOpts;
window.renderBarChart=renderBarChart; window.renderDonut=renderDonut;
window.renderHeatmap=renderHeatmap; window.sparkline=sparkline;
window.txRow=txRow; window.bindTable=bindTable; window.trendHTML=trendHTML;
window.h=h; window.el=el; window.setText=setText; window.setHTML=setHTML; window.setVal=setVal; window.getVal=getVal;
window.show=show; window.hide=hide; window.download=download;
