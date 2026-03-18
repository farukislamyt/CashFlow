/* CashFlow — PDF Report Generator v4.0
   Generates a printable HTML report and triggers browser print-to-PDF.
   No external libraries required.
*/
'use strict';

const PDF = (() => {

  function generate(monthOffset = 0) {
    const now      = new Date();
    const d        = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const monthly  = Store.getByMonth(d.getFullYear(), d.getMonth());
    const allTx    = Store.getAll();
    const settings = Store.getSettings();
    const inc      = Store.sumType(monthly, 'income');
    const exp      = Store.sumType(monthly, 'expense');
    const bal      = Store.totalBalance();
    const catSpend = Store.spendByCategory(monthly);
    const catInc   = Store.incomeByCategory(monthly);
    const goals    = Store.getGoals();
    const recur    = Store.getRecurring().filter(r => r.active);
    const budgets  = Store.getBudgets();
    const period   = d.toLocaleString('default', { month:'long', year:'numeric' });
    const genDate  = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
    const userName = settings.userName || 'My Account';
    const currency = settings.currency || '৳';

    const sortedExp = Object.entries(catSpend).sort((a,b) => b[1]-a[1]);
    const sortedInc = Object.entries(catInc).sort((a,b) => b[1]-a[1]);
    const txSample  = [...monthly].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 30);

    // Helpers
    const fmt  = n => currency + Number(n).toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
    const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const pct  = (v,t) => t > 0 ? Math.round(v/t*100)+'%' : '0%';
    const rate = inc > 0 ? Math.max(0, Math.round((inc-exp)/inc*100)) : 0;
    const CATS = window.CATS || {};
    const catLabel = cat => CATS[cat]?.label || cat;
    const catEmoji = cat => CATS[cat]?.emoji || '📦';
    const fmtDate  = s => { try { return new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return s||''; }};

    /* ── Bar chart as inline SVG ── */
    function inlineBars(data, maxVal, colorFn, barW=16) {
      const w = 140, h = 80, pad = 4;
      const max = maxVal || Math.max(...data.map(d=>d.v),1);
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        data.slice(0,6).map((d,i) => {
          const x = pad + i * (barW + 3);
          const bh = Math.max(((d.v||0)/max)*(h-16), d.v>0?2:0);
          const y  = h - 16 - bh;
          return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="2" fill="${colorFn(i)}" fill-opacity="0.85"/>
            <text x="${x+barW/2}" y="${h-4}" text-anchor="middle" font-size="8" fill="#888">${esc(d.label||'')}</text>`;
        }).join('') + '</svg>';
    }

    /* ── Progress bar ── */
    function progBar(value, max, color='#2dd98f') {
      const p = max>0 ? Math.min(value/max*100,100) : 0;
      const c = p>=90?'#f05672':p>=70?'#f0c14b':color;
      return `<div style="background:#2a2f3f;border-radius:4px;height:8px;overflow:hidden;margin-top:4px">
        <div style="background:${c};width:${p}%;height:100%;border-radius:4px"></div></div>`;
    }

    /* ── HTML ── */
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>CashFlow Report — ${esc(period)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:12px; color:#1a1a2e; background:#fff; }
  .page { max-width:794px; margin:0 auto; padding:32px 40px; }
  h1 { font-size:22px; font-weight:700; color:#0d1117; margin-bottom:2px; }
  h2 { font-size:14px; font-weight:700; color:#0d1117; margin:20px 0 10px; padding-bottom:5px; border-bottom:2px solid #f0c14b; }
  h3 { font-size:12px; font-weight:600; color:#333; margin-bottom:6px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #f0c14b; }
  .logo { display:flex; align-items:center; gap:10px; }
  .logo-icon { width:40px; height:40px; background:linear-gradient(135deg,#f0c14b,#e8952a); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
  .logo-text { font-size:20px; font-weight:700; color:#0d1117; }
  .header-meta { text-align:right; color:#666; font-size:11px; line-height:1.7; }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }
  .kpi { background:#f8f9fc; border:1px solid #e8eaf0; border-radius:10px; padding:14px; border-top:3px solid #ccc; }
  .kpi.green { border-top-color:#2dd98f; } .kpi.red { border-top-color:#f05672; }
  .kpi.gold  { border-top-color:#f0c14b; } .kpi.blue { border-top-color:#4e8ef7; }
  .kpi-label { font-size:10px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888; margin-bottom:5px; }
  .kpi-val   { font-size:18px; font-weight:700; color:#0d1117; font-family:monospace; }
  .kpi-val.pos { color:#2dd98f; } .kpi-val.neg { color:#f05672; } .kpi-val.gold { color:#d4a017; }
  .kpi-meta  { font-size:10px; color:#aaa; margin-top:3px; }
  .two-col   { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  table { width:100%; border-collapse:collapse; margin-top:4px; }
  th { background:#f0f1f5; font-size:10px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:#666; padding:7px 10px; text-align:left; }
  td { padding:7px 10px; font-size:11.5px; border-bottom:1px solid #f0f1f5; color:#333; }
  tr:last-child td { border-bottom:none; }
  tr:hover td { background:#fafafa; }
  .amount { font-family:monospace; font-weight:700; text-align:right; white-space:nowrap; }
  .inc-amt { color:#2dd98f; } .exp-amt { color:#f05672; }
  .pill { display:inline-block; padding:2px 7px; border-radius:20px; font-size:10px; font-weight:700; text-transform:uppercase; }
  .pill-income  { background:#d1fae5; color:#065f46; }
  .pill-expense { background:#fee2e2; color:#991b1b; }
  .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
  .bar-row .bar-label { width:120px; font-size:11px; color:#444; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .bar-row .bar-track { flex:1; background:#e8eaf0; border-radius:4px; height:10px; overflow:hidden; }
  .bar-row .bar-fill  { height:100%; border-radius:4px; transition:width .3s; }
  .bar-row .bar-amt   { font-family:monospace; font-size:11px; width:80px; text-align:right; color:#555; flex-shrink:0; }
  .goal-row { display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f0f1f5; }
  .goal-row:last-child { border-bottom:none; }
  .summary-box { background:#f8f9fc; border:1px solid #e8eaf0; border-radius:10px; padding:16px; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e8eaf0; text-align:center; font-size:10px; color:#aaa; }
  .badge { display:inline-flex; align-items:center; gap:4px; background:#fff3cd; border:1px solid #f0c14b; border-radius:6px; padding:3px 8px; font-size:10.5px; color:#856404; font-weight:600; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .no-print { display:none!important; }
    .page { padding:20px 28px; }
    @page { margin:0.5cm; size:A4; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Print button (hidden on print) -->
  <div class="no-print" style="text-align:right;margin-bottom:16px">
    <button onclick="window.print()" style="background:#f0c14b;color:#07090f;font-size:13px;font-weight:700;padding:9px 20px;border:none;border-radius:8px;cursor:pointer">🖨 Print / Save as PDF</button>
    <button onclick="window.close()" style="background:#e8eaf0;color:#333;font-size:13px;font-weight:700;padding:9px 18px;border:none;border-radius:8px;cursor:pointer;margin-left:8px">✕ Close</button>
  </div>

  <!-- Header -->
  <div class="header">
    <div class="logo">
      <div class="logo-icon">💸</div>
      <div><div class="logo-text">CashFlow</div><div style="font-size:11px;color:#888;margin-top:1px">Personal Finance Report</div></div>
    </div>
    <div class="header-meta">
      <div><strong>${esc(t('pdf_period'))}:</strong> ${esc(period)}</div>
      <div><strong>${esc(t('pdf_generated'))}:</strong> ${esc(genDate)}</div>
      <div><strong>Account:</strong> ${esc(userName)}</div>
    </div>
  </div>

  <!-- KPI Summary -->
  <h2>📊 ${esc(t('pdf_summary'))}</h2>
  <div class="kpi-row">
    <div class="kpi gold"><div class="kpi-label">Net Balance</div><div class="kpi-val gold">${esc(fmt(bal))}</div><div class="kpi-meta">All-time</div></div>
    <div class="kpi green"><div class="kpi-label">Income</div><div class="kpi-val pos">${esc(fmt(inc))}</div><div class="kpi-meta">${esc(period)}</div></div>
    <div class="kpi red"><div class="kpi-label">Expenses</div><div class="kpi-val neg">${esc(fmt(exp))}</div><div class="kpi-meta">${esc(period)}</div></div>
    <div class="kpi blue"><div class="kpi-label">Savings Rate</div><div class="kpi-val">${rate}%</div><div class="kpi-meta">Inc vs Exp</div></div>
  </div>
  <div class="two-col" style="margin-bottom:20px">
    <div class="summary-box">
      <h3>💰 Balance Breakdown</h3>
      <table><tbody>
        <tr><td>Monthly Net</td><td class="amount ${inc-exp>=0?'inc-amt':'exp-amt'}">${esc(fmt(inc-exp))}</td></tr>
        <tr><td>Monthly Income</td><td class="amount inc-amt">${esc(fmt(inc))}</td></tr>
        <tr><td>Monthly Expense</td><td class="amount exp-amt">${esc(fmt(exp))}</td></tr>
        <tr><td>Avg Daily Spend</td><td class="amount">${esc(fmt(Store.avgDailyExpense()))}</td></tr>
        <tr><td>Total Transactions</td><td class="amount">${monthly.length}</td></tr>
      </tbody></table>
    </div>
    ${budgets && Object.keys(budgets).length > 0 ? `<div class="summary-box">
      <h3>🎯 Budget Status</h3>
      ${Object.entries(budgets).slice(0,5).map(([cat,lim]) => {
        const sp = catSpend[cat]||0, p2 = lim>0?Math.min(sp/lim*100,100):0;
        const col = p2>=90?'#f05672':p2>=70?'#f0c14b':'#2dd98f';
        return `<div class="bar-row">
          <span class="bar-label">${catEmoji(cat)} ${esc(catLabel(cat))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${p2}%;background:${col}"></div></div>
          <span class="bar-amt">${p2.toFixed(0)}%</span>
        </div>`;
      }).join('')}
    </div>` : ''}
  </div>

  <!-- Expense Breakdown -->
  ${sortedExp.length > 0 ? `<h2>📉 ${esc(t('pdf_category_breakdown'))}</h2>
  <div class="two-col" style="margin-bottom:20px">
    <div>
      ${sortedExp.map(([cat,val]) => {
        const p2 = exp>0?val/exp*100:0;
        return `<div class="bar-row">
          <span class="bar-label">${catEmoji(cat)} ${esc(catLabel(cat))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(p2,100)}%;background:#f05672;opacity:0.8"></div></div>
          <span class="bar-amt exp-amt">${esc(fmt(val))}</span>
        </div>`;
      }).join('')}
    </div>
    <div>
      <h3>Income Sources</h3>
      ${sortedInc.length ? sortedInc.map(([cat,val]) => {
        const p2 = inc>0?val/inc*100:0;
        return `<div class="bar-row">
          <span class="bar-label">${catEmoji(cat)} ${esc(catLabel(cat))}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(p2,100)}%;background:#2dd98f;opacity:0.8"></div></div>
          <span class="bar-amt inc-amt">${esc(fmt(val))}</span>
        </div>`;
      }).join('') : '<p style="color:#aaa;font-size:12px">No income data.</p>'}
    </div>
  </div>` : ''}

  <!-- Transactions Table -->
  <h2>📋 ${esc(t('pdf_transactions'))} <span style="font-size:11px;font-weight:400;color:#888">(${txSample.length} shown${monthly.length>30?' of '+monthly.length:''})</span></h2>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${txSample.map(tx => `<tr>
        <td style="color:#888;font-family:monospace">${esc(fmtDate(tx.date))}</td>
        <td><strong>${esc(tx.desc)}</strong>${tx.note?`<br><span style="color:#aaa;font-size:10px">${esc(tx.note)}</span>`:''}</td>
        <td>${catEmoji(tx.category)} ${esc(catLabel(tx.category))}</td>
        <td><span class="pill pill-${tx.type}">${tx.type}</span></td>
        <td class="amount ${tx.type==='income'?'inc-amt':'exp-amt'}">${tx.type==='income'?'+':'−'}${esc(fmt(tx.amount))}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <!-- Goals -->
  ${goals.length > 0 ? `<h2>🏆 ${esc(t('pdf_goals_progress'))}</h2>
  <div style="margin-bottom:20px">
    ${goals.map(g => {
      const p2 = g.target>0?Math.min(g.saved/g.target*100,100):0;
      const col = p2>=100?'#2dd98f':p2>=50?'#f0c14b':'#4e8ef7';
      return `<div class="goal-row">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${g.emoji} ${esc(g.name)}${g.deadline?` <span style="color:#aaa;font-size:10px">by ${esc(fmtDate(g.deadline))}</span>`:''}</div>
          <div style="background:#e8eaf0;border-radius:4px;height:8px;overflow:hidden;margin-top:4px;width:200px"><div style="background:${col};width:${p2}%;height:100%;border-radius:4px"></div></div>
        </div>
        <div style="text-align:right;font-family:monospace;font-size:11px">
          <div style="font-weight:700">${esc(fmt(g.saved))} / ${esc(fmt(g.target))}</div>
          <div style="color:${col};font-weight:700">${p2.toFixed(0)}%</div>
        </div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- Recurring -->
  ${recur.length > 0 ? `<h2>↻ ${esc(t('pdf_recurring'))}</h2>
  <table>
    <thead><tr><th>Description</th><th>Category</th><th>Frequency</th><th>Next Date</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      ${recur.map(r => `<tr>
        <td><strong>${esc(r.desc)}</strong></td>
        <td>${catEmoji(r.category)} ${esc(catLabel(r.category))}</td>
        <td style="text-transform:capitalize">${esc(r.freq)}</td>
        <td style="font-family:monospace;color:#888">${esc(fmtDate(r.nextDate))}</td>
        <td class="amount ${r.type==='income'?'inc-amt':'exp-amt'}">${r.type==='income'?'+':'−'}${esc(fmt(r.amount))}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>Generated by <strong>CashFlow PWA v4.0</strong> · farukislamyt.github.io/CashFlow · All data is private and stored locally.</div>
    <div style="margin-top:4px;color:#ccc">Report covers: ${esc(period)} · Generated: ${esc(genDate)}</div>
  </div>

</div>
<script>
  // Auto-trigger print after brief delay for proper render
  window.addEventListener('load', () => {
    if (window.location.search.includes('autoprint')) {
      setTimeout(() => window.print(), 400);
    }
  });
<\/script>
</body>
</html>`;

    // Open in new window and trigger print
    const win = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
    if (!win) {
      // Popup blocked — download as HTML fallback
      const blob = new Blob([html], { type:'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `cashflow_report_${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      return false;
    }
    win.document.write(html);
    win.document.close();
    return true;
  }

  return Object.freeze({ generate });
})();

window.PDF = PDF;
