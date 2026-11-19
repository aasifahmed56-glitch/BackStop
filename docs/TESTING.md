# Backstop — Testing Documentation

This document summarizes the automated test suite and provides a detailed manual testing matrix for the Backstop platform.

---

## 1. Automated Test Suite (pytest)

Backstop has **233 automated unit and integration tests**. All pass.

```bash
cd backend
python -m pytest -q            # whole suite, about 30 seconds
python -m pytest tests/trust   # trust harness only
AUTH_DISABLED=1 python -m tests.trust.leak_harness   # rewrite data/trust/leak_report.json
```

The frontend is checked with its linter and a production build:

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

GitHub Actions runs all three on every push and pull request (`.github/workflows/ci.yml`).

The suite runs with sign-in turned off (`AUTH_DISABLED=1` in `tests/conftest.py`) so each test can call the API directly; `test_auth.py` turns it back on.

### Page check

`frontend/scripts/page-check.cjs` signs in as every demo account, opens every page at desktop and phone width, and fails on console errors, server errors or sideways scrolling. With `--shots` it also refreshes `docs/screenshots/`. See [SUBMISSION_CHECKLIST.md](SUBMISSION_CHECKLIST.md).

| Test file | Tests | Covers |
|---|---|---|
| `test_access_control.py` | 25 | Access level order, strictest-evidence rule, role visibility matrix |
| `test_redact.py` | 17 | Masking keys, tokens, passwords, emails and phones; planted tokens never returned |
| `test_derived.py` | 38 | Ownership, sole knowledge, staleness, contact overlap, knowledge-at-risk score |
| `test_verify.py` | 5 | Exact substring check, quote normalisation, support grades, conflicts |
| `test_trust_fixes.py` | 9 | Fail-closed verification and the fixes for leaks the harness found |
| `test_claim_access_from_evidence.py` | 13 | Claim access recomputed from the sources it cites |
| `test_review_and_views.py` | 11 | Approve, correct, reject, audit log, role emphasis, Day 1 / Week 1 / Month 1 plan |
| `test_api_pipeline.py` | 5 | End-to-end sample load, upload hardening, derivation, claim listing |
| `test_cache_stability.py` | 4 | Cache keys stable across line endings and models; offline reads; idempotent sample load and reset |
| `test_banned_strings.py` | 1 | Banned placeholder strings never appear in the frontend |
| `test_debrief.py` | 6 | Debrief questions, recorded answers, readiness score |
| `test_workspace.py` | 4 | Keyword rules, git log cleaning, lead-only writes, full offline project loop |
| `test_github_import.py` | 26 | URL validation, limits, pseudonymisation, timeouts, errors |
| `test_realdata_export.py` | 2 | Real-history exporter pseudonymises authors and respects the cutoff |
| `test_backtest.py` | 2 | Precision@k and recall@k on a hand-checked example |
| `test_real_backtest.py` | 9 | No post-cutoff leakage into the ranking; mocha result reproducible |
| `test_auth.py` | 10 | Password hashing, sign-in required, separate team and admin pages, HttpOnly cookie, refused roles, sign-out, account management, last admin protected |
| `test_repomap.py` | 3 | Repository map shape, role filtering, unknown project |
| `test_tripwires.py` | 22 | Tripwire building, path and keyword matching, access ceilings, no echo of restricted text |
| `trust/test_leak_harness.py` | 5 | Every route × every role × tampered role values: zero leaks |
| `trust/test_detail_check.py` | 15 | Numbers, dates and names in a claim must appear in its quote |
| `trust/test_trust_report_api.py` | 1 | Trust report endpoint serves the saved results |

## 2. Manual Test Matrix

The following table documents manual user journeys and edge cases executed against the live application:

| # | User Journey / Scenario | Test Steps | Expected Result | Actual Result | Status |
|---|-------------------------|------------|-----------------|---------------|--------|
| **1** | **Main Golden Path Journey** | 1. Open home page.<br>2. Click *"Load the Sample Project"*.<br>3. Navigate to *"Review Queue"*.<br>4. Inspect claims and click *"Approve"* on key claims.<br>5. Navigate to *"Handover Dossier"*.<br>6. View Phased Roadmap and click *"Acknowledge Receipt"*. | - Database seeds cleanly with sample sources and chunks.<br>- Derived and interpreted claims appear in review queue.<br>- Approving a claim makes it immediately visible in Handover.<br>- Handover organizes items into Day 1, Week 1, and Month 1.<br>- Acknowledgment records an audit log entry. | Project loaded in <1s; 24 claims rendered; approved items populated Day 1/Week 1/Month 1 sections; audit log signed successfully. | **PASS** |
| **2** | **Role Switch & Access Redaction** | 1. Navigate to *"Handover Dossier"*.<br>2. Switch role dropdown to `incoming_dev`.<br>3. Inspect claims list.<br>4. Switch role to `lead` or `admin`. | - For `incoming_dev`: restricted/confidential items appear only as locked placeholders (*"Requires restricted access — request from lead"*). Zero quotes or texts leak.<br>- For `lead`/`admin`: locked items unlock, revealing full text and citations. | Restricted HR notes and confidential vendor budget contracts strictly withheld for dev/pm roles. Unlocked for lead/admin. | **PASS** |
| **3** | **Claim Rejection with Audit Reason** | 1. Navigate to *"Review Queue"*.<br>2. Select any claim.<br>3. Click *"Reject"*.<br>4. Submit without a reason.<br>5. Enter reason *"Outdated information"* and confirm. | - Form blocks submission without a reason.<br>- On submission, claim status updates to `rejected`.<br>- Claim is excluded from all handover dossiers.<br>- Reason is saved in the audit log. | Submission blocked when blank; rejected state persisted; claim removed from handover view; audit log entry recorded. | **PASS** |
| **4** | **Claim Edit & Version Increment** | 1. Navigate to *"Review Queue"*.<br>2. Select a claim (currently v1).<br>3. Click *"Edit"*.<br>4. Modify text and add note *"Corrected endpoint path"*.<br>5. Confirm. | - Claim text updates to new version.<br>- `current_version` increments from 1 to 2.<br>- `review_state` changes to `corrected`.<br>- Version History timeline lists both v1 and v2 with timestamps and edit note. | Text updated to v2; review state set to `corrected`; Version History panel displayed previous v1 and new v2 with note. | **PASS** |
| **5** | **File Upload (Valid Format)** | 1. Send `POST /api/projects/1/upload` with a valid `.txt` git log or `.md` meeting note.<br>2. Inspect response. | - Upload succeeds (HTTP 200).<br>- Filename is sanitized.<br>- Chunks are parsed and indexed with line numbers. | HTTP 200 returned; chunks parsed into database; sanitized name assigned. | **PASS** |
| **6** | **Empty File Upload Edge Case** | 1. Send `POST /api/projects/1/upload` with a 0-byte file. | - Ingest handles empty file gracefully without server crash or unhandled exception.<br>- Returns 0 chunks created. | Handled gracefully without errors; chunk_count: 0 returned. | **PASS** |
| **7** | **Wrong File Type / Executable Upload** | 1. Send `POST /api/projects/1/upload` with an executable file (e.g. `malicious.exe` or `script.py`). | - Request is rejected with HTTP 400 Bad Request.<br>- Error message explicitly lists allowed extensions (`.txt`, `.json`, `.md`, `.csv`).<br>- File is never executed or written to disk. | HTTP 400 returned: *"Extension '.exe' not allowed. Use: ['.csv', '.json', '.md', '.txt']"*. Zero execution. | **PASS** |
| **8** | **API Failure / Offline Fallback** | 1. Set `LLM_PROVIDER=none` in `.env` or run without network access.<br>2. Trigger claim extraction via `POST /api/projects/1/extract`. | - System does not crash or stall.<br>- Reads pre-computed deterministic responses from `backend/data/cache/`.<br>- Extraction finishes successfully and loads claims. | All 84 cached responses loaded from disk; extraction succeeded 100% offline without network calls. | **PASS** |


## Trust tests

`backend/tests/trust/` holds the leak harness (every API route, every role and tampered role value), the
deterministic detail-check tests and the Trust report endpoint test. They run with the normal suite.
Results, fixes and limits are in [TRUST_REPORT.md](TRUST_REPORT.md).
