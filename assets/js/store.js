/**
 * CashFlow — Data Store (store.js)
 * Central state management with localStorage persistence
 */

const Store = (() => {
  const KEYS = {
    transactions: 'cf_transactions_v2',
    budgets:      'cf_budgets_v2',
    settings:     'cf_settings_v2',
  };

  /* ── Default settings ── */
  const DEFAULT_SETTINGS = {
    currency:      '৳',
    currencyCode:  'BDT',
    userName:      'Faruk Islam',
    dateFormat:    'dd MMM yyyy',
  };

  /* ── Read / Write ── */
  function read(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  /* ── Transactions ── */
  let _transactions = read(KEYS.transactions, null);

  if (_transactions === null) {
    _transactions = generateSeedData();
    write(KEYS.transactions, _transactions);
  }

  function generateSeedData() {
    const now = new Date();
    const y   = now.getFullYear();
    const m   = String(now.getMonth() + 1).padStart(2, '0');
    const pm  = String(now.getMonth()).padStart(2, '0') || '12';
    const py  = now.getMonth() === 0 ? y - 1 : y;
    const d   = (n) => `${y}-${m}-${String(n).padStart(2,'0')}`;
    const dp  = (n) => `${py}-${pm}-${String(n).padStart(2,'0')}`;

    return [
      { id: uid(), type:'income',  desc:'Monthly Salary',       amount:55000, category:'salary',        date:d(1),  note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'House Rent',            amount:14000, category:'rent',           date:d(2),  note:'Dhanmondi flat', tags:[] },
      { id: uid(), type:'expense', desc:'Grocery Shopping',      amount:3800,  category:'food',           date:d(4),  note:'Shajahan Market',tags:[] },
      { id: uid(), type:'income',  desc:'Freelance Web Project',  amount:18000, category:'freelance',      date:d(5),  note:'React dashboard',tags:[] },
      { id: uid(), type:'expense', desc:'Electricity & Gas Bill', amount:1650,  category:'utilities',      date:d(6),  note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Uber & Pathao',          amount:1200,  category:'transport',      date:d(8),  note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Daraz Shopping',         amount:3200,  category:'shopping',       date:d(10), note:'Phone case+cable',tags:[] },
      { id: uid(), type:'expense', desc:'Doctor Consultation',    amount:1500,  category:'health',         date:d(12), note:'Ibn Sina Hospital',tags:[] },
      { id: uid(), type:'expense', desc:'Restaurant — Family',    amount:2200,  category:'food',           date:d(13), note:'Kacchi Bhai',    tags:[] },
      { id: uid(), type:'income',  desc:'Performance Bonus',      amount:10000, category:'salary',         date:d(14), note:'Q4 bonus',       tags:[] },
      { id: uid(), type:'expense', desc:'Netflix + Spotify',      amount:650,   category:'entertainment',  date:d(15), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Internet Bill',          amount:700,   category:'utilities',      date:d(16), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Gym Membership',         amount:1800,  category:'health',         date:d(17), note:'',              tags:[] },
      { id: uid(), type:'income',  desc:'YouTube AdSense',        amount:6500,  category:'freelance',      date:d(19), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Course — Udemy',         amount:890,   category:'education',      date:d(21), note:'React Advanced', tags:[] },
      // Previous month data
      { id: uid(), type:'income',  desc:'Monthly Salary',         amount:55000, category:'salary',         date:dp(1), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'House Rent',             amount:14000, category:'rent',           date:dp(2), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Groceries',              amount:4100,  category:'food',           date:dp(5), note:'',              tags:[] },
      { id: uid(), type:'income',  desc:'Freelance Project',       amount:12000, category:'freelance',      date:dp(8), note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Shopping',               amount:2800,  category:'shopping',       date:dp(10),note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Utilities',              amount:2100,  category:'utilities',      date:dp(12),note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Transport',              amount:1400,  category:'transport',      date:dp(15),note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Health',                 amount:2500,  category:'health',         date:dp(18),note:'',              tags:[] },
      { id: uid(), type:'expense', desc:'Entertainment',          amount:800,   category:'entertainment',  date:dp(22),note:'',              tags:[] },
    ];
  }

  /* ── Budgets ── */
  let _budgets = read(KEYS.budgets, {
    food: 6000, rent: 15000, transport: 2000,
    shopping: 4000, utilities: 2500, health: 3000,
    entertainment: 1500, education: 2000,
  });

  /* ── Settings ── */
  let _settings = { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) };

  /* ── Helpers ── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function saveTransactions()  { write(KEYS.transactions, _transactions); }
  function saveBudgets()       { write(KEYS.budgets, _budgets); }
  function saveSettings()      { write(KEYS.settings, _settings); }

  function isThisMonth(tx) {
    const now = new Date();
    const d   = new Date(tx.date + 'T00:00:00');
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  /* ── Public API ── */
  return {
    // Transactions
    getAll()  { return [..._transactions]; },
    getById(id) { return _transactions.find(t => t.id === id) || null; },

    add(tx) {
      const newTx = { id: uid(), tags: [], note: '', ...tx };
      _transactions.unshift(newTx);
      saveTransactions();
      return newTx;
    },

    update(id, data) {
      const idx = _transactions.findIndex(t => t.id === id);
      if (idx === -1) return false;
      _transactions[idx] = { ..._transactions[idx], ...data };
      saveTransactions();
      return true;
    },

    delete(id) {
      const len = _transactions.length;
      _transactions = _transactions.filter(t => t.id !== id);
      if (_transactions.length < len) { saveTransactions(); return true; }
      return false;
    },

    deleteAll() { _transactions = []; saveTransactions(); },

    // Computed
    getMonthly(year, month) {
      return _transactions.filter(t => {
        const d = new Date(t.date + 'T00:00:00');
        return d.getFullYear() === year && d.getMonth() === month;
      });
    },

    getThisMonth() {
      const now = new Date();
      return this.getMonthly(now.getFullYear(), now.getMonth());
    },

    sumByType(list, type) {
      return list.filter(t => t.type === type).reduce((s,t) => s + Number(t.amount), 0);
    },

    spendByCategory(list) {
      const map = {};
      list.filter(t => t.type === 'expense').forEach(t => {
        map[t.category] = (map[t.category] || 0) + Number(t.amount);
      });
      return map;
    },

    last7DaysStats() {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d  = new Date();
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split('T')[0];
        const txs = _transactions.filter(t => t.date === ds);
        days.push({
          date:  ds,
          label: d.toLocaleDateString('en', { weekday: 'short' }),
          inc:   txs.filter(t => t.type === 'income').reduce((s,t) => s + +t.amount, 0),
          exp:   txs.filter(t => t.type === 'expense').reduce((s,t) => s + +t.amount, 0),
        });
      }
      return days;
    },

    last6MonthsStats() {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const list = this.getMonthly(d.getFullYear(), d.getMonth());
        months.push({
          label: d.toLocaleString('default', { month: 'short' }),
          year:  d.getFullYear(),
          month: d.getMonth(),
          inc:   this.sumByType(list, 'income'),
          exp:   this.sumByType(list, 'expense'),
        });
      }
      return months;
    },

    totalBalance() {
      const all = _transactions;
      return this.sumByType(all, 'income') - this.sumByType(all, 'expense');
    },

    // Budgets
    getBudgets()       { return { ..._budgets }; },
    setBudget(cat, limit) { _budgets[cat] = Number(limit); saveBudgets(); },
    deleteBudget(cat)     { delete _budgets[cat]; saveBudgets(); },

    // Settings
    getSettings()      { return { ..._settings }; },
    updateSettings(s)  { _settings = { ..._settings, ...s }; saveSettings(); },

    // Format helpers
    fmt(n) {
      const s = _settings;
      return s.currency + Number(n).toLocaleString('en', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    },

    fmtDate(dateStr) {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-BD', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    uid,
    isThisMonth,
  };
})();

// Expose globally
window.Store = Store;
