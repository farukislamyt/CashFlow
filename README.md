# 💸 CashFlow — Smart Money Manager

> A professional personal cash management web app built with vanilla HTML, CSS & JavaScript.
> Designed for GitHub Pages deployment — **no build tools, no frameworks, no backend.**

🌐 **Live:** [farukislamyt.github.io/CashFlow](https://farukislamyt.github.io/CashFlow/)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard** | Net balance, income/expense stats, 7-day bar chart |
| 💳 **Transactions** | Full CRUD — add, edit, delete, search & filter |
| 🎯 **Budget Planner** | Per-category monthly limits with progress bars |
| 📈 **Analytics** | 6-month overview, expense donut chart, savings rate |
| ⬇️ **CSV Export** | Download all transactions as a spreadsheet |
| 💾 **Offline-first** | All data saved in `localStorage` — no server needed |
| 📱 **Responsive** | Mobile-friendly with slide-in sidebar |
| ⌨️ **Keyboard shortcuts** | `Ctrl+K` to add, `Esc` to close modals |

---

## 🗂 File Structure

```
CashFlow/
├── index.html              ← App shell & all page templates
├── README.md
├── .nojekyll               ← Required for GitHub Pages
└── assets/
    ├── css/
    │   ├── variables.css   ← Design tokens & CSS custom properties
    │   ├── base.css        ← Reset & global styles
    │   ├── sidebar.css     ← Navigation sidebar component
    │   └── components.css  ← All UI components
    ├── js/
    │   ├── store.js        ← Data layer (localStorage CRUD)
    │   ├── ui.js           ← Reusable UI helpers & renderers
    │   └── app.js          ← App controller (pages, events)
    └── icons/
        └── favicon.svg
```

---

## 🚀 Deploy to GitHub Pages

1. Fork or clone this repository
2. Push to a GitHub repo named `CashFlow`
3. Go to **Settings → Pages → Source → Deploy from branch → main / root**
4. Visit `https://yourusername.github.io/CashFlow/`

---

## 🛠 Local Development

No build step needed. Just open in a browser:

```bash
# Option 1: VS Code Live Server extension
# Option 2: Python simple server
python3 -m http.server 8080

# Option 3: Node
npx serve .
```

---

## 🧱 Architecture

- **`store.js`** — Pure data layer. All reads/writes go through `Store.*` methods.
- **`ui.js`** — Stateless render helpers: `txRowHTML()`, `renderBarChart()`, `renderDonut()`, `Toast`, `Modal`.
- **`app.js`** — App controller. Owns page state, wires events, calls Store + UI.

---

## 📝 License

MIT — feel free to use and modify for personal projects.

Built with ❤️ by [Faruk Islam](https://github.com/farukislamyt)
