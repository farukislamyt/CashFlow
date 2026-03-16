/**
 * CashFlow — App Controller (app.js)
 * Handles all page rendering, user interactions, and navigation.
 */

const App = (() => {
  /* ── State ── */
  let currentPage     = 'dashboard';
  let dashFilter      = 'all';
  let txFilter        = 'all';
  let txSearch        = '';
  let editingTxId     = null;
  let modalType       = 'income';
  let quickType       = 'income';

  /* ══════════════════════════════════════
     NAVIGATION
  ══════════════════════════════════════ */
  function showPage(name, btn) {
    currentPage = name;
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    if (btn)  btn.classList.add('active');

    // Render page-specific content
    switch (name) {
      case 'dashboard':    renderDashboard();    break;
      case 'transactions': renderTransactions(); break;
      case 'budget':       renderBudget();       break;
      case 'analytics':    renderAnalytics();    break;
    }

    // Close sidebar on mobile
    if (window.innerWidth < 768) closeSidebar();
  }

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-backdrop').classList.toggle('open');
  }

  function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-backdrop').classList.remove('open');
  }

  /* ══════════════════════════════════════
     DASHBOARD
  ══════════════════════════════════════ */
  function renderDashboard() {
    const monthly = Store.getThisMonth();
    const inc     = Store.sumByType(monthly, 'income');
    const exp     = Store.sumByType(monthly, 'expense');
    const bal     = Store.totalBalance();

    // Stats
    setText('d-balance', Store.fmt(bal));
    setText('d-income',  Store.fmt(inc));
    setText('d-expense', Store.fmt(exp));
    setText('d-savings', inc > 0 ? Math.round(((inc - exp) / inc) * 100) + '%' : '0%');

    const balEl = document.getElementById('d-balance');
    if (balEl) {
      balEl.className = 'stat-value ' + (bal < 0 ? 'negative' : 'accent');
    }

    // Month label
    setText('d-month-label', monthName());

    // Transaction table
    renderTxTable('d-tx-tbody', 'd-empty', dashFilter, 10, '');

    // Mini chart
    const chartData = Store.last7DaysStats();
    renderBarChart('d-mini-chart', chartData, 100);
  }

  function setDashFilter(f, btn) {
    dashFilter = f;
    document.querySelectorAll('#page-dashboard .filter-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTxTable('d-tx-tbody', 'd-empty', dashFilter, 10, '');
  }

  /* ══════════════════════════════════════
     TRANSACTIONS PAGE
  ══════════════════════════════════════ */
  function renderTransactions() {
    txSearch = document.getElementById('tx-search')?.value || '';
    renderTxTable('tx-tbody', 'tx-empty', txFilter, null, txSearch);
    renderTxSummary();
  }

  function setTxFilter(f, btn) {
    txFilter = f;
    document.querySelectorAll('#page-transactions .filter-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderTransactions();
  }

  function renderTxSummary() {
    const all = Store.getAll();
    const inc = Store.sumByType(all, 'income');
    const exp = Store.sumByType(all, 'expense');
    setText('tx-total-income',  Store.fmt(inc));
    setText('tx-total-expense', Store.fmt(exp));
    setText('tx-total-balance', Store.fmt(inc - exp));
    const cnt = all.length;
    setText('tx-count', cnt + ' transaction' + (cnt !== 1 ? 's' : ''));
  }

  /* ══════════════════════════════════════
     SHARED TABLE RENDERER
  ══════════════════════════════════════ */
  function renderTxTable(tbodyId, emptyId, filter, limit, search) {
    let list = Store.getAll().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (filter !== 'all') list = list.filter(t => t.type === filter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.note && t.note.toLowerCase().includes(q))
      );
    }
    if (limit !== null) list = list.slice(0, limit);

    const tbody = document.getElementById(tbodyId);
    const empty = document.getElementById(emptyId);
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    tbody.innerHTML = list.map(t => txRowHTML(t)).join('');
  }

  /* ══════════════════════════════════════
     BUDGET PAGE
  ══════════════════════════════════════ */
  function renderBudget() {
    const monthly  = Store.getThisMonth();
    const spent    = Store.spendByCategory(monthly);
    const budgets  = Store.getBudgets();

    const totalBudget  = Object.values(budgets).reduce((s, v) => s + v, 0);
    const totalSpent   = Object.keys(budgets).reduce((s, k) => s + (spent[k] || 0), 0);
    const remaining    = totalBudget - totalSpent;

    setText('b-total',     Store.fmt(totalBudget));
    setText('b-spent',     Store.fmt(totalSpent));
    setText('b-remaining', Store.fmt(Math.max(remaining, 0)));

    const list = document.getElementById('b-list');
    if (!list) return;

    const cats = Object.keys(budgets);
    if (!cats.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px 0">No budgets set. Click "+ Set Budget" to add one.</p>';
      return;
    }

    list.innerHTML = cats.map(cat => {
      const limit    = budgets[cat];
      const spentAmt = spent[cat] || 0;
      const pct      = Math.min(Math.round((spentAmt / limit) * 100), 100);
      const cls      = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'safe';
      const m        = getCatMeta(cat);

      return `
        <div class="budget-row-item">
          <div class="budget-row-top">
            <span class="budget-cat-name">${m.emoji} ${m.label}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="budget-nums">${Store.fmt(spentAmt)} / ${Store.fmt(limit)}</span>
              <span class="budget-pct ${cls}">${pct}%</span>
              <button class="budget-delete" onclick="App.deleteBudgetCat('${cat}')" title="Remove budget">✕</button>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${cls}" style="width:${pct}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  function deleteBudgetCat(cat) {
    Store.deleteBudget(cat);
    renderBudget();
    Toast.show(`Budget for ${getCatMeta(cat).label} removed.`, 'info');
  }

  /* ══════════════════════════════════════
     ANALYTICS PAGE
  ══════════════════════════════════════ */
  function renderAnalytics() {
    const monthly  = Store.getThisMonth();
    const inc      = Store.sumByType(monthly, 'income');
    const exp      = Store.sumByType(monthly, 'expense');
    const days     = new Date().getDate();
    const catSpend = Store.spendByCategory(monthly);

    // KPIs
    setText('a-avg-daily',   Store.fmt(exp / days));
    setText('a-savings-rate', inc > 0 ? Math.round(((inc - exp) / inc) * 100) + '%' : '0%');
    setText('a-net-worth',   Store.fmt(Store.totalBalance()));

    // Top category
    const sorted = Object.entries(catSpend).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      const [topCat, topAmt] = sorted[0];
      const m = getCatMeta(topCat);
      setText('a-top-cat',    m.emoji + ' ' + m.label);
      setText('a-top-cat-amt', Store.fmt(topAmt));
    }

    // 6-month bar chart
    const mData = Store.last6MonthsStats();
    renderBarChart('a-monthly-chart', mData, 150);

    // Donut chart
    if (sorted.length) {
      const COLORS = ['#f05674','#e8c547','#34d89a','#6b8aff','#ffab40','#ce93d8','#64b5f6','#f06292'];
      const donutData = sorted.slice(0, 7).map((([cat, val], i) => ({
        label: getCatMeta(cat).label,
        value: val,
        color: COLORS[i % COLORS.length],
      })));

      const donutContainer = document.getElementById('a-donut');
      if (donutContainer) {
        donutContainer.innerHTML = `
          <div class="donut-wrap">
            ${renderDonut(donutData, 'EXPENSES')}
            <div class="donut-legend">
              ${donutData.map(d => `
                <div class="donut-legend-item">
                  <span class="donut-legend-dot" style="background:${d.color}"></span>
                  <span class="donut-legend-name">${d.label}</span>
                  <span class="donut-legend-val">${Store.fmt(d.value)}</span>
                </div>`).join('')}
            </div>
          </div>`;
      }
    } else {
      const donutContainer = document.getElementById('a-donut');
      if (donutContainer) donutContainer.innerHTML = '<p style="color:var(--text-muted);font-size:13px;padding:24px 0;text-align:center">No expense data this month.</p>';
    }
  }

  /* ══════════════════════════════════════
     ADD / EDIT TRANSACTION MODAL
  ══════════════════════════════════════ */
  function openAddModal(type = 'income') {
    editingTxId = null;
    modalType   = type;
    document.getElementById('modal-title').textContent = 'Add Transaction';
    clearModalForm();
    syncModalTypeButtons();
    document.getElementById('m-date').value = todayISO();
    Modal.open('tx-modal');
  }

  function editTx(id) {
    const tx = Store.getById(id);
    if (!tx) return;
    editingTxId = id;
    modalType   = tx.type;

    document.getElementById('modal-title').textContent = 'Edit Transaction';
    document.getElementById('m-desc').value     = tx.desc;
    document.getElementById('m-amount').value   = tx.amount;
    document.getElementById('m-category').value = tx.category;
    document.getElementById('m-date').value     = tx.date;
    document.getElementById('m-note').value     = tx.note || '';

    syncModalTypeButtons();
    Modal.open('tx-modal');
  }

  function submitTxModal() {
    const desc   = document.getElementById('m-desc').value.trim();
    const amount = parseFloat(document.getElementById('m-amount').value);
    const cat    = document.getElementById('m-category').value;
    const date   = document.getElementById('m-date').value;
    const note   = document.getElementById('m-note').value.trim();

    if (!desc)          { Toast.show('Please enter a description.', 'error'); return; }
    if (!amount || amount <= 0) { Toast.show('Enter a valid amount.', 'error'); return; }
    if (!date)          { Toast.show('Please select a date.', 'error'); return; }

    const data = { type: modalType, desc, amount, category: cat, date, note };

    if (editingTxId) {
      Store.update(editingTxId, data);
      Toast.show('Transaction updated!', 'success');
    } else {
      Store.add(data);
      Toast.show(`${modalType === 'income' ? '📈 Income' : '📉 Expense'} added!`, 'success');
    }

    Modal.close('tx-modal');
    refreshCurrentPage();
  }

  function deleteTx(id) {
    if (!confirm('Delete this transaction?')) return;
    Store.delete(id);
    Toast.show('Transaction deleted.', 'info');
    refreshCurrentPage();
  }

  function setModalType(t) {
    modalType = t;
    syncModalTypeButtons();
    // Update category options based on type
    populateCategorySelect('m-category', t);
  }

  function syncModalTypeButtons() {
    document.getElementById('m-type-income').classList.toggle('active',  modalType === 'income');
    document.getElementById('m-type-expense').classList.toggle('active', modalType === 'expense');
  }

  function clearModalForm() {
    ['m-desc','m-amount','m-note'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    populateCategorySelect('m-category', modalType);
  }

  /* ══════════════════════════════════════
     QUICK ADD (sidebar form on dashboard)
  ══════════════════════════════════════ */
  function setQuickType(t) {
    quickType = t;
    document.getElementById('q-type-income').classList.toggle('active',  t === 'income');
    document.getElementById('q-type-expense').classList.toggle('active', t === 'expense');
    populateCategorySelect('q-category', t);
  }

  function quickAdd() {
    const desc   = document.getElementById('q-desc').value.trim();
    const amount = parseFloat(document.getElementById('q-amount').value);
    const cat    = document.getElementById('q-category').value;
    const date   = document.getElementById('q-date').value;

    if (!desc || !amount || amount <= 0 || !date) {
      Toast.show('Fill in all fields correctly.', 'error');
      return;
    }

    Store.add({ type: quickType, desc, amount, category: cat, date, note: '' });
    document.getElementById('q-desc').value   = '';
    document.getElementById('q-amount').value = '';
    document.getElementById('q-date').value   = todayISO();

    Toast.show('Transaction added!', 'success');
    renderDashboard();
  }

  /* ══════════════════════════════════════
     BUDGET MODAL
  ══════════════════════════════════════ */
  function openBudgetModal() { Modal.open('budget-modal'); }

  function submitBudget() {
    const cat   = document.getElementById('b-cat').value;
    const limit = parseFloat(document.getElementById('b-limit').value);

    if (!limit || limit <= 0) { Toast.show('Enter a valid limit.', 'error'); return; }

    Store.setBudget(cat, limit);
    Modal.close('budget-modal');
    renderBudget();
    Toast.show(`Budget for ${getCatMeta(cat).label} saved!`, 'success');
    document.getElementById('b-limit').value = '';
  }

  /* ══════════════════════════════════════
     EXPORT
  ══════════════════════════════════════ */
  function exportCSV() {
    const all = Store.getAll();
    if (!all.length) { Toast.show('No data to export.', 'error'); return; }

    const header = 'Date,Type,Description,Category,Amount (BDT),Note';
    const rows   = all
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map(t => `${t.date},${t.type},"${t.desc.replace(/"/g, '""')}",${t.category},${t.amount},"${(t.note||'').replace(/"/g, '""')}"`)
      .join('\n');

    const blob = new Blob([header + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `cashflow_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    Toast.show('CSV exported successfully!', 'success');
  }

  /* ══════════════════════════════════════
     HELPERS
  ══════════════════════════════════════ */
  function refreshCurrentPage() {
    switch (currentPage) {
      case 'dashboard':    renderDashboard();    break;
      case 'transactions': renderTransactions(); break;
      case 'budget':       renderBudget();       break;
      case 'analytics':    renderAnalytics();    break;
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function populateCategorySelect(selectId, type) {
    const el = document.getElementById(selectId);
    if (!el) return;

    const incomeCats  = ['salary','freelance','investment','other'];
    const expenseCats = ['food','transport','shopping','health','rent','entertainment','utilities','education','other'];
    const cats        = type === 'income' ? incomeCats : expenseCats;

    el.innerHTML = cats.map(cat => {
      const m = getCatMeta(cat);
      return `<option value="${cat}">${m.emoji} ${m.label}</option>`;
    }).join('');
  }

  /* ══════════════════════════════════════
     INIT
  ══════════════════════════════════════ */
  function init() {
    // Set today's date inputs
    const today = todayISO();
    ['q-date', 'm-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = today;
    });

    // Populate initial selects
    populateCategorySelect('q-category', 'income');
    populateCategorySelect('m-category', 'income');

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        Modal.close('tx-modal');
        Modal.close('budget-modal');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openAddModal();
      }
    });

    // Search debounce
    const searchEl = document.getElementById('tx-search');
    if (searchEl) {
      let debounce;
      searchEl.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => renderTransactions(), 200);
      });
    }

    // Initial render
    renderDashboard();
  }

  // Public API
  return {
    init,
    showPage,
    toggleSidebar,
    closeSidebar,
    // Dashboard
    renderDashboard,
    setDashFilter,
    quickAdd,
    setQuickType,
    // Transactions
    renderTransactions,
    setTxFilter,
    // Budget
    renderBudget,
    deleteBudgetCat,
    openBudgetModal,
    submitBudget,
    // Transaction CRUD
    openAddModal,
    editTx,
    deleteTx,
    setModalType,
    submitTxModal,
    // Export
    exportCSV,
  };
})();

// Init on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
window.App = App;
