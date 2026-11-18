# Backstop frontend

React 19, Vite and Tailwind CSS 4. In production, FastAPI serves the built files from `frontend/dist`, so the app and API share one origin.

## Commands

```bash
npm ci            # install
npm run dev       # dev server on http://localhost:5173, proxies /api to :8000
npm run build     # production build into dist/
npm run lint      # oxlint
```

Start the backend first (`uvicorn app.main:app --reload --port 8000 --app-dir backend` from the repository root).

## Layout

| Path | What it is |
|---|---|
| `src/App.jsx` | Shell, hash routing, handover role preview |
| `src/components/AuthGate.jsx`, `LoginPage.jsx` | Sign-in gate: `/login` for team members, `/admin/login` for admins |
| `src/components/AccountsPage.jsx` | Admin page for managing accounts (`#/accounts`) |
| `src/api.js` | Every call to the backend |
| `src/components/` | One file per page (Home, Review queue, Debrief, Handover, Check a change, Backtest, Trust report, Projects, Records) plus shared UI |
| `src/index.css` | Design tokens and global styles; see `docs/design/DESIGN.md` |
| `public/` | Favicon and icon sprite |
