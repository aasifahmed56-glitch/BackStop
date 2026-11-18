# Trust report

Backstop makes two promises: a role never sees text above its access level, and a claim is only shown as
Verified when its quote supports it. This report tests both on the synthetic sample project. The numbers
are tested cases, not a guarantee.

The same results are shown in the app on the **5. Trust report** page (also linked from the Backtest page).
That page reads the saved files in `backend/data/trust/` through `GET /api/trust/report`; it runs nothing live.

| File | What it holds |
|---|---|
| `backend/data/trust/leak_report_before.json` | Leak harness run on the code before the fixes |
| `backend/data/trust/leak_report.json` | Leak harness run on the current code |
| `backend/data/trust/leak_fixes.json` | Each leak, its fix and the test that guards it |
| `backend/data/trust/support_eval.json` | The 40 labelled claim/quote pairs |
| `backend/data/trust/support_eval_before.json` | Evaluation of the AI support check alone |
| `backend/data/trust/support_eval_after.json` | Evaluation of the AI check plus the detail check, the detail check alone, and its effect on the sample |

## 1. Leak attacks

**Important:** every person now signs in, and the server refuses any role the signed-in account may not act
as (a newcomer cannot send `role=lead`, a lead cannot send `role=admin`). The harness runs with sign-in
switched off so it can send every role value, so it tests the access rules (what each role value may read or
change). The sign-in guard itself is tested in `backend/tests/test_auth.py`.

### How it works

`backend/tests/trust/leak_harness.py` loads a fresh sample, approves the restricted (advisor) and confidential
(budget) claims as admin, edits one restricted claim so its history holds old text, then:

1. Calls every API route the FastAPI app serves (a test fails if a route has no case) with each role
   (`incoming_dev`, `incoming_pm`, `lead`), `admin` as a control, an unknown role, an empty role, no role,
   and tampered values (`LEAD`, `Admin`, `" lead"`, `lead;admin`, and in JSON bodies `null`, a list, a number
   and an object).
2. Guesses the ids of restricted and confidential claims on the history and context endpoints, and sweeps the
   history and context of every claim.
3. Searches the whole response (JSON and raw text) for: the fake API key, the fake email and phone (never
   allowed, for any role), the advisor note text and the restricted claims' text, quotes and old versions
   (allowed only for lead and admin), the budget amounts, vendors and confidential claims' text (allowed only
   for admin), the full raw text of any multi-chunk source, and any `raw_text` field.
4. Tries approve, reject, edit and bulk approve with every role that may not review that claim, and checks
   the request is refused and the claim is unchanged in the database.

Run it: `cd backend && python -m tests.trust.leak_harness` (writes `data/trust/leak_report.json`).
It also runs in the test suite as `tests/trust/test_leak_harness.py`.

### Results

| Run | Attacks | Blocked | Leaked |
|---|---|---|---|
| Before the fixes | 1290 | 1164 | **126** |
| After the fixes | 1290 | 1290 | **0** |
| After merging tripwires (29 endpoints) | 1357 | 1357 | **0** |

The merged build adds the three tripwire routes, which the harness picks up automatically. On the first run it caught 7 leaks in `POST /api/projects/{id}/tripwires/check`: the response echoed the caller's description, so restricted words came back to lower roles. The description is no longer echoed.

### Leaks found and fixed

| Endpoint | Failed attacks | What leaked | Fix | Test |
|---|---|---|---|---|
| `GET /api/claims/{id}/context` | 64 | Full advisor and budget notes (with rupee amounts) for any role that guessed an id; the fake API key in cited chunks for every role, including admin | Takes a role (lowest by default), 403 above the ceiling, skips chunks from sources above the ceiling, masks secrets, emails and phones in chunk text and quotes | `test_secret_in_cited_chunk_is_masked_for_every_role`, `test_no_leaks_on_any_route_or_role` |
| `GET /api/claims/{id}/versions` | 48 | Text of restricted and confidential claims and their old versions, with no role check | Takes a role (lowest by default), 403 unless the role may see the claim and every version | `test_no_leaks_on_any_route_or_role` |
| `POST /api/claims/{id}/approve`, `/reject`, `/edit` | 9 | A body with no role was treated as lead: anyone could approve, reject or overwrite team and restricted claims | A missing role is the lowest access, which may not review: 403, claim unchanged | `test_lower_role_cannot_review_and_missing_role_cannot_review` |
| `GET /api/claims`, `GET /api/projects/{id}/claims` | 3 | A request with no role was treated as lead and got restricted advisor claims | A missing role is the lowest access (`incoming_dev`) | `test_controls_permitted_roles_still_see_their_claims` |
| `POST .../bulk-approve-verified` (both paths) | 2 | Bulk approve with no role ran as lead | Same lowest-access default: 403, nothing changes | `test_lower_role_cannot_review_and_missing_role_cannot_review` |

Unknown, empty and tampered role values were already refused with HTTP 422 because the role is an enum.
Secrets and contact details are now masked in claim text, quotes, chunk context, history and the handover
for every role, using the same `redact()` that runs before any AI call.

Controls, so that "0 leaked" means something: the test suite checks that admin still sees confidential
claims, lead still sees restricted claims and can open their context and history, and a request without a
role sees exactly what `incoming_dev` sees.

## 2. Support-check evaluation

### The pairs

`backend/data/trust/support_eval.json` holds 40 claim/quote pairs written from real public and team chunks
of the sample: 15 correct, 5 unrelated, 5 opposite in meaning, 5 overstated, 5 with an invented name, number
or date, and 5 partly supported. The labels were committed (commit "Add 40 labelled claim/quote pairs") before
the detail check existed or any evaluation ran, and were not changed afterwards.

A wrong claim is **caught** when the verdict is `no` or `partly`, because then it is not shown as Verified.
A correct claim is **falsely rejected** when its verdict is `no` or `partly`.

### What was run, and what was not

**The AI support check has not been run on these pairs.** No API key was available, and the app's saved AI
answers only cover the sample's own claims, so every AI verdict in this evaluation is `unchecked`. In the app,
an unchecked claim is never shown as Verified (it fails closed to Inferred), but that is not the same as the
check catching it, so `unchecked` is reported separately and never counted as caught. The live AI numbers
still need a run with a key:

```bash
cd backend
LLM_PROVIDER=anthropic ANTHROPIC_API_KEY=... python scripts/run_support_eval.py --strict
```

That run saves its AI answers to `backend/data/cache`, so it can be replayed later with `LLM_PROVIDER=none`.

### The improvement: a deterministic detail check

`backend/app/detailcheck.py` (plain code, no AI) checks that every number, date (month and weekday names,
in full or abbreviated) and capitalised name in a claim appears in its quote or in the quote's chunk. Number
words match digits ("two" = "2") and thousands separators are ignored. In the pipeline
(`app/verify.py`), a claim the AI check called supported is downgraded to Inferred if a detail is missing,
and the missing details are stored on its evidence. The original AI support prompt is unchanged, so the
saved sample answers still match their cache keys. A stricter AI prompt was added as a separate function,
`check_claim_support_strict`, for the evaluation and new uploads; it has not been run yet either.

### Results (LLM_PROVIDER=none)

| System | Wrong claims caught | Correct claims rejected | AI check not run |
|---|---|---|---|
| Before: AI support check | 0 of 25 (0%) | 0 of 15 | 40 of 40 |
| Detail check alone | **10 of 25 (40%)** | **0 of 15 (0%)** | n/a |
| After: AI check + detail check | 10 of 25 (40%) | 0 of 15 | 30 of 40 |

Detail check by category:

| Category | Pairs | Caught |
|---|---|---|
| Invented detail | 5 | 5 |
| Unrelated | 5 | 5 |
| Opposite meaning | 5 | 0 |
| Overstated | 5 | 0 |
| Partly supported | 5 | 0 |
| Correct (false rejects) | 15 | 0 |

Reading these honestly:

- The detail check does what it is built for: all 5 invented names, numbers and dates were caught, and no
  correct claim was rejected.
- The 5 unrelated claims were caught only because each happened to name something (a module, a person, a
  number) that its quote does not mention. An unrelated claim made only of lower-case words would pass.
- It catches **none** of the opposite, overstated or partly supported claims, because those reuse the
  quote's own words. All 15 are listed as misses on the Trust report page. Catching them is the AI check's
  job, and that has not been measured yet.

### Effect on the sample project

Running the real pipeline on the sample with saved AI answers only: 83 claims verified, **0 downgraded** by
the detail check, 3 inferred (the hand-written restricted and confidential fixtures), and **0 saved AI
answers missing** (no cache misses). So the check changes nothing in the demo data, and production still works
with `LLM_PROVIDER=none`. One existing unit test did change: its fixture claimed "JWT chosen over sessions"
from a quote that never mentions JWT, which the new check rightly flags; the fixture claim now matches its
quote, and a new test keeps the original case as an example of a catch.

Run it: `cd backend && python scripts/run_support_eval.py`. Tests: `tests/trust/test_detail_check.py`.

## 3. Limitations

- The harness tests the access rules with sign-in switched off; `test_auth.py` covers the sign-in guard.
- The leak harness looks for known planted strings and the text of known restricted and confidential claims.
  Text it was not told about would not be flagged.
- Mutating admin routes (load, reset, derive, extract, upload, recompute access) take no role at all. The
  harness checks that their responses do not leak, but any visitor can call them; that is a known gap of the
  demo, not something the harness fixes.
- 40 hand-written pairs from one synthetic project is a small set; a few pairs move the rates a lot.
- The AI support check, before and after, has not been measured on the pairs (no key).
- The detail check skips ordinary words that start a sentence ("The", "Only", ...) but checks other
  sentence-initial words as possible names, so an uncommon ordinary word at the start of a claim can be
  flagged. It cannot judge meaning.
- All data is synthetic.
