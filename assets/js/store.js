/* CashFlow — Store v4.0 */
'use strict';

const Store = (() => {
  const VER = 'cf_v4';
  const KEY = {
    tx:       VER + '_tx',
    budgets:  VER + '_budgets',
    settings: VER + '_settings',
    recurring:VER + '_recurring',
    goals:    VER + '_goals',
    backup1:  VER + '_bk1',
    backup2:  VER + '_bk2',
    backup3:  VER + '_bk3',
    meta:     VER + '_meta',
  };

  const MAX_STORAGE_BYTES = 4.5 * 1024 * 1024; // ~4.5 MB safe limit (localStorage ~5 MB)
  const AUTO_BACKUP_DAYS  = 7;
  const PAGE_SIZE         = 50;

  const DEF_SETTINGS = {
    userName:'My Account', currency:'৳', language:'en',
    theme:'dark', notifications:true, compactView:false, showInsights:true,
  };

  /* ── Safe I/O ── */
  function _r(key, fb) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fb;
      const v = JSON.parse(raw);
      return v === null ? fb : v;
    } catch { return fb; }
  }

  function _w(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) _emit('cf:quota');
      console.error('[Store] write:', key, e.message);
      return false;
    }
  }

  function _del(key) {
    try { localStorage.removeItem(key); } catch {}
  }

  function _emit(name, detail) {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
  }

  /* ── UID ── */
  function uid() {
    return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) + '_' + Math.random().toString(36).slice(2, 5);
  }

  /* ── Date helpers ── */
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function parseDate(s) {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(s + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }

  /* ── Sanitize a single transaction ── */
  function _sanitizeTx(t) {
    if (!t || typeof t !== 'object') return null;
    if (!t.id || !t.desc || !t.type) return null;
    const amount = Math.abs(parseFloat(t.amount) || 0);
    if (amount <= 0) return null;
    return {
      id:        String(t.id),
      type:      t.type === 'income' ? 'income' : 'expense',
      desc:      String(t.desc).trim().slice(0, 100),
      amount,
      category:  String(t.category || 'other'),
      date:      String(t.date || todayISO()),
      note:      String(t.note || '').trim().slice(0, 200),
      recurId:   t.recurId || null,
      createdAt: Number(t.createdAt) || Date.now(),
    };
  }

  /* ── Load and validate state ── */
  let _raw_tx = _r(KEY.tx, []);
  let _bud    = _r(KEY.budgets, {});
  let _set    = { ...DEF_SETTINGS, ..._r(KEY.settings, {}) };
  let _rec    = _r(KEY.recurring, []);
  let _goals  = _r(KEY.goals, []);
  let _meta   = _r(KEY.meta, { lastBackup: 0, repaired: 0, version: VER });

  // Validate arrays
  if (!Array.isArray(_raw_tx)) _raw_tx = [];
  if (!Array.isArray(_rec))    _rec    = [];
  if (!Array.isArray(_goals))  _goals  = [];
  if (typeof _bud !== 'object' || Array.isArray(_bud)) _bud = {};

  // DATA INTEGRITY CHECK: sanitize all transactions on load
  let _tx = [];
  let _repairedCount = 0;
  _raw_tx.forEach(t => {
    const clean = _sanitizeTx(t);
    if (clean) _tx.push(clean);
    else        _repairedCount++;
  });
  if (_repairedCount > 0) {
    console.warn(`[Store] Repaired ${_repairedCount} invalid transaction(s) on load.`);
    _meta.repaired = (_meta.repaired || 0) + _repairedCount;
    _w(KEY.tx, _tx);
    _w(KEY.meta, _meta);
  }

  // Sanitize recurring
  _rec = _rec.filter(r => r && r.id && r.desc && r.amount > 0);
  // Sanitize goals
  _goals = _goals.filter(g => g && g.id && g.name && g.target > 0);

  /* ── Savers ── */
  function _sTx()  { _w(KEY.tx, _tx);        _emit('cf:changed', { type:'tx' }); }
  function _sBud() { _w(KEY.budgets, _bud);  _emit('cf:changed', { type:'budget' }); }
  function _sSet() { _w(KEY.settings, _set); _emit('cf:settings'); }
  function _sRec() { _w(KEY.recurring, _rec);_emit('cf:changed', { type:'recurring' }); }
  function _sGoa() { _w(KEY.goals, _goals);  _emit('cf:changed', { type:'goals' }); }

  /* ═══════════════════════════
     TRANSACTIONS
  ═══════════════════════════ */
  function getAll()    { return [..._tx]; }
  function getById(id) { return _tx.find(t => t.id === id) ?? null; }

  function add(data) {
    const tx = _sanitizeTx({
      id: uid(), type: data.type, desc: data.desc, amount: data.amount,
      category: data.category, date: data.date || todayISO(),
      note: data.note || '', recurId: data.recurId || null, createdAt: Date.now(),
    });
    if (!tx) return null;
    _tx.unshift(tx);
    _sTx();
    _checkStorageWarning();
    return tx;
  }

  function addBatch(dataArray) {
    let added = 0;
    dataArray.forEach(data => {
      const tx = _sanitizeTx({
        id: uid(), type: data.type, desc: data.desc, amount: data.amount,
        category: data.category, date: data.date || todayISO(),
        note: data.note || '', recurId: data.recurId || null, createdAt: Date.now(),
      });
      if (tx) { _tx.unshift(tx); added++; }
    });
    if (added) _sTx();
    return added;
  }

  function update(id, data) {
    const i = _tx.findIndex(t => t.id === id);
    if (i < 0) return false;
    const o = _tx[i];
    _tx[i] = {
      ...o,
      type:      data.type     ?? o.type,
      desc:      data.desc     !== undefined ? String(data.desc).trim().slice(0,100)    : o.desc,
      amount:    data.amount   !== undefined ? Math.max(0, parseFloat(data.amount)||0)  : o.amount,
      category:  data.category ?? o.category,
      date:      data.date     ?? o.date,
      note:      data.note     !== undefined ? String(data.note).trim().slice(0,200)    : o.note,
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

  function removeBatch(ids) {
    const set = new Set(ids);
    const before = _tx.length;
    _tx = _tx.filter(t => !set.has(t.id));
    const removed = before - _tx.length;
    if (removed > 0) _sTx();
    return removed;
  }

  function clearAll() { _tx = []; _sTx(); }

  /* ── Queries ── */
  function getByMonth(y, m) {
    // FIX: use Date arithmetic, not raw month offset (handles negatives)
    const target = new Date(y, m, 1);
    const ty = target.getFullYear(), tm = target.getMonth();
    return _tx.filter(t => {
      const d = parseDate(t.date);
      return d && d.getFullYear() === ty && d.getMonth() === tm;
    });
  }

  function getThisMonth() {
    const n = new Date();
    return getByMonth(n.getFullYear(), n.getMonth());
  }

  function getPrevMonth() {
    const n = new Date();
    n.setDate(1); n.setMonth(n.getMonth() - 1);
    return getByMonth(n.getFullYear(), n.getMonth());
  }

  // Paginated - returns { items, total, hasMore }
  function getPaged(filter='all', search='', page=0, sortBy='date', sortDir='desc') {
    let list = [..._tx];

    // Filter
    if (filter !== 'all') list = list.filter(t => t.type === filter);

    // Search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        (t.desc||'').toLowerCase().includes(q) ||
        (t.category||'').toLowerCase().includes(q) ||
        (t.note||'').toLowerCase().includes(q) ||
        (t.date||'').includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let va, vb;
      if (sortBy === 'amount')   { va = a.amount;   vb = b.amount; }
      else if (sortBy === 'cat') { va = a.category; vb = b.category; }
      else { // date (default)
        const dc = b.date.localeCompare(a.date);
        if (dc !== 0) return sortDir === 'desc' ? dc : -dc;
        va = b.createdAt || 0; vb = a.createdAt || 0;
        return sortDir === 'desc' ? va - vb : vb - va;
      }
      if (sortBy === 'cat') return sortDir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
      return sortDir === 'desc' ? vb - va : va - vb;
    });

    const total   = list.length;
    const start   = page * PAGE_SIZE;
    const items   = list.slice(start, start + PAGE_SIZE);
    const hasMore = start + PAGE_SIZE < total;
    return { items, total, hasMore, page };
  }

  /* ── Aggregations ── */
  function sumType(list, type) {
    if (!Array.isArray(list)) return 0;
    return list.filter(t => t.type === type).reduce((s, t) => s + (Math.abs(Number(t.amount)) || 0), 0);
  }

  function totalBalance() { return sumType(_tx, 'income') - sumType(_tx, 'expense'); }

  function spendByCategory(list) {
    if (!Array.isArray(list)) return {};
    const m = {};
    list.filter(t => t.type === 'expense')
        .forEach(t => { m[t.category] = (m[t.category]||0) + (Math.abs(Number(t.amount))||0); });
    return m;
  }

  function incomeByCategory(list) {
    if (!Array.isArray(list)) return {};
    const m = {};
    list.filter(t => t.type === 'income')
        .forEach(t => { m[t.category] = (m[t.category]||0) + (Math.abs(Number(t.amount))||0); });
    return m;
  }

  function last7Days() {
    return Array.from({ length:7 }, (_,i) => {
      const d = new Date(); d.setDate(d.getDate() - (6-i));
      const ds = isoDate(d);
      const day = _tx.filter(t => t.date === ds);
      return { date:ds, label: d.toLocaleDateString('en',{weekday:'short'}), inc:sumType(day,'income'), exp:sumType(day,'expense') };
    });
  }

  function last12Months() {
    return Array.from({ length:12 }, (_,i) => {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11-i));
      const list = getByMonth(d.getFullYear(), d.getMonth());
      return {
        label: d.toLocaleString('default', { month:'short' }),
        year: d.getFullYear(), month: d.getMonth(),
        inc: sumType(list,'income'), exp: sumType(list,'expense'),
      };
    });
  }

  function last6Months() { return last12Months().slice(6); }

  function dailyTrend(days=30) {
    const result = [];
    for (let i = days-1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = isoDate(d);
      const day = _tx.filter(t => t.date === ds);
      result.push({ date:ds, exp: sumType(day,'expense') });
    }
    return result;
  }

  function avgDailyExpense() {
    const e = sumType(getThisMonth(),'expense'), d = new Date().getDate();
    return d > 0 ? e / d : 0;
  }

  function momChange(type) {
    const cur = sumType(getThisMonth(), type), prev = sumType(getPrevMonth(), type);
    if (prev === 0) return cur > 0 ? 100 : 0;
    return Math.round((cur - prev) / prev * 100);
  }

  function expenseStreak() {
    let streak = 0; const d = new Date();
    for (let i = 0; i < 366; i++) {
      d.setDate(d.getDate() - (i > 0 ? 1 : 0));
      if (!_tx.some(t => t.date === isoDate(d) && t.type === 'expense')) break;
      streak++;
    }
    return streak;
  }

  // FIX: O(n) heatmap — pre-build date map first
  function heatmapData() {
    // Build lookup map once
    const expMap = {};
    _tx.filter(t => t.type === 'expense').forEach(t => {
      expMap[t.date] = (expMap[t.date] || 0) + (Number(t.amount) || 0);
    });

    const weeks = [];
    const today = new Date();
    const allVals = Object.values(expMap).filter(v => v > 0);
    const p25 = _pct(allVals, .25), p50 = _pct(allVals, .5), p75 = _pct(allVals, .75);

    for (let w = 51; w >= 0; w--) {
      const days = [];
      for (let d = 6; d >= 0; d--) {
        const dt = new Date(today); dt.setDate(dt.getDate() - (w*7+d));
        const ds = isoDate(dt), exp = expMap[ds] || 0;
        days.push({ date:ds, exp, level: exp===0?0 : exp<=p25?1 : exp<=p50?2 : exp<=p75?3 : 4, dayOfWeek: dt.getDay(), month: dt.getMonth() });
      }
      weeks.push(days);
    }
    return weeks;
  }

  function _pct(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a,b)=>a-b);
    return s[Math.floor(s.length * p)] || 0;
  }

  /* ═══════════════════════════
     RECURRING
  ═══════════════════════════ */
  function getRecurring()  { return [..._rec]; }

  function addRecurring(data) {
    const r = {
      id: uid(), type: data.type==='income'?'income':'expense',
      desc: String(data.desc||'').trim().slice(0,100),
      amount: Math.max(0, parseFloat(data.amount)||0),
      category: String(data.category||'other'),
      freq: data.freq || 'monthly',
      nextDate: String(data.nextDate || todayISO()),
      active: true, createdAt: Date.now(),
    };
    if (!r.desc || r.amount <= 0) return null;
    _rec.unshift(r);
    _sRec();
    return r;
  }

  function toggleRecurring(id) {
    const r = _rec.find(r => r.id === id);
    if (r) { r.active = !r.active; _sRec(); return r.active; }
    return null;
  }

  function deleteRecurring(id) { _rec = _rec.filter(r => r.id !== id); _sRec(); }

  // FIX: batch save — collect all adds then save once
  function applyDueRecurring() {
    const today = todayISO();
    const toAdd = [];
    let applied = 0;

    _rec.filter(r => r.active && r.nextDate <= today).forEach(r => {
      toAdd.push({ type:r.type, desc:r.desc, amount:r.amount, category:r.category, date:today, note:'↻ ' + r.freq, recurId:r.id });
      const d = parseDate(r.nextDate) || new Date();
      if (r.freq==='weekly')   d.setDate(d.getDate()+7);
      else if (r.freq==='monthly') d.setMonth(d.getMonth()+1);
      else if (r.freq==='yearly')  d.setFullYear(d.getFullYear()+1);
      else if (r.freq==='daily')   d.setDate(d.getDate()+1);
      r.nextDate = isoDate(d);
      applied++;
    });

    if (toAdd.length) {
      toAdd.forEach(data => {
        const tx = _sanitizeTx({ id:uid(), ...data, createdAt:Date.now() });
        if (tx) _tx.unshift(tx);
      });
      _sTx();    // Save transactions ONCE
      _sRec();   // Save recurring updates ONCE
    }
    return applied;
  }

  function getDueRecurring() {
    const today = todayISO();
    return _rec.filter(r => r.active && r.nextDate <= today);
  }

  /* ═══════════════════════════
     SAVINGS GOALS
  ═══════════════════════════ */
  function getGoals()  { return [..._goals]; }

  function addGoal(data) {
    const g = {
      id: uid(), name: String(data.name||'').trim().slice(0,60),
      emoji: data.emoji || '🎯',
      target: Math.max(0, parseFloat(data.target)||0),
      saved:  Math.max(0, parseFloat(data.saved)||0),
      deadline: data.deadline || '', createdAt: Date.now(),
    };
    if (!g.name || g.target <= 0) return null;
    _goals.unshift(g);
    _sGoa();
    return g;
  }

  function updateGoal(id, data) {
    const g = _goals.find(g => g.id === id);
    if (!g) return false;
    if (data.saved  !== undefined) g.saved  = Math.max(0, Math.min(g.target, parseFloat(data.saved)||0));
    if (data.target !== undefined) g.target = Math.max(0, parseFloat(data.target)||0);
    if (data.name   !== undefined) g.name   = String(data.name).trim().slice(0,60);
    if (data.emoji  !== undefined) g.emoji  = data.emoji;
    if (data.deadline !== undefined) g.deadline = data.deadline;
    _sGoa();
    return true;
  }

  function deleteGoal(id) { _goals = _goals.filter(g => g.id !== id); _sGoa(); }

  /* ═══════════════════════════
     BUDGETS
  ═══════════════════════════ */
  function getBudgets()          { return { ..._bud }; }
  function setBudget(cat, limit) { _bud[cat] = Math.max(0, parseFloat(limit)||0); _sBud(); }
  function deleteBudget(cat)     { delete _bud[cat]; _sBud(); }

  /* ═══════════════════════════
     SETTINGS
  ═══════════════════════════ */
  function getSettings()     { return { ..._set }; }
  function getSetting(k)     { return _set[k]; }
  function updateSettings(s) { _set = { ..._set, ...s }; _sSet(); }

  /* ═══════════════════════════
     FORMAT
  ═══════════════════════════ */
  function fmt(n) {
    const num = Number(n) || 0, c = _set.currency;
    try {
      return c + num.toLocaleString(I18n?.getMeta?.()?.locale || 'en', { minimumFractionDigits:2, maximumFractionDigits:2 });
    } catch {
      return c + num.toFixed(2);
    }
  }

  function fmtDate(s) {
    return I18n?.fmtDate ? I18n.fmtDate(s) : (parseDate(s)?.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) || s || '');
  }

  function fmtDateShort(s) {
    return I18n?.fmtDate ? I18n.fmtDate(s, {day:'2-digit',month:'short'}) : (parseDate(s)?.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) || '');
  }

  /* ═══════════════════════════
     AUTO-BACKUP SYSTEM
  ═══════════════════════════ */
  function _shouldAutoBackup() {
    const lastMs = _meta.lastBackup || 0;
    const nowMs  = Date.now();
    const days   = (nowMs - lastMs) / (1000 * 60 * 60 * 24);
    return days >= AUTO_BACKUP_DAYS;
  }

  function autoBackup() {
    if (!_shouldAutoBackup()) return false;
    const snapshot = {
      timestamp: new Date().toISOString(),
      label:     'Auto ' + new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}),
      count:     _tx.length,
      data:      exportJSON(),
    };
    // Rotate: bk3 = bk2, bk2 = bk1, bk1 = new
    const b2 = _r(KEY.backup2, null);
    const b1 = _r(KEY.backup1, null);
    if (b2) _w(KEY.backup3, b2);
    if (b1) _w(KEY.backup2, b1);
    _w(KEY.backup1, snapshot);
    _meta.lastBackup = Date.now();
    _w(KEY.meta, _meta);
    console.log('[Store] Auto-backup created:', snapshot.label);
    return true;
  }

  function manualBackup(label) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      label: label || 'Manual ' + new Date().toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric'}),
      count: _tx.length,
      data:  exportJSON(),
    };
    const b2 = _r(KEY.backup2, null), b1 = _r(KEY.backup1, null);
    if (b2) _w(KEY.backup3, b2);
    if (b1) _w(KEY.backup2, b1);
    _w(KEY.backup1, snapshot);
    _meta.lastBackup = Date.now();
    _w(KEY.meta, _meta);
    return snapshot;
  }

  function getBackups() {
    return [KEY.backup1, KEY.backup2, KEY.backup3]
      .map(k => _r(k, null))
      .filter(b => b && b.timestamp);
  }

  function restoreBackup(index) {
    const backups = getBackups();
    if (!backups[index]) return false;
    return importJSON(backups[index].data);
  }

  /* ═══════════════════════════
     STORAGE INFO
  ═══════════════════════════ */
  function storageInfo() {
    try {
      let bytes = 0;
      Object.values(KEY).forEach(k => { bytes += (localStorage.getItem(k) || '').length; });
      const pct = Math.round(bytes / MAX_STORAGE_BYTES * 100);
      return {
        used:      (bytes / 1024).toFixed(1) + ' KB',
        usedBytes: bytes,
        limit:     (MAX_STORAGE_BYTES / 1024).toFixed(0) + ' KB',
        pct:       Math.min(pct, 100),
        count:     _tx.length,
        repaired:  _meta.repaired || 0,
        lastBackup: _meta.lastBackup ? new Date(_meta.lastBackup).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : null,
      };
    } catch { return { used:'—', usedBytes:0, limit:'5120 KB', pct:0, count:0, repaired:0, lastBackup:null }; }
  }

  function _checkStorageWarning() {
    const info = storageInfo();
    if (info.pct >= 80) _emit('cf:storage_warn', { pct: info.pct });
    if (info.pct >= 95) _emit('cf:quota');
  }

  /* ═══════════════════════════
     EXPORT / IMPORT
  ═══════════════════════════ */
  function exportCSV() {
    // FIX: guard against undefined date
    const rows = [..._tx]
      .filter(t => t.date)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(t => [
        t.date, t.type,
        `"${(t.desc||'').replace(/"/g,'""')}"`,
        t.category, t.amount,
        `"${(t.note||'').replace(/"/g,'""')}"`,
      ].join(','));
    return ['Date,Type,Description,Category,Amount,Note', ...rows].join('\n');
  }

  function exportJSON() {
    return JSON.stringify({
      version:      VER,
      exported:     new Date().toISOString(),
      app:          'CashFlow',
      transactions: _tx,
      budgets:      _bud,
      recurring:    _rec,
      goals:        _goals,
    }, null, 2);
  }

  function importJSON(str) {
    try {
      const d = JSON.parse(str);
      let imported = 0;

      if (Array.isArray(d.transactions)) {
        // FIX: sanitize imported transactions same as load
        _tx = d.transactions.map(t => _sanitizeTx(t)).filter(Boolean);
        imported = _tx.length;
        _sTx();
      }
      if (d.budgets && typeof d.budgets === 'object' && !Array.isArray(d.budgets)) {
        _bud = d.budgets;
        _sBud();
      }
      if (Array.isArray(d.recurring)) { _rec = d.recurring.filter(r => r && r.id); _sRec(); }
      if (Array.isArray(d.goals))     { _goals = d.goals.filter(g => g && g.id);   _sGoa(); }
      return { ok: true, count: imported };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // Preview import without committing
  function previewImport(str) {
    try {
      const d = JSON.parse(str);
      return {
        ok:          true,
        txCount:     Array.isArray(d.transactions) ? d.transactions.filter(t => _sanitizeTx(t)).length : 0,
        budgetCount: d.budgets ? Object.keys(d.budgets).length : 0,
        goalCount:   Array.isArray(d.goals) ? d.goals.length : 0,
        recurCount:  Array.isArray(d.recurring) ? d.recurring.length : 0,
        exported:    d.exported || null,
        version:     d.version || '?',
      };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  return Object.freeze({
    // Transactions
    getAll, getById, add, addBatch, update, remove, removeBatch, clearAll,
    getByMonth, getThisMonth, getPrevMonth, getPaged,
    sumType, totalBalance, spendByCategory, incomeByCategory,
    last7Days, last6Months, last12Months, dailyTrend,
    avgDailyExpense, momChange, expenseStreak, heatmapData,
    // Recurring
    getRecurring, addRecurring, toggleRecurring, deleteRecurring,
    applyDueRecurring, getDueRecurring,
    // Goals
    getGoals, addGoal, updateGoal, deleteGoal,
    // Budgets
    getBudgets, setBudget, deleteBudget,
    // Settings
    getSettings, getSetting, updateSettings,
    // Format
    fmt, fmtDate, fmtDateShort,
    // Backup
    autoBackup, manualBackup, getBackups, restoreBackup,
    // IO
    exportCSV, exportJSON, importJSON, previewImport,
    storageInfo,
    // Helpers
    uid, todayISO, isoDate, parseDate,
    PAGE_SIZE,
  });
})();

window.Store = Store;
