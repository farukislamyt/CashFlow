/* CashFlow — Store v3.0 */
'use strict';

const Store = (() => {
  const VER  = 'cf_v3';
  const KEY  = {
    tx:       VER + '_tx',
    budgets:  VER + '_budgets',
    settings: VER + '_settings',
    recurring:VER + '_recurring',
    goals:    VER + '_goals',
  };

  const DEF_SETTINGS = {
    userName: 'My Account',
    currency: '৳',
    notifications: true,
    compactView: false,
    showInsights: true,
  };

  /* ── I/O ── */
  function _r(key, fb) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fb;
      const v = JSON.parse(raw);
      return v === null ? fb : v;
    } catch { return fb; }
  }

  function _w(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) _emit('cf:quota');
      return false;
    }
  }

  function _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  /* ── UID ── */
  function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8) + '_' + Math.random().toString(36).slice(2,5);
  }

  /* ── Date helpers ── */
  function todayISO() {
    const d = new Date(), y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parseDate(s) {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  /* ── State ── */
  let _tx   = _r(KEY.tx, []);
  let _bud  = _r(KEY.budgets, {});
  let _set  = { ...DEF_SETTINGS, ..._r(KEY.settings, {}) };
  let _rec  = _r(KEY.recurring, []);
  let _goals= _r(KEY.goals, []);

  // Validate
  if (!Array.isArray(_tx))   _tx   = [];
  if (!Array.isArray(_rec))  _rec  = [];
  if (!Array.isArray(_goals))_goals= [];
  if (typeof _bud !== 'object' || Array.isArray(_bud)) _bud = {};

  // Sanitize transactions
  _tx = _tx.filter(t => t && t.id && t.type && t.desc && t.amount > 0);

  /* ── Savers ── */
  function _sTx()  { _w(KEY.tx, _tx);        _emit('cf:changed', { type:'tx' }); }
  function _sBud() { _w(KEY.budgets, _bud);  _emit('cf:changed', { type:'budget' }); }
  function _sSet() { _w(KEY.settings, _set); _emit('cf:settings'); }
  function _sRec() { _w(KEY.recurring, _rec);_emit('cf:changed', { type:'recurring' }); }
  function _sGoa() { _w(KEY.goals, _goals);  _emit('cf:changed', { type:'goals' }); }

  /* ═══════════════════════
     TRANSACTIONS
  ═══════════════════════ */
  function getAll()    { return [..._tx]; }
  function getById(id) { return _tx.find(t => t.id === id) ?? null; }

  function add(data) {
    const tx = {
      id:        uid(),
      type:      data.type === 'income' ? 'income' : 'expense',
      desc:      String(data.desc ?? '').trim().slice(0,100),
      amount:    Math.max(0, parseFloat(data.amount) || 0),
      category:  String(data.category ?? 'other'),
      date:      String(data.date ?? todayISO()),
      note:      String(data.note ?? '').trim().slice(0,200),
      recurId:   data.recurId || null,
      createdAt: Date.now(),
    };
    if (!tx.desc || tx.amount <= 0) return null;
    _tx.unshift(tx);
    _sTx();
    return tx;
  }

  function update(id, data) {
    const i = _tx.findIndex(t => t.id === id);
    if (i < 0) return false;
    const o = _tx[i];
    _tx[i] = {
      ...o,
      type:      data.type     ?? o.type,
      desc:      data.desc     !== undefined ? String(data.desc).trim().slice(0,100)   : o.desc,
      amount:    data.amount   !== undefined ? Math.max(0, parseFloat(data.amount)||0) : o.amount,
      category:  data.category ?? o.category,
      date:      data.date     ?? o.date,
      note:      data.note     !== undefined ? String(data.note).trim().slice(0,200)   : o.note,
      updatedAt: Date.now(),
    };
    _sTx();
    return true;
  }

  function remove(id) {
    const n = _tx.length;
    _tx = _tx.filter(t => t.id !== id);
    if (_tx.length < n) { _sTx(); return true; }
    return false;
  }

  function clearAll() { _tx = []; _sTx(); }

  /* ── Computed ── */
  function getByMonth(y, m) {
    return _tx.filter(t => { const d = parseDate(t.date); return d && d.getFullYear()===y && d.getMonth()===m; });
  }
  function getThisMonth() { const n=new Date(); return getByMonth(n.getFullYear(), n.getMonth()); }
  function getPrevMonth()  { const n=new Date(), m=n.getMonth()-1; return m<0 ? getByMonth(n.getFullYear()-1,11) : getByMonth(n.getFullYear(),m); }

  function sumType(list, type) {
    if (!Array.isArray(list)) return 0;
    return list.filter(t=>t.type===type).reduce((s,t)=>s+(Math.abs(Number(t.amount))||0),0);
  }

  function totalBalance() { return sumType(_tx,'income') - sumType(_tx,'expense'); }

  function spendByCategory(list) {
    if (!Array.isArray(list)) return {};
    const m={};
    list.filter(t=>t.type==='expense').forEach(t=>{ m[t.category]=(m[t.category]||0)+(Math.abs(Number(t.amount))||0); });
    return m;
  }

  function incomeByCategory(list) {
    if (!Array.isArray(list)) return {};
    const m={};
    list.filter(t=>t.type==='income').forEach(t=>{ m[t.category]=(m[t.category]||0)+(Math.abs(Number(t.amount))||0); });
    return m;
  }

  function last7Days() {
    return Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=isoDate(d), day=_tx.filter(t=>t.date===ds);
      return { date:ds, label:d.toLocaleDateString('en',{weekday:'short'}), inc:sumType(day,'income'), exp:sumType(day,'expense') };
    });
  }

  function last6Months() {
    return Array.from({length:6},(_,i)=>{
      const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(5-i));
      const list=getByMonth(d.getFullYear(),d.getMonth());
      return { label:d.toLocaleString('default',{month:'short'}), year:d.getFullYear(), month:d.getMonth(), inc:sumType(list,'income'), exp:sumType(list,'expense') };
    });
  }

  function avgDailyExpense() { const e=sumType(getThisMonth(),'expense'), d=new Date().getDate(); return d>0?e/d:0; }

  // Month-over-month change % 
  function momChange(type) {
    const cur  = sumType(getThisMonth(), type);
    const prev = sumType(getPrevMonth(), type);
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round((cur - prev) / prev * 100);
  }

  // Spending streak (consecutive days with expense entries)
  function expenseStreak() {
    let streak=0, d=new Date();
    while(true) {
      const ds=isoDate(d);
      if (!_tx.some(t=>t.date===ds&&t.type==='expense')) break;
      streak++; d.setDate(d.getDate()-1);
      if(streak>365) break;
    }
    return streak;
  }

  // 52-week spending heatmap data
  function heatmapData() {
    const weeks=[];
    const today=new Date();
    for(let w=51; w>=0; w--) {
      const days=[];
      for(let d=6; d>=0; d--) {
        const dt=new Date(today);
        dt.setDate(dt.getDate() - (w*7+d));
        const ds=isoDate(dt);
        const exp=_tx.filter(t=>t.date===ds&&t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
        days.push({ date:ds, exp });
      }
      weeks.push(days);
    }
    // Calculate heat level
    const vals=weeks.flat().map(x=>x.exp).filter(x=>x>0);
    const p25=_pct(vals,.25), p50=_pct(vals,.5), p75=_pct(vals,.75);
    return weeks.map(w=>w.map(d=>({
      ...d,
      level: d.exp===0 ? 0 : d.exp<=p25 ? 1 : d.exp<=p50 ? 2 : d.exp<=p75 ? 3 : 4
    })));
  }

  function _pct(arr, p) {
    if (!arr.length) return 0;
    const s=[...arr].sort((a,b)=>a-b);
    return s[Math.floor(s.length*p)] || 0;
  }

  /* ═══════════════════════
     RECURRING
  ═══════════════════════ */
  function getRecurring()  { return [..._rec]; }

  function addRecurring(data) {
    const r = {
      id:       uid(),
      type:     data.type==='income'?'income':'expense',
      desc:     String(data.desc??'').trim().slice(0,100),
      amount:   Math.max(0,parseFloat(data.amount)||0),
      category: String(data.category??'other'),
      freq:     data.freq||'monthly',  // weekly | monthly | yearly
      nextDate: String(data.nextDate??todayISO()),
      active:   true,
      createdAt: Date.now(),
    };
    if(!r.desc||r.amount<=0) return null;
    _rec.unshift(r);
    _sRec();
    return r;
  }

  function toggleRecurring(id) {
    const r=_rec.find(r=>r.id===id);
    if(r){ r.active=!r.active; _sRec(); return r.active; }
    return null;
  }

  function deleteRecurring(id) {
    _rec=_rec.filter(r=>r.id!==id);
    _sRec();
  }

  function applyDueRecurring() {
    const today=todayISO();
    let applied=0;
    _rec.filter(r=>r.active&&r.nextDate<=today).forEach(r=>{
      add({ type:r.type, desc:r.desc, amount:r.amount, category:r.category, date:today, note:'Auto: '+r.freq, recurId:r.id });
      // Advance next date
      const d=parseDate(r.nextDate)||new Date();
      if(r.freq==='weekly')  d.setDate(d.getDate()+7);
      else if(r.freq==='monthly') d.setMonth(d.getMonth()+1);
      else if(r.freq==='yearly')  d.setFullYear(d.getFullYear()+1);
      r.nextDate=isoDate(d);
      applied++;
    });
    if(applied) _sRec();
    return applied;
  }

  function getDueRecurring() {
    const today=todayISO();
    return _rec.filter(r=>r.active&&r.nextDate<=today);
  }

  /* ═══════════════════════
     SAVINGS GOALS
  ═══════════════════════ */
  function getGoals()  { return [..._goals]; }

  function addGoal(data) {
    const g = {
      id:       uid(),
      name:     String(data.name??'').trim().slice(0,60),
      emoji:    data.emoji||'🎯',
      target:   Math.max(0,parseFloat(data.target)||0),
      saved:    Math.max(0,parseFloat(data.saved)||0),
      deadline: data.deadline||'',
      createdAt:Date.now(),
    };
    if(!g.name||g.target<=0) return null;
    _goals.unshift(g);
    _sGoa();
    return g;
  }

  function updateGoalSaved(id, amount) {
    const g=_goals.find(g=>g.id===id);
    if(!g) return false;
    g.saved=Math.max(0,Math.min(g.target,parseFloat(amount)||0));
    _sGoa();
    return true;
  }

  function deleteGoal(id) { _goals=_goals.filter(g=>g.id!==id); _sGoa(); }

  /* ═══════════════════════
     BUDGETS
  ═══════════════════════ */
  function getBudgets()          { return {..._bud}; }
  function setBudget(cat, limit) { _bud[cat]=Math.max(0,parseFloat(limit)||0); _sBud(); }
  function deleteBudget(cat)     { delete _bud[cat]; _sBud(); }

  /* ═══════════════════════
     SETTINGS
  ═══════════════════════ */
  function getSettings()    { return {..._set}; }
  function getSetting(k)    { return _set[k]; }
  function updateSettings(s){ _set={..._set,...s}; _sSet(); }

  /* ═══════════════════════
     FORMAT
  ═══════════════════════ */
  function fmt(n) {
    const num=Number(n)||0, c=_set.currency;
    return c + num.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
  }

  function fmtDate(s) {
    const d=parseDate(s);
    if(!d) return String(s||'');
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
  }

  function fmtDateShort(s) {
    const d=parseDate(s);
    if(!d) return '';
    return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
  }

  /* ═══════════════════════
     EXPORT / IMPORT
  ═══════════════════════ */
  function exportCSV() {
    const rows=[..._tx].sort((a,b)=>b.date.localeCompare(a.date))
      .map(t=>[t.date,t.type,`"${(t.desc||'').replace(/"/g,'""')}"`,t.category,t.amount,`"${(t.note||'').replace(/"/g,'""')}"`].join(','));
    return ['Date,Type,Description,Category,Amount,Note',...rows].join('\n');
  }

  function exportJSON() {
    return JSON.stringify({ version:VER, exported:new Date().toISOString(), transactions:_tx, budgets:_bud, recurring:_rec, goals:_goals }, null, 2);
  }

  function importJSON(str) {
    try {
      const d=JSON.parse(str);
      if(Array.isArray(d.transactions)) { _tx=d.transactions.filter(t=>t&&t.id&&t.desc); _sTx(); }
      if(d.budgets&&typeof d.budgets==='object'&&!Array.isArray(d.budgets)) { _bud=d.budgets; _sBud(); }
      if(Array.isArray(d.recurring)) { _rec=d.recurring; _sRec(); }
      if(Array.isArray(d.goals))     { _goals=d.goals;   _sGoa(); }
      return true;
    } catch { return false; }
  }

  function storageInfo() {
    try {
      const bytes=Object.values(KEY).reduce((s,k)=>s+(localStorage.getItem(k)||'').length,0);
      return { total:(bytes/1024).toFixed(1)+' KB', count:_tx.length, bytes };
    } catch { return { total:'—', count:0 }; }
  }

  return Object.freeze({
    // Transactions
    getAll, getById, add, update, remove, clearAll,
    getByMonth, getThisMonth, getPrevMonth,
    sumType, totalBalance, spendByCategory, incomeByCategory,
    last7Days, last6Months, avgDailyExpense,
    momChange, expenseStreak, heatmapData,
    // Recurring
    getRecurring, addRecurring, toggleRecurring, deleteRecurring,
    applyDueRecurring, getDueRecurring,
    // Goals
    getGoals, addGoal, updateGoalSaved, deleteGoal,
    // Budgets
    getBudgets, setBudget, deleteBudget,
    // Settings
    getSettings, getSetting, updateSettings,
    // Format
    fmt, fmtDate, fmtDateShort,
    // IO
    exportCSV, exportJSON, importJSON, storageInfo,
    // Helpers
    uid, todayISO, isoDate, parseDate,
  });
})();

window.Store = Store;
