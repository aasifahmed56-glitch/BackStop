# Tripwires

A tripwire warns someone **before** they change an area that has a known history: work that was reverted, a recorded decision, code only the leaver understood, a module nobody has touched for a while, or two sources that disagree. Each warning says why it matched, shows the evidence it is built on, and names who to ask.

Everything here is plain code. No AI is called when tripwires are built, checked or replayed, so the feature works the same with `LLM_PROVIDER=none`.

## Where to find it

Handover page → **Check a change** (button at the top). Paste file paths (one per line) or a unified diff, add a short description, and press **Check**. Two example buttons fill in sample changes: "switch notifications to websockets" and "rewrite the deploy scripts".

API:

| Endpoint | What it does |
|---|---|
| `GET /api/projects/{id}/tripwires?role=…` | All tripwires the role may see |
| `POST /api/projects/{id}/tripwires/check` | Body `{files: [...], diff: "...", description: "...", role: "..."}`; returns the tripwires that fire and why |
| `GET /api/tripwires/replay` | The saved replay result (`backend/data/trust/tripwire_replay.json`) |

Limits: at most 500 files, a 400 KB diff and a 2,000-character description per check.

## How tripwires are built (`backend/app/tripwires.py`)

| Kind | Severity | Built from | Area |
|---|---|---|---|
| Reverted work | high | Each `REVERTED WORK` derived claim, plus decision, risk, blocker or question claims that share a keyword with the revert (for example "polling"). The first such claim that states a reason becomes the recorded reason. | The files of the revert (and of the original commit when its message matches), their modules, and keywords from the revert plus words shared by at least two related claims (for example "websockets") |
| Decision | high | Approved or corrected `decision` claims that state a reason ("X because Y", "X — Y", "X. Y"). Decisions sharing a keyword are grouped into one tripwire, and a decision already used as the reason for a reverted-work tripwire is not repeated. | Keywords from the decision part; modules named in the text, or modules whose commit messages use the keyword (at most two, for example "jwt" → `auth/`) |
| Sole knowledge | medium | `SOLE KNOWLEDGE RISK` derived claims | The module |
| Stale module | medium | `STALE MODULE` derived claims | The module |
| Conflict | medium | Claims with status `conflicting` | Topic words and modules named in the text |

**Who to ask** comes from `CONTACT` claims, "X takes over module/" claims, or the module's top non-leaver author.

**Matching.** A change matches a tripwire when one of its files is named in the tripwire or sits inside one of its modules (*path match*), or when its description shares a keyword with the tripwire (*keyword match*). Keywords ignore case, plural "s" and a list of generic words ("fix", "update", "demo", …). High-severity results are shown first.

**Review state.** Rejected claims are never used. Decision tripwires need an approved or corrected claim; the check reports how many reasoned decisions are still waiting for review. Derived claims (reverts, sole knowledge, stale modules, conflicts) are used before review, and every evidence item carries its review state so the page can say "not reviewed yet".

## Access control

Tripwires are built **per role** from only the claims that role may see (`role_can_see`, the same ceiling used by the handover). A claim above the ceiling is never read, so:

- a tripwire whose base claim is restricted or confidential is never built for a lower role;
- the text, quotes and keywords of a hidden claim cannot appear in a warning, in the evidence, or in keyword matching (so a lower role cannot probe for hidden words);
- git history is only read when the role may see the git source.

The response only says how many claims were left out. Evidence is the claim's own quote, the source **file name** and line numbers, or a commit hash and message; raw source text is never returned. Tests: `backend/tests/test_tripwires.py` (`test_access_ceiling_hides_restricted_tripwires`, `test_admin_sees_confidential_tripwire`, `test_lower_role_evidence_is_within_ceiling`, `test_no_raw_source_text`).

## Replay validation (`backend/scripts/replay_tripwires.py`)

The question: if tripwires had been built on the day the person left, would they have warned about the changes that later went wrong?

### Rules

These rules were written into `backend/app/tripwires_replay.py` before the first run and have not been changed since. After the first run we only added a per-kind breakdown of the same numbers.

1. Build tripwires from commits **on or before the cutoff only**. The replay can only use git-based tripwires (reverted work, sole knowledge, stale modules): decision and conflict tripwires come from reviewed claims, which have no reliable dates.
2. Every commit in the **180 days** after the cutoff is a proposed change. Its file list and its message go through the same matcher the app uses.
3. A proposed commit was **later problematic** if
   - a later commit reverts it (the revert names its hash or quotes its message), or
   - a later commit within **30 days** whose message matches `revert`, `fix`, `fixes`, `fixed` or `bug` touches one of the **same files**.

   A looser secondary rule uses "same module" instead of "same file".
4. Compare with a trivial baseline that flags every commit touching a module whose top author before the cutoff was the leaver, and with flagging everything (precision = base rate).

### Results (saved in `backend/data/trust/tripwire_replay.json`)

**mocha (real, MIT, pseudonymised), cutoff 16 May 2014, 142 proposed changes, 26 tripwires (9 reverted work, 1 sole knowledge, 16 stale modules).** Same-file rule: 45 problematic (base rate 31.7%).

| Method | Flagged | Hits | Misses | Flag rate | Precision | Recall |
|---|---|---|---|---|---|---|
| Tripwires | 109 | 40 | 5 | 76.8% | 36.7% | 88.9% |
| Baseline: leaver-owned module | 134 | 45 | 0 | 94.4% | 33.6% | 100% |
| Flag everything | 142 | 45 | 0 | 100% | 31.7% | 100% |

By kind: reverted-work tripwires flagged 98 commits at 38.8% precision; stale-module tripwires flagged 38 at 44.7% precision but caught only 17 of 45. The single sole-knowledge tripwire flagged nothing.

**Synthetic sample, replay cutoff 14 Jan 2026 (60 days before the departure, because the sample log ends on the departure date), 40 proposed changes, 4 tripwires.** The same-file rule finds **no** problematic commits: every synthetic commit has its own invented file name, so it cannot be evaluated. With the looser same-module rule, 8 of 40 are problematic; tripwires flag 23 and hit 2 (precision 8.7%, recall 25%), exactly the same as the baseline and worse than flagging everything (20%).

### What this means

- On mocha, tripwires are only slightly better than chance: 36.7% precision against a 31.7% base rate. They do warn about most changes that later needed a fix (89%), but they also flag three out of four commits, which is too noisy for a real team to trust.
- Most of the noise comes from reverted-work tripwires. mocha's early reverts touched core files such as `lib/runner.js`, so a "this file was reverted before" warning fires on most later changes.
- Stale-module tripwires are the most precise signal in this replay, but they miss most problems.
- The synthetic sample is not useful for this kind of validation. Its value is as a demonstration of the warnings, not as evidence that they work.
- One project and one departure is a case study, not a statistical result, and "fix" in a commit message is a rough proxy for trouble.

### Next steps

Weight reverted-work warnings by how recent the revert was and how many files the change shares with it; require two signals before flagging; and replay on a second project (express is shortlisted).
