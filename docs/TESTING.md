# Backstop — Testing Documentation

This document summarizes the automated test suite and provides a detailed manual testing matrix for the Backstop platform.

---

## 1. Automated Test Suite (pytest)

Backstop includes 100 automated unit and integration tests covering the complete pipeline:

```bash
# Run the complete test suite
python -m pytest backend/tests/ -v
```

### Test Suite Breakdown

| Test File | Tests | Coverage Scope |
|-----------|-------|----------------|
| `backend/tests/test_access_control.py` | 25 | Access level hierarchy (`public < team < restricted < confidential`), strictest access derivation, and role visibility matrix (`admin`, `lead`, `incoming_dev`, `incoming_pm`). |
| `backend/tests/test_redact.py` | 17 | Secret masking (API keys, JWTs, passwords), PII masking (emails, phone numbers), audit counts, and ensuring planted tokens are never returned. |
| `backend/tests/test_derived.py` | 38 | Plain Python calculations: module ownership shares, sole knowledge detection ($\ge 70\%$ share and $\le 1$ other contributor), 30-day staleness, contact overlaps, and knowledge-at-risk scoring on a hand-crafted git log. |
| `backend/tests/test_verify.py` | 5 | Substring quote verification against original unredacted text, normalization of whitespace and smart quotes, support checks (`yes`/`partly`/`no`), and conflict labeling. |
| `backend/tests/test_review_and_views.py` | 8 | Human review actions (approve, edit with version increments, reject with required reasons), audit logging, role emphasis, Day 1 / Week 1 / Month 1 roadmap rules, and withholding sensitive claims from unauthorized roles. |
| `backend/tests/test_api_pipeline.py` | 5 | End-to-end integration: sample ingest, upload sanitization and file size limits, plain code derivation, and claims retrieval. |
| `backend/tests/test_backtest.py` | 2 | Backtest engine: hand-calculated precision@k and recall@k on synthetic benchmark dataset, verifying Backstop risk score outperforms raw commit count baseline. |
| **Total** | **100** | **100% Passed** |

---

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
