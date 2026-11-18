# API reference

All routes are under `/api` except `/healthz`. The interactive reference is served at `/docs` (Swagger UI) when the app runs.

Routes that return claim or source text take a `role` (`incoming_dev`, `incoming_pm`, `lead`, `admin`). If none is sent, the lowest role is used. Text above the role's access level is never returned. Routes marked *lead only* refuse lower roles.

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/backtest/datasets` | Backtest Datasets |
| `GET` | `/api/backtest/projects/{project_id}` | Backtest Project |
| `GET` | `/api/backtest/real/{name}` | Backtest Real |
| `GET` | `/api/claims` | List claims with filters, sorted by risk priority |
| `POST` | `/api/claims/bulk-approve-verified` | Bulk approve all verified claims (demo shortcut) |
| `POST` | `/api/claims/recompute-access` | Recompute access levels for claims from evidence |
| `GET` | `/api/claims/stats` | Review queue stats bar metrics |
| `POST` | `/api/claims/{claim_id}/approve` | Approve claim |
| `GET` | `/api/claims/{claim_id}/context` | Fetch chunk context for quote highlighting |
| `POST` | `/api/claims/{claim_id}/edit` | Correct claim text and record new version |
| `POST` | `/api/claims/{claim_id}/reject` | Reject claim with reason |
| `GET` | `/api/claims/{claim_id}/versions` | Get version history of a claim |
| `POST` | `/api/import/github` | Import Github |
| `GET` | `/api/projects` | List projects with their counts |
| `POST` | `/api/projects` | Create a handover project (lead only) |
| `GET` | `/api/projects/{project_id}` | Project detail with source/chunk counts |
| `DELETE` | `/api/projects/{project_id}` | Delete a project and everything in it (lead only) |
| `POST` | `/api/projects/{project_id}/acknowledge` | Acknowledge handover receipt |
| `POST` | `/api/projects/{project_id}/analyse` | Build claims from every record in the project (lead only) |
| `GET` | `/api/projects/{project_id}/claims` | List claims for a project, sorted by risk priority |
| `POST` | `/api/projects/{project_id}/claims/bulk-approve-verified` | Bulk approve all verified claims for project |
| `GET` | `/api/projects/{project_id}/debrief` | Debrief questions for the person leaving, plus handover readiness |
| `POST` | `/api/projects/{project_id}/debrief/answer` | Record the leaver's answer as a new claim awaiting review |
| `POST` | `/api/projects/{project_id}/derive` | Compute all derived claims from git/task data |
| `POST` | `/api/projects/{project_id}/extract` | Extract and verify interpreted claims |
| `GET` | `/api/projects/{project_id}/handover` | Generate permission-aware handover |
| `GET` | `/api/projects/{project_id}/sources` | Records the role may see, with part counts |
| `POST` | `/api/projects/{project_id}/sources/github` | Add a public repository's commit history (lead only) |
| `POST` | `/api/projects/{project_id}/sources/paste` | Add a record by pasting text (lead only) |
| `DELETE` | `/api/projects/{project_id}/sources/{source_id}` | Remove a record and the claims that cite only it (lead only) |
| `GET` | `/api/projects/{project_id}/tripwires` | List tripwires visible to a role |
| `POST` | `/api/projects/{project_id}/tripwires/check` | Check a proposed change against tripwires |
| `POST` | `/api/projects/{project_id}/upload` | Upload a file (txt/json/md/csv, max 5 MB) |
| `POST` | `/api/sample/load` | Load all files from backend/data/sample/ |
| `POST` | `/api/sample/reset` | Reset sample project back to fresh state |
| `GET` | `/api/tripwires/replay` | Saved replay validation of tripwires |
| `GET` | `/api/trust/report` | Trust Report |
| `GET` | `/healthz` | Healthz |

## Limits

| Route | Limit |
|---|---|
| `POST …/upload` | 10 per minute; 5 MB; `.txt`, `.json`, `.md`, `.csv` only |
| `POST …/extract` | 6 per minute |
| GitHub import | One at a time; 3 per hour per client; 60 s clone timeout; 3,000 commits |
