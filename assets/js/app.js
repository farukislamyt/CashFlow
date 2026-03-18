/* CashFlow — App v4.0 */
'use strict';

const App = (() => {
  /* ── State ── */
  let _page       = 'dashboard';
  let _dashFilt   = 'all';
  let _histFilt   = 'all';
  let _histSearch = '';
  let _histSort   = { by:'date', dir:'desc' };
  let _histPage   = 0;
  let _histSelecting = false;
  let _modalType  = 'income';
  let _quickType  = 'income';
  let _editId     = null;
  let _rptOffset  = 0;
  let _installEvt = null;
  let _updating   = false;
  let _recType    = 'income';
  let _updateBannerBound = false;

  /* ═══════════════════════════
     NAVIGATION
  ═══════════════════════════ */
  function goTo(name) {
    const pg = el('page-' + name);
    if (!pg) return;
    _page = name;

    queryAll('.page').forEach(p => p.classList.remove('active'));
    pg.classList.add('active');

    queryAll('[data-page]').forEach(e => {
      const active = e.dataset.page === name;
      e.classList.toggle('active', active);
      if (e.classList.contains('nav-link') || e.classList.contains('bn')) {
        e.setAttribute('aria-current', active ? 'page' : 'false');
      }
    });

    const nav = { dashboard:t('nav_dashboard'), history:t('nav_history'), budget:t('nav_budget'), reports:t('nav_reports'), settings:t('nav_settings') };
    setText('topbar-title', nav[name] || '');

    _renders[name]?.();
    if (window.innerWidth <= 768) _closeSidebar();
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  const _renders = {
    dashboard: _renderDash,
    history:   _renderHistory,
    budget:    _renderBudget,
    reports:   _renderReports,
    settings:  _renderSettings,
  };

  function _refresh() { _renders[_page]?.(); }

  function toggleSidebar() {
    const s = el('sidebar'), m = el('sidebar-mask');
    const open = s.classList.toggle('open');
    m?.classList.toggle('on', open);
  }
  function _closeSidebar() {
    el('sidebar')?.classList.remove('open');
    el('sidebar-mask')?.classList.remove('on');
  }

  /* ═══════════════════════════
     LANGUAGE
  ═══════════════════════════ */
  function setLanguage(code) {
    I18n.setLang(code);
    applyI18n();
    setHTML('lang-selector', langSelectorHTML());
    _refresh();
    // Re-populate category selects
    setHTML('q-cat', catOpts(_quickType));
    setHTML('m-cat', catOpts(_modalType));
    setHTML('rec-cat', catOpts(_recType));
    Toast.show(t('toast_settings_saved'), 'success');
  }

  /* ═══════════════════════════
     DASHBOARD
  ═══════════════════════════ */
  function _renderDash() {
    const monthly = Store.getThisMonth();
    const inc     = Store.sumType(monthly,'income');
    const exp     = Store.sumType(monthly,'expense');
    const bal     = Store.totalBalance();
    const net     = inc - exp;
    const rate    = inc > 0 ? Math.round(Math.max(0,(inc-exp)/inc*100)) : 0;

    setText('d-month',   _currentMonthLabel());
    setText('d-bal',     Store.fmt(bal));
    setText('d-inc',     Store.fmt(inc));
    setText('d-exp',     Store.fmt(exp));
    setText('d-net',     Store.fmt(net));
    setText('d-rate',    rate+'%');
    setHTML('d-inc-trend', trendHTML(Store.momChange('income')));
    setHTML('d-exp-trend', trendHTML(-Store.momChange('expense')));

    const balEl = el('d-bal');
    if (balEl) balEl.className = 'kpi-val ' + (bal<0?'neg':'acc');
    const netEl = el('d-net');
    if (netEl) netEl.className = 'kpi-val ' + (net<0?'neg':'pos');

    // Sparklines (7-day trend)
    const days7 = Store.last7Days();
    setHTML('d-inc-spark', Charts.sparkline(days7.map(d=>d.inc), { color:Charts.C_INC }));
    setHTML('d-exp-spark', Charts.sparkline(days7.map(d=>d.exp), { color:Charts.C_EXP }));

    _renderTxTable('d-tx-body','d-empty',_dashFilt,10,'',{ by:'date',dir:'desc' });
    Charts.bar('d-chart', days7, { height:130, colors:[Charts.C_INC, Charts.C_EXP], keys:['inc','exp'] });
    _renderInsights(monthly, inc, exp);
    _updateBudgetBadge();
  }

  function _renderInsights(monthly, inc, exp) {
    if (!Store.getSetting('showInsights')) return setHTML('d-insights','');
    const chips = [];
    const top = Object.entries(Store.spendByCategory(monthly)).sort((a,b)=>b[1]-a[1])[0];
    if (top) chips.push(`<div class="insight-chip"><span class="ic-icon">${catMeta(top[0]).emoji}</span> ${t('dash_insight_top')}: ${t(catMeta(top[0]).key)} — ${Store.fmt(top[1])}</div>`);
    const rate = inc > 0 ? Math.round((inc-exp)/inc*100) : 0;
    if (rate >= 20) chips.push(`<div class="insight-chip d1"><span class="ic-icon">💚</span> ${t('dash_insight_saving',{rate})}</div>`);
    else if (rate < 0) chips.push(`<div class="insight-chip d1"><span class="ic-icon">⚠️</span> ${t('dash_insight_over')}</div>`);
    const due = Store.getDueRecurring();
    if (due.length) chips.push(`<div class="insight-chip d2"><span class="ic-icon">↻</span> ${t('dash_insight_recurring',{n:due.length,s:due.length!==1?'s':''})}</div>`);
    const streak = Store.expenseStreak();
    if (streak >= 3) chips.push(`<div class="insight-chip d3"><span class="ic-icon">🔥</span> ${t('dash_insight_streak',{n:streak})}</div>`);
    setHTML('d-insights', chips.join(''));
  }

  function setDashFilt(f, btn) {
    _dashFilt = f;
    queryAll('#page-dashboard .tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    _renderTxTable('d-tx-body','d-empty',_dashFilt,10,'',{ by:'date',dir:'desc' });
  }

  /* ═══════════════════════════
     HISTORY
  ═══════════════════════════ */
  function _renderHistory() {
    const all = Store.getAll();
    const inc = Store.sumType(all,'income'), exp = Store.sumType(all,'expense');

    setText('h-inc', Store.fmt(inc));
    setText('h-exp', Store.fmt(exp));
    setText('h-bal', Store.fmt(inc-exp));
    setText('h-cnt', t('hist_n_tx',{n:all.length, s:all.length!==1?'s':''}));

    _renderHistTable(false);
    _updateBulkBar();
  }

  function _renderHistTable(append = false) {
    const q = _histSearch;
    const { items, total, hasMore, page } = Store.getPaged(_histFilt, q, _histPage, _histSort.by, _histSort.dir);

    const body  = el('h-tx-body');
    const empty = el('h-empty');
    const more  = el('h-loadmore');
    const info  = el('h-showing');

    if (!body) return;

    if (!items.length && !append) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      if (more)  more.style.display  = 'none';
      if (info)  info.style.display  = 'none';
      return;
    }

    if (empty) empty.style.display = 'none';
    const compact = Store.getSetting('compactView');

    const html = items.map(tx => txRow(tx, { selectable:_histSelecting, compact })).join('');
    if (append) body.innerHTML += html;
    else        body.innerHTML  = html;

    const shown = Math.min((_histPage+1) * Store.PAGE_SIZE, total);
    if (info) {
      info.textContent = t('hist_showing', { n:shown, total });
      info.style.display = total > Store.PAGE_SIZE ? 'block' : 'none';
    }
    if (more) more.style.display = hasMore ? 'block' : 'none';
  }

  function loadMoreHistory() {
    _histPage++;
    _renderHistTable(true);
  }

  function setHistFilt(f, btn) {
    _histFilt = f; _histPage = 0;
    queryAll('#page-history .tab').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
    _renderHistory();
  }

  function setHistSort(by, btn) {
    if (_histSort.by === by) _histSort.dir = _histSort.dir === 'desc' ? 'asc' : 'desc';
    else { _histSort = { by, dir:'desc' }; }
    _histPage = 0;
    // Update sort indicators
    queryAll('.sort-btn').forEach(b => {
      b.classList.remove('sort-asc','sort-desc');
      if (b.dataset.sort === by) b.classList.add('sort-' + _histSort.dir);
    });
    _renderHistTable(false);
  }

  /* Bulk select */
  function toggleBulkSelect() {
    _histSelecting = !_histSelecting;
    el('bulk-bar')?.classList.toggle('on', _histSelecting);
    el('bulk-select-btn')?.classList.toggle('active', _histSelecting);
    _renderHistTable(false);
  }

  function _updateBulkBar() {
    const checked = queryAll('#h-tx-body .tx-check:checked');
    const n = checked.length;
    setText('bulk-count', t('hist_delete_selected',{n}));
    el('bulk-delete-btn')?.classList.toggle('on', n > 0);
  }

  function bulkDelete() {
    const ids = [...queryAll('#h-tx-body .tx-check:checked')].map(c => c.dataset.id);
    if (!ids.length) return;
    Confirm(t('confirm_bulk_delete',{n:ids.length}), () => {
      const removed = Store.removeBatch(ids);
      Toast.show(t('toast_bulk_deleted',{n:removed, s:removed!==1?'s':''}), 'info');
      _histPage = 0; _renderHistory();
    }, t('confirm_bulk_title'));
  }

  /* ═══════════════════════════
     TABLE RENDERER (Dashboard)
  ═══════════════════════════ */
  function _renderTxTable(bodyId, emptyId, filter, limit, search, sort) {
    const { items, total } = Store.getPaged(filter, search, 0, sort?.by||'date', sort?.dir||'desc');
    const list = limit ? items.slice(0, limit) : items;
    const body  = el(bodyId), empty = el(emptyId);
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    body.innerHTML = list.map(tx => txRow(tx)).join('');
  }

  /* ═══════════════════════════
     BUDGET
  ═══════════════════════════ */
  function _renderBudget() {
    const monthly = Store.getThisMonth();
    const spent   = Store.spendByCategory(monthly);
    const budgets = Store.getBudgets();
    const totalB  = Object.values(budgets).reduce((s,v) => s+(v||0), 0);
    const totalS  = Object.keys(budgets).reduce((s,k) => s+(spent[k]||0), 0);

    setText('b-total', Store.fmt(totalB));
    setText('b-spent', Store.fmt(totalS));
    setText('b-rem',   Store.fmt(Math.max(totalB-totalS, 0)));

    const pct  = totalB > 0 ? Math.min(Math.round(totalS/totalB*100),100) : 0;
    const fill = el('b-fill');
    if (fill) { const c=pct>=90?'danger':pct>=70?'warn':'safe'; fill.className=`prog-fill ${c}`; fill.style.width=pct+'%'; }
    setText('b-pct', pct+'%');

    // Days left in month
    const now = new Date(), lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const daysLeft = lastDay - now.getDate();
    setText('b-days-left', t('bud_days_left',{n:daysLeft}));

    const listEl = el('b-list');
    if (!listEl) return;
    const cats = Object.keys(budgets).sort((a,b) => {
      const pa = budgets[a]>0?(spent[a]||0)/budgets[a]:0, pb = budgets[b]>0?(spent[b]||0)/budgets[b]:0;
      return pb - pa;
    });

    if (!cats.length) {
      listEl.innerHTML = `<div class="empty" style="padding:24px 0"><div class="empty-ico">🎯</div><p>${h(t('bud_no_budgets'))}</p></div>`;
      return;
    }

    listEl.innerHTML = cats.map(cat => {
      const limit = budgets[cat]||0, s = spent[cat]||0;
      const p2    = limit>0?Math.min(Math.round(s/limit*100),100):0;
      const c     = p2>=90?'danger':p2>=70?'warn':'safe', m = catMeta(cat);
      const rem   = Math.max(limit-s,0);
      return `<div class="budget-item">
        <div class="budget-top">
          <span class="budget-name">${m.emoji} ${h(t(m.key))}</span>
          <div class="budget-right">
            <span class="budget-nums">${h(Store.fmt(s))} / ${h(Store.fmt(limit))}</span>
            <span class="budget-pct ${c}" title="${h(Store.fmt(rem)+' left')}">${p2}%</span>
            ${p2>=90?`<span style="font-size:10px;color:var(--red)">⚠</span>`:''}
            <button class="budget-del" data-cat="${h(cat)}" aria-label="${h(t('delete'))} ${h(t(m.key))} budget">✕</button>
          </div>
        </div>
        <div class="prog-track"><div class="prog-fill ${c}" style="width:${p2}%"></div></div>
      </div>`;
    }).join('');
  }

  function _updateBudgetBadge() {
    const spent   = Store.spendByCategory(Store.getThisMonth());
    const budgets = Store.getBudgets();
    let over = 0;
    Object.keys(budgets).forEach(c => { if (budgets[c]>0 && (spent[c]||0)/budgets[c]>=0.9) over++; });
    el('bn-bud-dot')?.classList.toggle('on', over>0);
    const nb = el('nav-bud-badge');
    if (nb) { nb.textContent=over||''; nb.classList.toggle('on',over>0); }
  }

  /* ═══════════════════════════
     REPORTS
  ═══════════════════════════ */
  function _renderReports() {
    const now = new Date();
    const d   = new Date(now.getFullYear(), now.getMonth() + _rptOffset, 1);
    setText('rpt-month-lbl', d.toLocaleString('default',{month:'long',year:'numeric'}));

    const monthly  = Store.getByMonth(d.getFullYear(), d.getMonth());
    const inc      = Store.sumType(monthly,'income');
    const exp      = Store.sumType(monthly,'expense');
    const catSpend = Store.spendByCategory(monthly);
    const catInc   = Store.incomeByCategory(monthly);
    const rate     = inc>0?Math.max(0,Math.round((inc-exp)/inc*100)):0;

    setText('r-avg',   Store.fmt(Store.avgDailyExpense()));
    setText('r-rate',  rate+'%');
    setText('r-worth', Store.fmt(Store.totalBalance()));
    setText('r-inc',   Store.fmt(inc));
    setText('r-exp',   Store.fmt(exp));
    setHTML('r-inc-trend', trendHTML(Store.momChange('income')));

    const sorted = Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    setText('r-top-cat', sorted.length ? catMeta(sorted[0][0]).emoji+' '+t(catMeta(sorted[0][0]).key) : '—');
    setText('r-top-amt', sorted.length ? Store.fmt(sorted[0][1]) : '');

    // 12-month bar chart (line chart overlay)
    const m12 = Store.last12Months();
    Charts.bar('r-bar-chart', m12, { height:170, colors:[Charts.C_INC, Charts.C_EXP], keys:['inc','exp'] });

    // 30-day area line chart
    const trend30 = Store.dailyTrend(30);
    Charts.line('r-trend-chart', trend30, { height:120, keys:['exp'], colors:[Charts.C_EXP], area:true, dots:false });

    // Expense donut
    const donutData = sorted.slice(0,8).map(([c,v],i)=>({label:t(catMeta(c).key), value:v, color:Charts.COLORS[i%Charts.COLORS.length]}));
    const expLeg = donutData.length
      ? donutData.map(d=>`<div class="dl-item"><span class="dl-dot" style="background:${h(d.color)}"></span><span class="dl-name">${h(d.label)}</span><span class="dl-val">${h(Store.fmt(d.value))}</span></div>`).join('')
      : `<p style="color:var(--t2);font-size:13px">${h(t('rpt_no_expenses'))}</p>`;
    setHTML('r-donut', `<div class="donut-wrap">${Charts.donut(donutData, t('rpt_expense_breakdown').toUpperCase().slice(0,8))}<div class="donut-leg">${expLeg}</div></div>`);

    // Income donut
    const sortedInc = Object.entries(catInc).sort((a,b)=>b[1]-a[1]);
    const incData   = sortedInc.slice(0,6).map(([c,v],i)=>({label:t(catMeta(c).key), value:v, color:Charts.COLORS[(i+3)%Charts.COLORS.length]}));
    const incLeg    = incData.length
      ? incData.map(d=>`<div class="dl-item"><span class="dl-dot" style="background:${h(d.color)}"></span><span class="dl-name">${h(d.label)}</span><span class="dl-val">${h(Store.fmt(d.value))}</span></div>`).join('')
      : `<p style="color:var(--t2);font-size:13px">${h(t('rpt_no_data'))}</p>`;
    setHTML('r-inc-breakdown', incLeg);

    Charts.heatmap('r-heatmap');
  }

  function rptPrev() { _rptOffset--; _renderReports(); }
  function rptNext() { if (_rptOffset < 0) { _rptOffset++; _renderReports(); } }
  function rptPDF()  {
    const ok = PDF.generate(_rptOffset);
    if (ok) Toast.show(t('toast_pdf_ready'), 'success');
    else Toast.show('PDF opened. Use browser Print → Save as PDF.', 'info');
  }

  /* ═══════════════════════════
     SETTINGS
  ═══════════════════════════ */
  function _renderSettings() {
    const s = Store.getSettings();
    setVal('s-name',     s.userName||'');
    setVal('s-currency', s.currency||'৳');

    ['notifications','compactView','showInsights'].forEach(k => {
      const tog = el('tog-'+k);
      if (tog) { tog.classList.toggle('on',!!s[k]); tog.setAttribute('aria-checked',!!s[k]); }
    });

    // Storage gauge
    const info = Store.storageInfo();
    setHTML('s-storage', storageGauge(info));
    setText('s-count', t('hist_n_tx',{n:info.count, s:info.count!==1?'s':''}));

    _updateAvatar(s.userName);

    // Language selector
    setHTML('lang-selector', langSelectorHTML());

    // Backups
    _renderBackups();
    _renderRecurringList();
    _renderGoalsList();
  }

  function _renderBackups() {
    const listEl = el('backup-list');
    if (!listEl) return;
    const backups = Store.getBackups();
    if (!backups.length) {
      listEl.innerHTML = `<p style="font-size:12.5px;color:var(--t2)">${h(t('set_no_backups'))}</p>`;
      return;
    }
    listEl.innerHTML = backups.map((b,i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp3) 0;border-bottom:1px solid var(--b0)">
        <div>
          <div style="font-size:13px;font-weight:500">${h(b.label||'Backup '+(i+1))}</div>
          <div style="font-size:11px;color:var(--t2)">${b.count} transactions · ${new Date(b.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-backup-restore="${i}" style="padding:5px 10px;font-size:11px">${h(t('set_restore'))}</button>
      </div>`).join('');
  }

  function saveSettings() {
    const name = getVal('s-name').trim(), curr = getVal('s-currency');
    if (!name) { Toast.show(t('toast_name_empty'),'error'); return; }
    Store.updateSettings({ userName:name, currency:curr||'৳' });
    _updateAvatar(name);
    setText('sidebar-uname', name);
    _refresh();
    Toast.show(t('toast_settings_saved'),'success');
  }

  function toggleSetting(key, btn) {
    const val = !Store.getSetting(key);
    Store.updateSettings({[key]:val});
    btn?.classList.toggle('on', val);
    btn?.setAttribute('aria-checked', val);
    _refresh();
  }

  function _updateAvatar(name) {
    const p = String(name||'M').trim().split(/\s+/);
    const i = p.length>=2 ? p[0][0].toUpperCase()+p[1][0].toUpperCase() : p[0].slice(0,2).toUpperCase();
    queryAll('.user-av').forEach(e => e.textContent = i);
  }

  /* ═══════════════════════════
     QUICK ADD
  ═══════════════════════════ */
  function setQuickType(type) {
    _quickType = type;
    el('q-inc')?.classList.toggle('on', type==='income');
    el('q-exp')?.classList.toggle('on', type==='expense');
    el('q-inc')?.setAttribute('aria-pressed', type==='income');
    el('q-exp')?.setAttribute('aria-pressed', type==='expense');
    setHTML('q-cat', catOpts(type));
  }

  function quickAdd() {
    const desc = getVal('q-desc').trim(), amount = parseFloat(getVal('q-amt'));
    const cat  = getVal('q-cat'), date = getVal('q-date');
    if (!desc)         { Toast.show(t('toast_save_fail'),'error'); return; }
    if (!(amount>0))   { Toast.show(t('toast_save_fail'),'error'); return; }
    if (!date)         { Toast.show(t('toast_save_fail'),'error'); return; }

    const tx = Store.add({ type:_quickType, desc, amount, category:cat, date, note:'' });
    if (!tx) { Toast.show(t('toast_save_fail'),'error'); return; }

    setVal('q-desc',''); setVal('q-amt',''); setVal('q-date',Store.todayISO());
    Toast.show(_quickType==='income'?t('toast_added_income'):t('toast_added_expense'),'success');
    _renderDash();
  }

  /* ═══════════════════════════
     TRANSACTION MODAL
  ═══════════════════════════ */
  function openAdd(type='income') {
    _editId=null; _modalType=type||'income';
    setText('m-title', t('add_transaction'));
    _clearTxForm();
    setVal('m-date', Store.todayISO());
    Modal.open('tx-modal');
  }

  function editTx(id) {
    const tx = Store.getById(id);
    if (!tx) { Toast.show(t('toast_save_fail'),'error'); return; }
    _editId = id; _modalType = tx.type;
    setText('m-title', t('edit_transaction'));
    setVal('m-desc',   tx.desc);
    setVal('m-amt',    tx.amount);
    setVal('m-date',   tx.date);
    setVal('m-note',   tx.note||'');
    _syncModalType();
    setHTML('m-cat', catOpts(tx.type));
    requestAnimationFrame(() => { const c=el('m-cat'); if(c) c.value=tx.category; });
    Modal.open('tx-modal');
  }

  function setModalType(type) {
    _modalType = type; _syncModalType();
    const prev = getVal('m-cat');
    setHTML('m-cat', catOpts(type));
    requestAnimationFrame(() => { const c=el('m-cat'); if(c&&[...c.options].some(o=>o.value===prev)) c.value=prev; });
  }

  function _syncModalType() {
    ['income','expense'].forEach(t2 => {
      const btn = el('m-'+t2.slice(0,3));
      btn?.classList.toggle('on', _modalType===t2);
      btn?.setAttribute('aria-pressed', _modalType===t2);
    });
  }

  function _clearTxForm() {
    ['m-desc','m-amt','m-note'].forEach(id => setVal(id,''));
    setHTML('m-cat', catOpts(_modalType));
    _syncModalType();
  }

  function submitTx() {
    const desc = getVal('m-desc').trim(), amount = parseFloat(getVal('m-amt'));
    const cat  = getVal('m-cat'), date = getVal('m-date'), note = getVal('m-note').trim();
    if (!desc)         { Toast.show(t('toast_save_fail'),'error'); return; }
    if (!(amount>0))   { Toast.show(t('toast_save_fail'),'error'); return; }
    if (!date)         { Toast.show(t('toast_save_fail'),'error'); return; }

    const data = { type:_modalType, desc, amount, category:cat||'other', date, note };
    if (_editId) {
      Store.update(_editId,data) ? Toast.show(t('toast_updated'),'success') : Toast.show(t('toast_save_fail'),'error');
    } else {
      Store.add(data) ? Toast.show(_modalType==='income'?t('toast_added_income'):t('toast_added_expense'),'success') : Toast.show(t('toast_save_fail'),'error');
    }
    Modal.close('tx-modal');
    _histPage = 0;
    _refresh();
  }

  function deleteTx(id) {
    Confirm(t('confirm_delete_tx'), () => {
      Store.remove(id) ? Toast.show(t('toast_deleted'),'info') : Toast.show(t('toast_save_fail'),'error');
      _histPage = 0; _refresh();
    }, t('confirm_delete_tx_title'));
  }

  /* ═══════════════════════════
     BUDGET MODAL
  ═══════════════════════════ */
  function openBudgetModal() { setVal('bm-limit',''); Modal.open('budget-modal'); }

  function submitBudget() {
    const cat = getVal('bm-cat'), limit = parseFloat(getVal('bm-limit'));
    if (!(limit>0)) { Toast.show(t('toast_save_fail'),'error'); return; }
    Store.setBudget(cat, limit);
    Modal.close('budget-modal');
    _renderBudget(); _updateBudgetBadge();
    Toast.show(t('toast_budget_saved',{cat:t(catMeta(cat).key)}),'success');
  }

  function deleteBudget(cat) {
    Confirm(t('confirm_remove_budget',{cat:t(catMeta(cat).key)}), () => {
      Store.deleteBudget(cat);
      _renderBudget(); _updateBudgetBadge();
      Toast.show(t('toast_budget_removed'),'info');
    }, t('confirm_remove_budget_title'));
  }

  /* ═══════════════════════════
     RECURRING
  ═══════════════════════════ */
  function openRecurModal() {
    setVal('rec-desc',''); setVal('rec-amt',''); setVal('rec-date',Store.todayISO());
    _recType = 'income';
    el('rec-inc')?.classList.add('on'); el('rec-exp')?.classList.remove('on');
    setHTML('rec-cat', catOpts('income'));
    Modal.open('recur-modal');
  }

  function setRecType(type) {
    _recType = type;
    el('rec-inc')?.classList.toggle('on', type==='income');
    el('rec-exp')?.classList.toggle('on', type==='expense');
    setHTML('rec-cat', catOpts(type));
  }

  function submitRecur() {
    const desc = getVal('rec-desc').trim(), amount = parseFloat(getVal('rec-amt'));
    const cat  = getVal('rec-cat'), date = getVal('rec-date'), freq = getVal('rec-freq');
    if (!desc||!(amount>0)||!date) { Toast.show(t('toast_save_fail'),'error'); return; }
    const r = Store.addRecurring({ type:_recType, desc, amount, category:cat||'other', nextDate:date, freq });
    if (!r) { Toast.show(t('toast_save_fail'),'error'); return; }
    Modal.close('recur-modal');
    _renderRecurringList();
    Toast.show(t('toast_recur_added',{name:r.desc}),'success');
  }

  function _renderRecurringList() {
    const listEl = el('recur-list');
    if (!listEl) return;
    const all = Store.getRecurring();
    if (!all.length) {
      listEl.innerHTML = `<div class="empty" style="padding:20px 0"><div class="empty-ico">↻</div><p>${h(t('rpt_no_data'))}</p></div>`;
      return;
    }
    const freqLabel = { weekly:t('lbl_weekly'), monthly:t('lbl_monthly'), yearly:t('lbl_yearly'), daily:t('lbl_daily') };
    listEl.innerHTML = all.map(r => {
      const m = catMeta(r.category), next = Store.fmtDateShort(r.nextDate)||r.nextDate;
      return `<div class="recur-item">
        <div style="width:34px;height:34px;border-radius:var(--r1);background:${r.type==='income'?'var(--grn-dim)':'var(--red-dim)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${m.emoji}</div>
        <div class="recur-info">
          <div class="recur-desc">${h(r.desc)}</div>
          <div class="recur-freq">${freqLabel[r.freq]||r.freq} · Next: ${h(next)}</div>
        </div>
        <span class="recur-amt ${r.type==='income'?'inc':'exp'}">${r.type==='income'?'+':'−'}${h(Store.fmt(r.amount))}</span>
        <div style="display:flex;gap:3px">
          <button class="act-btn" data-recur-toggle="${h(r.id)}" title="${r.active?t('toast_paused'):t('toast_resumed')}" style="opacity:${r.active?1:.4}">${r.active?'⏸':'▶'}</button>
          <button class="act-btn del" data-recur-del="${h(r.id)}" title="${t('delete')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
        </div>
      </div>`;
    }).join('');
  }

  /* ═══════════════════════════
     GOALS
  ═══════════════════════════ */
  function openGoalModal() {
    setVal('goal-name',''); setVal('goal-target',''); setVal('goal-saved','0');
    setVal('goal-deadline',''); setVal('goal-emoji','🎯');
    Modal.open('goal-modal');
  }

  function submitGoal() {
    const name = getVal('goal-name').trim(), target = parseFloat(getVal('goal-target'));
    const saved = parseFloat(getVal('goal-saved'))||0, deadline = getVal('goal-deadline');
    const emoji = getVal('goal-emoji')||'🎯';
    if (!name||!(target>0)) { Toast.show(t('toast_save_fail'),'error'); return; }
    const g = Store.addGoal({ name, emoji, target, saved, deadline });
    if (!g) { Toast.show(t('toast_save_fail'),'error'); return; }
    Modal.close('goal-modal');
    _renderGoalsList();
    Toast.show(t('toast_goal_added',{name:g.name}),'success');
  }

  function submitGoalAdd() {
    const id  = getVal('goal-add-id');
    const amt = parseFloat(getVal('goal-add-amt'));
    if (!(amt>0)) { Toast.show(t('toast_save_fail'),'error'); return; }
    const g = Store.getGoals().find(g=>g.id===id);
    if (!g) return;
    Store.updateGoal(id, { saved: g.saved+amt });
    Modal.close('goal-add-modal');
    _renderGoalsList();
    Toast.show(`${Store.fmt(amt)} added to goal!`,'success');
  }

  function _renderGoalsList() {
    const listEl = el('goals-list');
    if (!listEl) return;
    const all = Store.getGoals();
    if (!all.length) {
      listEl.innerHTML = `<div class="empty" style="padding:20px 0"><div class="empty-ico">🏆</div><p>${h(t('rpt_no_data'))}</p></div>`;
      return;
    }
    listEl.innerHTML = all.map(g => {
      const pct = g.target>0?Math.min(Math.round(g.saved/g.target*100),100):0;
      const c = pct>=100?'safe':pct>=50?'warn':'danger';
      const col = pct>=100?'var(--grn)':pct>=50?'var(--acc)':'var(--red)';
      return `<div class="goal-card">
        <div class="goal-header">
          <div class="goal-title">${h(g.emoji)} ${h(g.name)}${g.deadline?` <span style="font-size:11px;color:var(--t2)">· ${Store.fmtDateShort(g.deadline)}</span>`:''}</div>
          <div style="display:flex;align-items:center;gap:var(--sp2)">
            <span style="font-family:var(--ff-mono);font-size:15px;font-weight:700;color:${col}">${pct}%</span>
            <button class="act-btn del" data-goal-del="${h(g.id)}" title="${t('delete')}" aria-label="${t('delete')} goal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>
          </div>
        </div>
        <div class="prog-track" style="margin-bottom:var(--sp3)"><div class="prog-fill ${c}" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:var(--ff-mono);font-size:12px;color:var(--t2)">${h(Store.fmt(g.saved))} / ${h(Store.fmt(g.target))}</span>
          <button class="btn btn-ghost btn-sm" onclick="openGoalAddModal('${h(g.id)}','${h(g.name)}')" style="padding:4px 10px;font-size:11px">+ Add</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ═══════════════════════════
     EXPORT / IMPORT
  ═══════════════════════════ */
  function exportCSV() {
    if (!Store.getAll().length) { Toast.show(t('toast_save_fail'),'error'); return; }
    download(Store.exportCSV(), `cashflow_${Store.todayISO()}.csv`, 'text/csv;charset=utf-8;');
    Toast.show(t('toast_exported_csv'),'success');
  }

  function exportJSON() {
    const snap = Store.manualBackup();
    download(snap.data, `cashflow_backup_${Store.todayISO()}.json`, 'application/json');
    _renderBackups?.();
    Toast.show(t('toast_backup_saved'),'success');
  }

  function _renderBackups() {
    const listEl = el('backup-list');
    if (!listEl) return;
    const backups = Store.getBackups();
    if (!backups.length) {
      listEl.innerHTML = `<p style="font-size:12.5px;color:var(--t2)">${h(t('set_no_backups'))}</p>`;
      return;
    }
    listEl.innerHTML = backups.map((b,i) => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--sp3) 0;border-bottom:1px solid var(--b0)">
        <div>
          <div style="font-size:13px;font-weight:500">${h(b.label||'Backup '+(i+1))}</div>
          <div style="font-size:11px;color:var(--t2)">${b.count} tx · ${new Date(b.timestamp).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</div>
        </div>
        <button class="btn btn-ghost btn-sm" data-restore-idx="${i}" style="padding:5px 10px;font-size:11px">${h(t('set_restore'))}</button>
      </div>`).join('');
  }

  function importJSON() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.addEventListener('change', e => {
      const f = e.target.files?.[0]; if (!f) return;
      const r = new FileReader();
      r.onload = ev => {
        const preview = Store.previewImport(String(ev.target.result));
        if (!preview.ok) { Toast.show(t('toast_import_fail'),'error'); return; }
        Confirm(
          `Import ${preview.txCount} transactions, ${preview.budgetCount} budgets, ${preview.goalCount} goals?\n(Current data will be replaced)`,
          () => {
            const res = Store.importJSON(String(ev.target.result));
            if (res.ok) { Toast.show(t('toast_imported'),'success'); _histPage=0; _refresh(); }
            else Toast.show(t('toast_import_fail'),'error');
          }, 'Import Data'
        );
      };
      r.onerror = () => Toast.show(t('toast_import_fail'),'error');
      r.readAsText(f);
    });
    inp.click();
  }

  function clearData() {
    Confirm(t('confirm_clear'), () => {
      Store.clearAll();
      _histPage = 0;
      Toast.show(t('toast_cleared'),'info');
      _refresh();
    }, t('confirm_clear_title'));
  }

  /* ═══════════════════════════
     PWA
  ═══════════════════════════ */
  function _registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', { scope:'/CashFlow/' })
      .then(reg => {
        if (reg.waiting) _showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => {
            if (w.state==='installed' && navigator.serviceWorker.controller) _showUpdateBanner(w);
          });
        });
      }).catch(e => console.warn('[SW]', e));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (_updating) location.reload(); });
  }

  function _showUpdateBanner(worker) {
    if (_updateBannerBound) return;
    _updateBannerBound = true;
    el('update-strip')?.classList.add('on');
    el('update-btn')?.addEventListener('click', () => { _updating=true; worker.postMessage({type:'SKIP_WAITING'}); });
  }

  function _setupInstall() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); _installEvt = e;
      if (!sessionStorage.getItem('pwa_dismissed')) el('install-banner')?.classList.add('on');
    });
    window.addEventListener('appinstalled', () => {
      el('install-banner')?.classList.remove('on'); _installEvt = null;
      Toast.show(t('toast_installed'),'success',4000);
    });
  }

  function triggerInstall() {
    if (!_installEvt) return;
    _installEvt.prompt();
    _installEvt.userChoice.then(() => { el('install-banner')?.classList.remove('on'); _installEvt=null; });
  }

  function dismissInstall() {
    el('install-banner')?.classList.remove('on');
    sessionStorage.setItem('pwa_dismissed','1');
  }

  function _setupOffline() {
    function upd() { el('offline-bar')?.classList.toggle('on',!navigator.onLine); }
    window.addEventListener('online', upd); window.addEventListener('offline', upd); upd();
  }

  /* ═══════════════════════════
     EVENT DELEGATION
  ═══════════════════════════ */
  function _bindDelegation() {
    // Budget list
    el('b-list')?.addEventListener('click', e => {
      const b = e.target.closest('.budget-del'); if (b) deleteBudget(b.dataset.cat);
    });
    // Recurring list
    el('recur-list')?.addEventListener('click', e => {
      const tog = e.target.closest('[data-recur-toggle]');
      const del = e.target.closest('[data-recur-del]');
      if (tog) { const a=Store.toggleRecurring(tog.dataset.recurToggle); _renderRecurringList(); Toast.show(a?t('toast_resumed'):t('toast_paused'),'info'); }
      if (del) Confirm(t('confirm_remove_recur'),() => { Store.deleteRecurring(del.dataset.recurDel); _renderRecurringList(); Toast.show(t('toast_recur_removed'),'info'); },t('confirm_remove_recur_title'));
    });
    // Goals list
    el('goals-list')?.addEventListener('click', e => {
      const gd = e.target.closest('[data-goal-del]');
      if (gd) Confirm(t('confirm_delete_goal'),() => { Store.deleteGoal(gd.dataset.goalDel); _renderGoalsList(); Toast.show(t('toast_goal_removed'),'info'); },t('confirm_delete_goal_title'));
    });
    // History checkboxes
    el('h-tx-body')?.addEventListener('change', e => {
      if (e.target.classList.contains('tx-check')) _updateBulkBar();
    });
    // Backup restore
    el('backup-list')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-restore-idx]');
      if (!btn) return;
      const idx = parseInt(btn.dataset.restoreIdx);
      Confirm(t('confirm_restore'), () => {
        const res = Store.restoreBackup(idx);
        if (res?.ok) { Toast.show(t('toast_imported'),'success'); _histPage=0; _refresh(); }
        else Toast.show(t('toast_import_fail'),'error');
      }, t('confirm_restore_title'));
    });
    // Sort headers
    queryAll('.sort-btn').forEach(btn => {
      btn.addEventListener('click', () => setHistSort(btn.dataset.sort, btn));
    });
  }

  /* ═══════════════════════════
     KEYBOARD SHORTCUTS
  ═══════════════════════════ */
  function _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        ['tx-modal','budget-modal','recur-modal','goal-modal','goal-add-modal'].forEach(id => Modal.close(id));
        el('confirm-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
      }
      if ((e.ctrlKey||e.metaKey) && e.key==='k') { e.preventDefault(); openAdd(); }
      const ae = document.activeElement;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && ae && !['INPUT','TEXTAREA','SELECT'].includes(ae.tagName)) {
        const map = {'1':'dashboard','2':'history','3':'budget','4':'reports','5':'settings'};
        if (map[e.key]) goTo(map[e.key]);
      }
    });
  }

  /* ═══════════════════════════
     URL PARAMS
  ═══════════════════════════ */
  function _handleParams() {
    const p = new URLSearchParams(location.search), a = p.get('action');
    if (a==='add-income')  requestAnimationFrame(() => openAdd('income'));
    if (a==='add-expense') requestAnimationFrame(() => openAdd('expense'));
    if (a) history.replaceState({}, document.title, location.pathname);
  }

  function _currentMonthLabel() {
    return new Date().toLocaleString(I18n.getMeta().locale||'default', {month:'long',year:'numeric'});
  }

  /* ═══════════════════════════
     INIT
  ═══════════════════════════ */
  function init() {
    // i18n first
    I18n.init();
    applyI18n();

    // Apply due recurring (batch)
    const applied = Store.applyDueRecurring();
    if (applied) console.log(`[CF] Applied ${applied} recurring entries`);

    // Auto-backup
    const backed = Store.autoBackup();
    if (backed) console.log('[CF] Auto-backup complete');

    // Dates
    const today = Store.todayISO();
    queryAll('input[type=date]').forEach(e => { if (!e.value) e.value = today; });

    // Category selects
    setHTML('q-cat', catOpts('income'));
    setHTML('m-cat', catOpts('income'));
    setHTML('rec-cat', catOpts('income'));

    // Avatar
    const s = Store.getSettings();
    _updateAvatar(s.userName);
    setText('sidebar-uname', s.userName);

    // History search
    const srch = el('hist-search');
    if (srch) { let timer; srch.addEventListener('input', () => { clearTimeout(timer); _histSearch=srch.value; timer=setTimeout(()=>{ _histPage=0; _renderHistory(); },220); }); }

    // Mobile search sync
    const ms = el('hist-search-m');
    if (ms && srch) { let timer; ms.addEventListener('input', () => { srch.value=ms.value; _histSearch=ms.value; clearTimeout(timer); timer=setTimeout(()=>{ _histPage=0; _renderHistory(); },220); }); }

    // Table delegation
    bindTable('d-tx-body');
    bindTable('h-tx-body');
    _bindDelegation();
    _bindKeys();

    // Storage events
    window.addEventListener('cf:quota', () => Toast.show(t('toast_storage_full'),'error',6000));
    window.addEventListener('cf:storage_warn', e => {
      if (e.detail?.pct >= 80) Toast.show(`Storage ${e.detail.pct}% full — consider exporting data.`, 'info', 5000);
    });

    // Language change → re-render
    window.addEventListener('cf:lang_changed', () => { applyI18n(); _refresh(); });

    // PWA
    _registerSW(); _setupInstall(); _setupOffline();
    _handleParams();

    // Mobile search wrap toggle
    function toggleMSrch() {
      const w = el('hist-search-m-wrap');
      if (w) w.style.display = window.innerWidth<=768?'block':'none';
    }
    window.addEventListener('resize', toggleMSrch);
    toggleMSrch();

    // Chart resize
    window.addEventListener('resize', () => {
      if (_page==='dashboard')  { Charts.bar('d-chart',Store.last7Days(),{height:130,colors:[Charts.C_INC,Charts.C_EXP],keys:['inc','exp']}); }
      if (_page==='reports')    { _renderReports(); }
    });

    goTo('dashboard');
  }

  return Object.freeze({
    init, goTo, toggleSidebar, setLanguage,
    // Dashboard
    setDashFilt, setQuickType, quickAdd,
    // History
    setHistFilt, loadMoreHistory, toggleBulkSelect, bulkDelete,
    // Budget
    openBudgetModal, submitBudget, deleteBudget,
    // Transactions
    openAdd, editTx, deleteTx, setModalType, submitTx,
    // Recurring
    openRecurModal, setRecType, submitRecur,
    // Goals
    openGoalModal, submitGoal, submitGoalAdd,
    // Reports
    rptPrev, rptNext, rptPDF,
    // Settings
    saveSettings, toggleSetting,
    // Export
    exportCSV, exportJSON, importJSON, clearData,
    // PWA
    triggerInstall, dismissInstall,
  });
})();

document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
