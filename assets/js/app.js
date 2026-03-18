/* CashFlow — App v3.0 */
'use strict';

const App = (() => {
  /* ── State ── */
  let _page      = 'dashboard';
  let _dashFilt  = 'all';
  let _histFilt  = 'all';
  let _modalType = 'income';
  let _quickType = 'income';
  let _editId    = null;
  let _installEvt= null;
  let _updating  = false;
  // Reports month offset (0 = current, -1 = prev, etc.)
  let _rptMonth  = 0;

  /* ══════════════════════════
     NAVIGATION
  ══════════════════════════ */
  function goTo(name) {
    const pg=el('page-'+name); if(!pg) return;
    _page=name;

    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    pg.classList.add('active');

    document.querySelectorAll('[data-page]').forEach(e=>{
      e.classList.toggle('active', e.dataset.page===name);
      if(e.classList.contains('nav-link')) e.setAttribute('aria-current', e.dataset.page===name?'page':'false');
      if(e.classList.contains('bn')) e.setAttribute('aria-current', e.dataset.page===name?'page':'false');
    });

    const titles={dashboard:'Dashboard',history:'History',budget:'Budget',reports:'Reports',settings:'Settings'};
    setText('topbar-title', titles[name]||'');

    _renders[name]?.();

    if(window.innerWidth<=768) _closeSidebar();
    window.scrollTo({top:0,behavior:'smooth'});
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
    const s=el('sidebar'), m=el('sidebar-mask');
    const open=s.classList.toggle('open');
    m?.classList.toggle('on',open);
  }
  function _closeSidebar() {
    el('sidebar')?.classList.remove('open');
    el('sidebar-mask')?.classList.remove('on');
  }

  /* ══════════════════════════
     DASHBOARD
  ══════════════════════════ */
  function _renderDash() {
    const monthly = Store.getThisMonth();
    const inc     = Store.sumType(monthly,'income');
    const exp     = Store.sumType(monthly,'expense');
    const bal     = Store.totalBalance();
    const net     = inc-exp;
    const rate    = inc>0?Math.round(Math.max(0,(inc-exp)/inc*100)):0;
    const momI    = Store.momChange('income');
    const momE    = Store.momChange('expense');

    setText('d-month', currentMonthLabel());
    setText('d-bal',   Store.fmt(bal));
    setText('d-inc',   Store.fmt(inc));
    setText('d-exp',   Store.fmt(exp));
    setText('d-net',   Store.fmt(net));
    setText('d-rate',  rate+'%');
    setHTML('d-inc-trend', trendHTML(momI));
    setHTML('d-exp-trend', trendHTML(-momE));  // invert: less exp = good

    const balEl=el('d-bal');
    if(balEl) balEl.className='kpi-val '+(bal<0?'neg':'acc');
    const netEl=el('d-net');
    if(netEl) netEl.className='kpi-val '+(net<0?'neg':'pos');

    _renderTxTable('d-tx-body','d-empty',_dashFilt,10,'');
    renderBarChart('d-chart', Store.last7Days(), 100);
    _renderInsights(monthly, inc, exp);
    _updateBadge();
  }

  function _renderInsights(monthly, inc, exp) {
    if(!Store.getSetting('showInsights')) return setHTML('d-insights','');
    const chips=[];
    const top=Object.entries(Store.spendByCategory(monthly)).sort((a,b)=>b[1]-a[1])[0];
    if(top) chips.push(`<div class="insight-chip"><span class="ic-icon">${catMeta(top[0]).emoji}</span> Top spend: ${catMeta(top[0]).label} — ${Store.fmt(top[1])}</div>`);
    const rate=inc>0?Math.round((inc-exp)/inc*100):0;
    if(rate>=20) chips.push(`<div class="insight-chip d1"><span class="ic-icon">💚</span> Saving ${rate}% of income</div>`);
    else if(rate<0) chips.push(`<div class="insight-chip d1"><span class="ic-icon">⚠️</span> Spending exceeds income</div>`);
    const due=Store.getDueRecurring();
    if(due.length) chips.push(`<div class="insight-chip d2"><span class="ic-icon">↻</span> ${due.length} recurring payment${due.length>1?'s':''} due</div>`);
    const streak=Store.expenseStreak();
    if(streak>=3) chips.push(`<div class="insight-chip d3"><span class="ic-icon">🔥</span> ${streak}-day expense streak</div>`);
    setHTML('d-insights', chips.join(''));
  }

  function setDashFilt(f, btn) {
    _dashFilt=f;
    document.querySelectorAll('#page-dashboard .tab').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    _renderTxTable('d-tx-body','d-empty',_dashFilt,10,'');
  }

  /* ══════════════════════════
     HISTORY
  ══════════════════════════ */
  function _renderHistory() {
    const q=getVal('hist-search');
    const all=Store.getAll();
    const inc=Store.sumType(all,'income'), exp=Store.sumType(all,'expense');

    setText('h-inc', Store.fmt(inc));
    setText('h-exp', Store.fmt(exp));
    setText('h-bal', Store.fmt(inc-exp));
    setText('h-cnt', `${all.length} transaction${all.length!==1?'s':''}`);
    _renderTxTable('h-tx-body','h-empty',_histFilt,null,q);
  }

  function setHistFilt(f,btn) {
    _histFilt=f;
    document.querySelectorAll('#page-history .tab').forEach(b=>b.classList.remove('active'));
    btn?.classList.add('active');
    _renderHistory();
  }

  /* ══════════════════════════
     TABLE RENDERER
  ══════════════════════════ */
  function _renderTxTable(bodyId, emptyId, filter, limit, search) {
    let list=[...Store.getAll()].sort((a,b)=>{
      const dc=b.date.localeCompare(a.date);
      return dc!==0?dc:(b.createdAt||0)-(a.createdAt||0);
    });
    if(filter!=='all') list=list.filter(t=>t.type===filter);
    if(search&&search.trim()) {
      const q=search.trim().toLowerCase();
      list=list.filter(t=>(t.desc||'').toLowerCase().includes(q)||(t.category||'').toLowerCase().includes(q)||(t.note||'').toLowerCase().includes(q)||(t.date||'').includes(q));
    }
    if(limit!==null&&limit!==undefined&&limit>0) list=list.slice(0,limit);

    const body=el(bodyId), empty=el(emptyId);
    if(!body) return;
    if(!list.length) {
      body.innerHTML='';
      if(empty) empty.style.display='block';
      return;
    }
    if(empty) empty.style.display='none';
    body.innerHTML=list.map(txRow).join('');
  }

  /* ══════════════════════════
     BUDGET
  ══════════════════════════ */
  function _renderBudget() {
    const monthly=Store.getThisMonth(), spent=Store.spendByCategory(monthly);
    const budgets=Store.getBudgets();
    const totalB=Object.values(budgets).reduce((s,v)=>s+(v||0),0);
    const totalS=Object.keys(budgets).reduce((s,k)=>s+(spent[k]||0),0);

    setText('b-total', Store.fmt(totalB));
    setText('b-spent', Store.fmt(totalS));
    setText('b-rem',   Store.fmt(Math.max(totalB-totalS,0)));

    const pct=totalB>0?Math.min(Math.round(totalS/totalB*100),100):0;
    const fill=el('b-fill');
    if(fill) { const c=pct>=90?'danger':pct>=70?'warn':'safe'; fill.className=`prog-fill ${c}`; fill.style.width=pct+'%'; }
    setText('b-pct', pct+'%');

    const listEl=el('b-list');
    if(!listEl) return;

    const cats=Object.keys(budgets).sort((a,b)=>{
      const pa=budgets[a]>0?(spent[a]||0)/budgets[a]:0, pb=budgets[b]>0?(spent[b]||0)/budgets[b]:0;
      return pb-pa;
    });

    if(!cats.length) {
      listEl.innerHTML=`<div class="empty" style="padding:28px 0"><div class="empty-ico">🎯</div><p>No budgets set.<br>Tap "+ Add Budget" to start.</p></div>`;
      return;
    }
    listEl.innerHTML=cats.map(cat=>{
      const limit=budgets[cat]||0, s=spent[cat]||0;
      const pct=limit>0?Math.min(Math.round(s/limit*100),100):0;
      const c=pct>=90?'danger':pct>=70?'warn':'safe', m=catMeta(cat);
      return `<div class="budget-item">
        <div class="budget-top">
          <span class="budget-name">${m.emoji} ${h(m.label)}</span>
          <div class="budget-right">
            <span class="budget-nums">${h(Store.fmt(s))} / ${h(Store.fmt(limit))}</span>
            <span class="budget-pct ${c}">${pct}%</span>
            <button class="budget-del" data-cat="${h(cat)}" aria-label="Remove ${h(m.label)} budget">✕</button>
          </div>
        </div>
        <div class="prog-track"><div class="prog-fill ${c}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
  }

  function _updateBadge() {
    const spent=Store.spendByCategory(Store.getThisMonth()), budgets=Store.getBudgets();
    let over=0;
    Object.keys(budgets).forEach(c=>{ if(budgets[c]>0&&(spent[c]||0)/budgets[c]>=0.9) over++; });
    el('bn-bud-dot')?.classList.toggle('on',over>0);
    const nb=el('nav-bud-badge');
    if(nb){ nb.textContent=over||''; nb.classList.toggle('on',over>0); }
  }

  /* ══════════════════════════
     REPORTS  (with month nav)
  ══════════════════════════ */
  function _renderReports() {
    // Month navigation
    const now=new Date(), y=now.getFullYear(), m=now.getMonth()+_rptMonth;
    const d=new Date(y, m, 1);
    setText('rpt-month-lbl', d.toLocaleString('default',{month:'long',year:'numeric'}));

    const monthly  = Store.getByMonth(d.getFullYear(), d.getMonth());
    const inc      = Store.sumType(monthly,'income');
    const exp      = Store.sumType(monthly,'expense');
    const catSpend = Store.spendByCategory(monthly);
    const rate     = inc>0?Math.max(0,Math.round((inc-exp)/inc*100)):0;

    setText('r-avg',  Store.fmt(Store.avgDailyExpense()));
    setText('r-rate', rate+'%');
    setText('r-worth',Store.fmt(Store.totalBalance()));
    setText('r-inc',  Store.fmt(inc));
    setText('r-exp',  Store.fmt(exp));

    const sorted=Object.entries(catSpend).sort((a,b)=>b[1]-a[1]);
    setText('r-top-cat', sorted.length?catMeta(sorted[0][0]).emoji+' '+catMeta(sorted[0][0]).label:'—');
    setText('r-top-amt', sorted.length?Store.fmt(sorted[0][1]):'');

    // MoM trends
    setHTML('r-inc-trend', trendHTML(Store.momChange('income')));
    setHTML('r-exp-trend', trendHTML(-Store.momChange('expense')));

    renderBarChart('r-6m-chart', Store.last6Months(), 150);

    const donutData=sorted.slice(0,8).map(([c,v],i)=>({label:catMeta(c).label,value:v,color:COLORS[i%COLORS.length]}));
    const leg=donutData.length
      ? donutData.map(d=>`<div class="dl-item"><span class="dl-dot" style="background:${h(d.color)}"></span><span class="dl-name">${h(d.label)}</span><span class="dl-val">${h(Store.fmt(d.value))}</span></div>`).join('')
      : '<p style="color:var(--t2);font-size:13px">No expenses this period.</p>';
    setHTML('r-donut', `<div class="donut-wrap">${renderDonut(donutData,'EXPENSES')}<div class="donut-leg">${leg}</div></div>`);

    // Income breakdown
    const incCats=Object.entries(Store.incomeByCategory(monthly)).sort((a,b)=>b[1]-a[1]);
    const incLeg=incCats.length
      ? incCats.map(([c,v],i)=>`<div class="dl-item"><span class="dl-dot" style="background:${COLORS[(i+3)%COLORS.length]}"></span><span class="dl-name">${catMeta(c).emoji} ${h(catMeta(c).label)}</span><span class="dl-val">${h(Store.fmt(v))}</span></div>`).join('')
      : '<p style="color:var(--t2);font-size:13px">No income this period.</p>';
    setHTML('r-inc-breakdown', incLeg);

    // Heatmap
    renderHeatmap('r-heatmap');
  }

  function rptPrevMonth() { _rptMonth--; _renderReports(); }
  function rptNextMonth() { if(_rptMonth<0) { _rptMonth++; _renderReports(); } }

  /* ══════════════════════════
     SETTINGS
  ══════════════════════════ */
  function _renderSettings() {
    const s=Store.getSettings();
    setVal('s-name', s.userName||'');
    setVal('s-currency', s.currency||'৳');

    const toggles=['notifications','compactView','showInsights'];
    toggles.forEach(k=>{
      const t=el('tog-'+k); if(!t) return;
      t.classList.toggle('on',!!s[k]);
      t.setAttribute('aria-checked', !!s[k]);
    });

    const info=Store.storageInfo();
    setText('s-size',  info.total);
    setText('s-count', `${info.count} transaction${info.count!==1?'s':''}`);
    _updateAvatar(s.userName);

    // Recurring list
    _renderRecurringList();
    // Goals list
    _renderGoalsList();
  }

  function saveSettings() {
    const name=getVal('s-name').trim(), curr=getVal('s-currency');
    if(!name) { Toast.show('Name cannot be empty.','error'); return; }
    Store.updateSettings({userName:name, currency:curr||'৳'});
    _updateAvatar(name);
    setText('sidebar-uname', name);
    // Re-render current page to update currency display
    _refresh();
    Toast.show('Settings saved!','success');
  }

  function toggleSetting(key, btn) {
    const val=!Store.getSetting(key);
    Store.updateSettings({[key]:val});
    btn?.classList.toggle('on',val);
    btn?.setAttribute('aria-checked',val);
    _refresh();
  }

  function _updateAvatar(name) {
    const p=String(name||'M').trim().split(/\s+/);
    const i=p.length>=2?p[0][0].toUpperCase()+p[1][0].toUpperCase():p[0].slice(0,2).toUpperCase();
    document.querySelectorAll('.user-av').forEach(e=>e.textContent=i);
  }

  /* ══════════════════════════
     QUICK ADD
  ══════════════════════════ */
  function setQuickType(t) {
    _quickType=t;
    el('q-inc')?.classList.toggle('on',t==='income');
    el('q-exp')?.classList.toggle('on',t==='expense');
    el('q-inc')?.setAttribute('aria-pressed',t==='income');
    el('q-exp')?.setAttribute('aria-pressed',t==='expense');
    setHTML('q-cat', catOpts(t));
  }

  function quickAdd() {
    const desc=getVal('q-desc').trim(), amount=parseFloat(getVal('q-amt'));
    const cat=getVal('q-cat'), date=getVal('q-date');
    if(!desc)         { Toast.show('Enter a description.','error');  return; }
    if(!(amount>0))   { Toast.show('Enter a valid amount.','error'); return; }
    if(!date)         { Toast.show('Select a date.','error');        return; }
    const tx=Store.add({type:_quickType,desc,amount,category:cat,date,note:''});
    if(!tx) { Toast.show('Could not save. Check your input.','error'); return; }
    setVal('q-desc',''); setVal('q-amt',''); setVal('q-date',Store.todayISO());
    Toast.show(`${_quickType==='income'?'📈 Income':'📉 Expense'} added!`,'success');
    _renderDash();
  }

  /* ══════════════════════════
     TX MODAL
  ══════════════════════════ */
  function openAdd(type='income') {
    _editId=null; _modalType=type||'income';
    setText('m-title','Add Transaction');
    _clearTxForm();
    setVal('m-date',Store.todayISO());
    Modal.open('tx-modal');
  }

  function editTx(id) {
    const tx=Store.getById(id); if(!tx){ Toast.show('Not found.','error'); return; }
    _editId=id; _modalType=tx.type;
    setText('m-title','Edit Transaction');
    setVal('m-desc',tx.desc); setVal('m-amt',tx.amount);
    setVal('m-date',tx.date); setVal('m-note',tx.note||'');
    _syncModalType();
    setHTML('m-cat', catOpts(tx.type));
    requestAnimationFrame(()=>{ const c=el('m-cat'); if(c) c.value=tx.category; });
    Modal.open('tx-modal');
  }

  function setModalType(t) {
    _modalType=t; _syncModalType();
    const prev=getVal('m-cat');
    setHTML('m-cat', catOpts(t));
    requestAnimationFrame(()=>{ const c=el('m-cat'); if(c&&Array.from(c.options).some(o=>o.value===prev)) c.value=prev; });
  }

  function _syncModalType() {
    el('m-inc')?.classList.toggle('on',_modalType==='income');
    el('m-exp')?.classList.toggle('on',_modalType==='expense');
    el('m-inc')?.setAttribute('aria-pressed',_modalType==='income');
    el('m-exp')?.setAttribute('aria-pressed',_modalType==='expense');
  }

  function _clearTxForm() {
    ['m-desc','m-amt','m-note'].forEach(id=>setVal(id,''));
    setHTML('m-cat', catOpts(_modalType)); _syncModalType();
  }

  function submitTx() {
    const desc=getVal('m-desc').trim(), amount=parseFloat(getVal('m-amt'));
    const cat=getVal('m-cat'), date=getVal('m-date'), note=getVal('m-note').trim();
    if(!desc)       { Toast.show('Enter a description.','error');  return; }
    if(!(amount>0)) { Toast.show('Enter a valid amount.','error'); return; }
    if(!date)       { Toast.show('Select a date.','error');        return; }
    const data={type:_modalType,desc,amount,category:cat||'other',date,note};
    if(_editId) {
      Store.update(_editId,data)?Toast.show('Updated!','success'):Toast.show('Update failed.','error');
    } else {
      Store.add(data)?Toast.show('Transaction saved!','success'):Toast.show('Could not save.','error');
    }
    Modal.close('tx-modal'); _refresh();
  }

  function deleteTx(id) {
    Confirm('Delete this transaction? This cannot be undone.', ()=>{
      Store.remove(id)?Toast.show('Deleted.','info'):Toast.show('Delete failed.','error');
      _refresh();
    },'Delete Transaction');
  }

  /* ══════════════════════════
     BUDGET MODAL
  ══════════════════════════ */
  function openBudgetModal() { setVal('bm-limit',''); Modal.open('budget-modal'); }

  function submitBudget() {
    const cat=getVal('bm-cat'), limit=parseFloat(getVal('bm-limit'));
    if(!(limit>0)){ Toast.show('Enter a valid limit.','error'); return; }
    Store.setBudget(cat,limit);
    Modal.close('budget-modal'); _renderBudget(); _updateBadge();
    Toast.show(`Budget for ${catMeta(cat).label} saved!`,'success');
  }

  function deleteBudget(cat) {
    Confirm(`Remove budget for ${catMeta(cat).label}?`, ()=>{
      Store.deleteBudget(cat); _renderBudget(); _updateBadge();
      Toast.show('Budget removed.','info');
    },'Remove Budget');
  }

  /* ══════════════════════════
     RECURRING
  ══════════════════════════ */
  function openRecurModal() {
    setVal('rec-desc',''); setVal('rec-amt',''); setVal('rec-date',Store.todayISO());
    el('rec-inc')?.classList.add('on'); el('rec-exp')?.classList.remove('on');
    setHTML('rec-cat', catOpts('income')); _recType='income';
    Modal.open('recur-modal');
  }

  let _recType='income';
  function setRecType(t) {
    _recType=t;
    el('rec-inc')?.classList.toggle('on',t==='income');
    el('rec-exp')?.classList.toggle('on',t==='expense');
    setHTML('rec-cat', catOpts(t));
  }

  function submitRecur() {
    const desc=getVal('rec-desc').trim(), amount=parseFloat(getVal('rec-amt'));
    const cat=getVal('rec-cat'), date=getVal('rec-date'), freq=getVal('rec-freq');
    if(!desc)       { Toast.show('Enter a description.','error');  return; }
    if(!(amount>0)) { Toast.show('Enter a valid amount.','error'); return; }
    if(!date)       { Toast.show('Select a start date.','error');  return; }
    const r=Store.addRecurring({type:_recType,desc,amount,category:cat||'other',nextDate:date,freq});
    if(!r){ Toast.show('Could not save recurring.','error'); return; }
    Modal.close('recur-modal'); _renderRecurringList();
    Toast.show(`Recurring "${r.desc}" added!`,'success');
  }

  function _renderRecurringList() {
    const listEl=el('recur-list'); if(!listEl) return;
    const all=Store.getRecurring();
    if(!all.length){ listEl.innerHTML=`<div class="empty" style="padding:24px 0"><div class="empty-ico">↻</div><p>No recurring items yet.</p></div>`; return; }
    const freqLabel={weekly:'Weekly',monthly:'Monthly',yearly:'Yearly'};
    listEl.innerHTML=all.map(r=>{
      const m=catMeta(r.category), nextFmt=Store.fmtDateShort(r.nextDate)||r.nextDate;
      return `<div class="recur-item">
        <div style="width:36px;height:36px;border-radius:var(--r1);background:${r.type==='income'?'var(--grn-dim)':'var(--red-dim)'};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">${m.emoji}</div>
        <div class="recur-info">
          <div class="recur-desc">${h(r.desc)}</div>
          <div class="recur-freq">${freqLabel[r.freq]||r.freq} · Next: ${h(nextFmt)}</div>
        </div>
        <span class="recur-amt ${r.type==='income'?'inc':'exp'}">${r.type==='income'?'+':'−'}${h(Store.fmt(r.amount))}</span>
        <div style="display:flex;gap:4px">
          <button class="act-btn" data-recur-toggle="${h(r.id)}" title="${r.active?'Pause':'Resume'}" style="opacity:${r.active?1:.4}">${r.active?'⏸':'▶'}</button>
          <button class="act-btn del" data-recur-del="${h(r.id)}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  /* ══════════════════════════
     GOALS
  ══════════════════════════ */
  function openGoalModal() {
    setVal('goal-name',''); setVal('goal-target',''); setVal('goal-saved','0'); setVal('goal-deadline','');
    Modal.open('goal-modal');
  }

  function submitGoal() {
    const name=getVal('goal-name').trim(), target=parseFloat(getVal('goal-target'));
    const saved=parseFloat(getVal('goal-saved'))||0, deadline=getVal('goal-deadline');
    const emoji=getVal('goal-emoji')||'🎯';
    if(!name)       { Toast.show('Enter a goal name.','error');   return; }
    if(!(target>0)) { Toast.show('Enter a valid target.','error');return; }
    const g=Store.addGoal({name,emoji,target,saved,deadline});
    if(!g){ Toast.show('Could not save goal.','error'); return; }
    Modal.close('goal-modal'); _renderGoalsList();
    Toast.show(`Goal "${g.name}" added!`,'success');
  }

  function _renderGoalsList() {
    const listEl=el('goals-list'); if(!listEl) return;
    const all=Store.getGoals();
    if(!all.length){ listEl.innerHTML=`<div class="empty" style="padding:24px 0"><div class="empty-ico">🏆</div><p>No savings goals yet.</p></div>`; return; }
    listEl.innerHTML=all.map(g=>{
      const pct=g.target>0?Math.min(Math.round(g.saved/g.target*100),100):0;
      const c=pct>=100?'safe':pct>=50?'warn':'danger';
      const dl=g.deadline?`<span style="font-size:11px;color:var(--t2)">By ${Store.fmtDateShort(g.deadline)}</span>`:'';
      return `<div class="goal-card">
        <div class="goal-header">
          <div class="goal-title">${g.emoji} ${h(g.name)} ${dl}</div>
          <div style="display:flex;align-items:center;gap:var(--sp3)">
            <span class="goal-pct" style="color:${pct>=100?'var(--grn)':pct>=50?'var(--acc)':'var(--red)'}">${pct}%</span>
            <button class="act-btn del" data-goal-del="${h(g.id)}" aria-label="Delete goal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
        <div class="prog-track" style="margin-bottom:var(--sp3)"><div class="prog-fill ${c}" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="goal-amt">${h(Store.fmt(g.saved))} saved of ${h(Store.fmt(g.target))}</span>
          <button class="btn btn-ghost btn-sm" data-goal-update="${h(g.id)}" style="padding:4px 10px;font-size:11px">+ Add</button>
        </div>
      </div>`;
    }).join('');
  }

  /* ══════════════════════════
     EXPORT / IMPORT
  ══════════════════════════ */
  function exportCSV() {
    if(!Store.getAll().length){ Toast.show('No data to export.','error'); return; }
    download(Store.exportCSV(),`cashflow_${Store.todayISO()}.csv`,'text/csv;charset=utf-8;');
    Toast.show('CSV exported!','success');
  }

  function exportJSON() {
    download(Store.exportJSON(),`cashflow_backup_${Store.todayISO()}.json`,'application/json');
    Toast.show('Backup saved!','success');
  }

  function importJSON() {
    const inp=document.createElement('input');
    inp.type='file'; inp.accept='.json,application/json';
    inp.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return;
      const r=new FileReader();
      r.onload=ev=>{ Store.importJSON(String(ev.target.result))?(Toast.show('Imported!','success'),_refresh()):Toast.show('Invalid file.','error'); };
      r.onerror=()=>Toast.show('Could not read file.','error');
      r.readAsText(f);
    });
    inp.click();
  }

  function clearData() {
    Confirm('Delete ALL transactions permanently? This cannot be undone.',()=>{
      Store.clearAll(); Toast.show('All data cleared.','info'); _refresh();
    },'Clear All Data');
  }

  /* ══════════════════════════
     PWA
  ══════════════════════════ */
  function _registerSW() {
    if(!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./sw.js', {scope:'/CashFlow/'})
      .then(reg=>{
        if(reg.waiting) _showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound',()=>{
          const w=reg.installing;
          w?.addEventListener('statechange',()=>{
            if(w.state==='installed'&&navigator.serviceWorker.controller) _showUpdateBanner(w);
          });
        });
      }).catch(e=>console.warn('[SW]',e));
    navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(_updating) location.reload(); });
  }

  function _showUpdateBanner(worker) {
    const b=el('update-strip'); if(!b) return;
    b.classList.add('on');
    el('update-btn')?.addEventListener('click',()=>{ _updating=true; worker.postMessage({type:'SKIP_WAITING'}); });
  }

  function _setupInstall() {
    window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); _installEvt=e; if(!sessionStorage.getItem('pwa_dismissed')) el('install-banner')?.classList.add('on'); });
    window.addEventListener('appinstalled',()=>{ el('install-banner')?.classList.remove('on'); _installEvt=null; Toast.show('CashFlow installed! 🎉','success',4000); });
  }

  function triggerInstall() {
    if(!_installEvt) return;
    _installEvt.prompt();
    _installEvt.userChoice.then(()=>{ el('install-banner')?.classList.remove('on'); _installEvt=null; });
  }

  function dismissInstall() {
    el('install-banner')?.classList.remove('on');
    sessionStorage.setItem('pwa_dismissed','1');
  }

  function _setupOffline() {
    function upd(){ el('offline-bar')?.classList.toggle('on',!navigator.onLine); }
    window.addEventListener('online',upd); window.addEventListener('offline',upd); upd();
  }

  /* ══════════════════════════
     EVENT DELEGATION
  ══════════════════════════ */
  function _bindDelegation() {
    // Budget list
    el('b-list')?.addEventListener('click',e=>{
      const b=e.target.closest('.budget-del'); if(b) deleteBudget(b.dataset.cat);
    });
    // Recurring list
    el('recur-list')?.addEventListener('click',e=>{
      const t=e.target.closest('[data-recur-toggle]');
      const d=e.target.closest('[data-recur-del]');
      if(t){ const a=Store.toggleRecurring(t.dataset.recurToggle); _renderRecurringList(); Toast.show(a?'Resumed.':'Paused.','info'); }
      if(d){ Confirm('Remove this recurring entry?',()=>{ Store.deleteRecurring(d.dataset.recurDel); _renderRecurringList(); Toast.show('Removed.','info'); },'Remove Recurring'); }
    });
    // Goals list
    el('goals-list')?.addEventListener('click',e=>{
      const gd=e.target.closest('[data-goal-del]');
      const gu=e.target.closest('[data-goal-update]');
      if(gd){ Confirm('Delete this goal?',()=>{ Store.deleteGoal(gd.dataset.goalDel); _renderGoalsList(); Toast.show('Goal removed.','info'); },'Delete Goal'); }
      if(gu){
        const amt=parseFloat(window.prompt('Add how much to this goal?'));
        if(amt>0){
          const g=Store.getGoals().find(g=>g.id===gu.dataset.goalUpdate);
          if(g){ Store.updateGoalSaved(g.id, g.saved+amt); _renderGoalsList(); Toast.show(`${Store.fmt(amt)} added to goal!`,'success'); }
        }
      }
    });
  }

  /* ══════════════════════════
     KEYBOARD SHORTCUTS
  ══════════════════════════ */
  function _bindKeys() {
    document.addEventListener('keydown', e=>{
      if(e.key==='Escape'){
        ['tx-modal','budget-modal','recur-modal','goal-modal'].forEach(id=>Modal.close(id));
        el('confirm-overlay')?.classList.remove('open');
        document.body.style.overflow='';
      }
      if((e.ctrlKey||e.metaKey)&&e.key==='k'){ e.preventDefault(); openAdd(); }
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey){
        const ae=document.activeElement;
        if(ae&&['INPUT','TEXTAREA','SELECT'].includes(ae.tagName)) return;
        const map={'1':'dashboard','2':'history','3':'budget','4':'reports','5':'settings'};
        if(map[e.key]) goTo(map[e.key]);
      }
    });
  }

  /* ══════════════════════════
     URL PARAMS
  ══════════════════════════ */
  function _handleParams() {
    const p=new URLSearchParams(location.search), a=p.get('action');
    if(a==='add-income')  requestAnimationFrame(()=>openAdd('income'));
    if(a==='add-expense') requestAnimationFrame(()=>openAdd('expense'));
    if(a) history.replaceState({},document.title, location.pathname);
  }

  /* ══════════════════════════
     INIT
  ══════════════════════════ */
  function init() {
    // Apply due recurring entries silently
    const applied=Store.applyDueRecurring();
    if(applied) console.log(`[CF] Applied ${applied} recurring entries`);

    // Dates
    const today=Store.todayISO();
    document.querySelectorAll('input[type=date]').forEach(e=>{ if(!e.value) e.value=today; });

    // Category selects
    setHTML('q-cat', catOpts('income'));
    setHTML('m-cat', catOpts('income'));

    // Avatar
    const s=Store.getSettings();
    _updateAvatar(s.userName);
    setText('sidebar-uname', s.userName);

    // History search
    const srch=el('hist-search');
    if(srch){ let t; srch.addEventListener('input',()=>{ clearTimeout(t); t=setTimeout(_renderHistory,220); }); }

    // Mobile search sync
    const ms=el('hist-search-m');
    if(ms){ let t; ms.addEventListener('input',()=>{
      if(srch) srch.value=ms.value;
      clearTimeout(t); t=setTimeout(_renderHistory,220);
    }); }

    // Table delegation
    bindTable('d-tx-body');
    bindTable('h-tx-body');
    _bindDelegation();
    _bindKeys();

    // Storage quota
    window.addEventListener('cf:quota',()=>Toast.show('Storage full! Export data.','error',6000));

    // PWA
    _registerSW(); _setupInstall(); _setupOffline();
    _handleParams();

    // Mobile search wrap toggle
    function toggleMobileSrch(){ const w=el('hist-search-m-wrap'); if(w) w.style.display=window.innerWidth<=768?'block':'none'; }
    window.addEventListener('resize', toggleMobileSrch);
    toggleMobileSrch();

    goTo('dashboard');
  }

  // Expose helpers used inline in HTML
  function currentMonthLabel() { return new Date().toLocaleString('default',{month:'long',year:'numeric'}); }

  return Object.freeze({
    init, goTo, toggleSidebar,
    // Dashboard
    setDashFilt, setQuickType, quickAdd,
    // History
    setHistFilt,
    // Budget
    openBudgetModal, submitBudget, deleteBudget,
    // Transactions
    openAdd, editTx, deleteTx, setModalType, submitTx,
    // Recurring
    openRecurModal, setRecType, submitRecur,
    // Goals
    openGoalModal, submitGoal,
    // Reports
    rptPrevMonth, rptNextMonth,
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
