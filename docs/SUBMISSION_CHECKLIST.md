# Final test plan and submission checklist

The checks run before the Round 3 submission, in order. Each one says how to run it and what counts as a pass.

## 1. Automated checks

| Check | Command | Pass when |
|---|---|---|
| Backend tests | `cd backend && python -m pytest -q` | Every test passes |
| Trust harness | `cd backend && python -m pytest tests/trust -q` | 0 leaks across every route, role and tampered role value |
| Frontend lint | `npm --prefix frontend run lint` | No errors |
| Frontend build | `npm --prefix frontend run build` | Build succeeds |
| CI | GitHub Actions on `main` | Both jobs green |

## 2. Page check

`frontend/scripts/page-check.cjs` signs in as `lead`, `dev`, `pm`, `admin`, `manager`, `lead2` and `dev2`, opens every page at desktop (1440 px) and phone (390 px) width, and fails on console errors, server errors from the API, or a page that scrolls sideways.

```bash
# with the app running on port 8000 and DEMO_ACCOUNTS=1
node frontend/scripts/page-check.cjs http://localhost:8000          # check only
node frontend/scripts/page-check.cjs http://localhost:8000 --shots  # also save docs/screenshots/
```

It needs Playwright installed where Node can find it (`npm i -g playwright`, then `NODE_PATH=$(npm root -g)`).

## 3. Design review of every page

Each page is reviewed for layout, hierarchy, copy, states (loading, empty, error, locked), keyboard use, focus, contrast and phone layout:

Sign-in, Admin sign-in, Overview, Projects, Team, Records, Check the claims, Debrief, Handover, Check a change, Backtest (sample and mocha), Trust report, Accounts, and the locked screen a newcomer sees on reviewer pages.

## 4. Manual journeys

| # | Journey | Pass when |
|---|---|---|
| 1 | Sign in as `lead`, approve a claim, open Handover | The approved claim appears in the plan |
| 2 | Edit a claim | A new version and an audit entry appear |
| 3 | Reject a claim without a reason | The form refuses until a reason is given |
| 4 | Sign in as `dev`, open Handover | Restricted claims show as locked, with no text or quote |
| 5 | As `dev`, open `#/review` | The locked screen shows instead of the review queue |
| 6 | Sign in as `admin` at `/login` | Refused; admins use `/admin/login` |
| 7 | Sign in as `lead` at `/admin/login` | Refused |
| 8 | Wrong password 11 times in a minute | The 11th attempt is rate-limited |
| 9 | Check a change with `payments/webhooks.py` | Tripwires appear with evidence and who to ask |
| 10 | Import a small public GitHub repository | Records and claims are built; errors are clear for a bad link |
| 11 | Record a debrief answer | Readiness changes and the answer waits for review |
| 12 | Reset the sample | It asks first and does not touch other projects |
| 13 | Sign in as `lead2` | Only Mobile Check-in App is listed; Campus Event App cannot be opened |
| 14 | Sign in as `manager`, open Your teams | Both teams, their leads and members, and the activity log |

## 5. Live site

| Check | Pass when |
|---|---|
| `GET /healthz` | `{"status":"ok"}` |
| Latest Render deploy | Built from the newest `main` commit and live |
| Sign-in with every demo account | Works |
| Cold start | The sample project is seeded and the Overview loads |

## 6. Submission pack

| Item | Where |
|---|---|
| Live link | https://backstop-atsu.onrender.com |
| Repository | https://github.com/itzz-inbathamizhanS/BackStop |
| Final report source | [FINAL_REPORT.md](FINAL_REPORT.md) |
| Demo script | [DEMO_SCRIPT.md](DEMO_SCRIPT.md) |
| Screenshots | [screenshots/](screenshots/) |
| Contribution statements and tool disclosure | [FINAL_REPORT.md](FINAL_REPORT.md) sections 10 and 11 |
