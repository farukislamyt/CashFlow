# 💸 CashFlow PWA v3.0

> Production-grade Progressive Web App. Offline-first. Installable. New features. All bugs fixed.

🌐 **Live:** [farukislamyt.github.io/CashFlow](https://farukislamyt.github.io/CashFlow/)

---

## ✨ What's New in v3.0

| Feature | Details |
|---|---|
| 🔄 **Recurring Transactions** | Weekly/Monthly/Yearly auto-entries, pause/resume |
| 🏆 **Savings Goals** | Track progress toward financial targets with deadlines |
| 🌡️ **Spending Heatmap** | 52-week visual calendar of daily spending |
| 📊 **Month Navigation** | Browse any past month in Reports |
| 💡 **Smart Insights** | Auto-generated chips: top category, savings rate, due recurring |
| 📈 **MoM Trends** | Month-over-month % change on KPIs |
| 📥 **Income Breakdown** | Per-source income chart in Reports |
| 🔒 **Confirm Dialogs** | Custom native-free confirm — works in PWA standalone |
| ⌨️ **Number Nav** | Press 1-5 to jump between pages |
| 🔄 **Auto Apply Recurring** | Due entries applied automatically on app open |

## 🐛 Bugs Fixed

- ✅ Category dropdown not pre-selecting on edit → fixed with `requestAnimationFrame`
- ✅ Same-page `goTo()` early return preventing re-render → removed guard
- ✅ Inline `onclick` with raw IDs (XSS risk) → replaced with event delegation everywhere
- ✅ `confirm()` broken in PWA standalone mode → replaced with custom dialog
- ✅ Savings rate showing negative → clamped to `Math.max(0, ...)`
- ✅ Touch devices: action buttons hidden → always visible on `hover:none` devices
- ✅ History mobile search not synced to desktop search
- ✅ Modal body overflow on small screens → `max-height: 92dvh`
- ✅ Budget badge not clearing after budget deletion
- ✅ SW registering with wrong scope on GitHub Pages

---

## 📁 File Structure

```
CashFlow/
├── index.html          ← App shell + all 5 pages
├── manifest.json       ← PWA manifest with shortcuts
├── sw.js               ← Service Worker (cache-first + stale-while-revalidate)
├── .nojekyll
└── assets/
    ├── css/
    │   ├── tokens.css      ← CSS variables
    │   ├── base.css        ← Reset, layout, animations
    │   ├── nav.css         ← Sidebar, TopBar, BottomNav, PWA banners
    │   └── components.css  ← All UI components + new features
    ├── js/
    │   ├── store.js        ← Data layer + recurring + goals
    │   ├── ui.js           ← Rendering helpers + heatmap + sparkline
    │   └── app.js          ← Controller + PWA hooks + all page logic
    └── icons/
        ├── icon.svg
        ├── icon-192.png
        └── icon-512.png
```

---

## 🚀 Deploy

1. Push all files to `CashFlow` repo root (`main` branch)
2. **Settings → Pages → Source → Deploy from branch → `main` → `/ (root)`**
3. Live at `https://farukislamyt.github.io/CashFlow/`

Built by [Faruk Islam](https://github.com/farukislamyt) · MIT
