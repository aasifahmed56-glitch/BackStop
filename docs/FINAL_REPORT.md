# Backstop: final product report

*Round 3 submission. Team: Aasif Ahmed A (lead), Inbathamizhan S, Vedhan S.*

| | |
|---|---|
| **Live app** | `<live link>` |
| **Repository** | https://github.com/aasifahmed56-glitch/BackStop |
| **One line** | Every claim shows its source quote and a status. A human approves before handover. |

> This file is the source text for the final PDF. Fill in the live link and the contribution statements in section 10, then export.

---

## 1. Problem

When a core engineer leaves, the team falls off an *information cliff*. Documentation is stale, decisions and their reasons live in one person's head, and the successor spends weeks guessing. Handovers that forward old chats and notes also leak passwords, personal details and confidential plans to people who should not see them.

## 2. Solution

Backstop reads the trail a team already leaves (git history, issues, meeting notes, task lists and chat) and turns it into a ledger of **claims**. Each claim carries proof and passes a human before the successor sees it.

Five rules make it trustworthy:

1. **Numbers come from plain code.** Ownership, sole-knowledge risk, staleness and the risk score are computed, never generated.
2. **Every interpreted claim quotes its source word for word**, and the quote is checked against the original text. If it is not there, the claim is not shown as verified.
3. **Secrets and personal data are masked** before any text leaves the server.
4. **People see only what their role allows.** Claims inherit the strictest access level of their evidence; lower roles see a locked placeholder.
5. **A human approves before handover**, and every change is versioned and audited.

## 3. What a user can do

1. Load the sample project, or create a project and add records (paste, upload, or import a public GitHub history).
2. See which modules are most at risk now that the person is leaving.
3. Review each claim with its quote highlighted in the source; approve, correct or reject.
4. Send debrief questions to the person leaving, record the answers, and watch handover readiness rise.
5. Open the role-gated handover with a Day 1 / Week 1 / Month 1 plan; acknowledge receipt; print.
6. Before changing code, **Check a change** for tripwires: reverted work, recorded decisions, sole-knowledge areas.
7. See how well Backstop itself works: **Backtest** and **Trust report**.

## 4. Architecture

One FastAPI service serves the API and the React app; SQLite stores sources, chunks, claims, versions and the audit log. The derived engine is plain Python. The extractor runs from a committed cache in production (`LLM_PROVIDER=none`), so the live app needs no key and makes no outside calls. Verification fails closed: exact substring, then a deterministic detail check, then a support check. Every route that returns text enforces the caller's role on the server.

*(Insert the diagram from README section 5.)*

## 5. The three Round 3 improvements

### 5.1 Real-project backtest and GitHub import

- **What:** A pseudonymised dataset of mocha's public history (1,537 commits, 243 contributors, MIT licence). The original author's last commit was 16 May 2014. Backstop ranks modules using only history up to that day; ground truth is which modules needed new people *and* fixes in the next 180 days. Rules were written before results were computed and not tuned afterwards. Any public GitHub repository can also be analysed from a link, with time, size and rate limits.
- **Result:** Backstop's top 5 hit **0 of 8** troubled modules. A plain count of the leaver's commits hit **5 of 5**. Backstop favoured small test folders the leaver owned alone, which nobody needed to touch later.
- **What we learned:** Sole ownership alone is a poor predictor. The roadmap re-weights the score by module activity and tests it on more departures.

### 5.2 Trust test suite

- **What:** A leak harness attacks every API route as every role, including guessed ids and tampered role values. A set of 40 hand-labelled claim/quote pairs, some deliberately wrong, measures the proof check.
- **Result:** The first run found **126 real leaks** in 1,290 attacks. All were fixed and each is guarded by a test. The latest run: **1,357 attacks, 0 leaks**. A new deterministic detail check caught **5 of 5** invented details and rejected **0** correct claims. It cannot catch right words with the wrong meaning, and the live support check was not measured because it needs a provider key.

### 5.3 Tripwires

- **What:** Paste the files you plan to change (or a diff). Backstop warns about reverted work, recorded decisions, sole-knowledge and stale areas, with the evidence and who to ask, and never above your access level. "No tripwires matched" is stated as *not* meaning safe.
- **Result:** Replayed on mocha, tripwires warned on 89 % of changes that later needed a fix, at 36.7 % precision against a 31.7 % base rate. Useful as a warning, too noisy to block changes, and the app says so.

## 6. Other Round 3 work

- Verification now fails closed; planted demo results were removed.
- Claim access is recomputed from evidence.
- Debrief questions, recorded answers and a readiness score.
- Real projects with records and GitHub import, working offline with keyword rules.
- Review queue with conflict view, keyboard review, search, shareable claim links and a command palette.
- A new visual design with a documented design system.

## 7. Reliability

- **217 automated tests** pass, covering access control, redaction, derived metrics, verification, review, handover, debrief, workspaces, GitHub import, both backtests, tripwires and the trust harness. CI runs them on every push.
- Every feature works with `LLM_PROVIDER=none` and no key.
- Upload limits, rate limits, security headers, a health check, and automatic seeding on a cold start.

## 8. Limitations

- No real sign-in; roles are simulated.
- Sample data is synthetic; its results demonstrate mechanics, not accuracy.
- On real data the risk score lost to a simple baseline.
- One real project and one departure is a case study.
- The live support check is not yet measured.
- SQLite and a single process; free hosting resets visitor projects on restart.

## 9. Roadmap

| Next | Why |
|---|---|
| Re-weight the risk score and test on more departures | Beat the commit-count baseline before relying on the ranking |
| Real sign-in mapped to roles | Replace the role switcher |
| Live GitHub / GitLab webhooks | Keep claims current |
| Measure the live support check | Close the open trust measurement |
| Reduce tripwire noise | Reach a precision teams act on |
| Postgres and background jobs | Many users and projects |

## 10. Team and contributions

| Member | Round 3 area | Statement |
|---|---|---|
| Aasif Ahmed A | Lead, tripwires, integration, deployment | *(to be written by Aasif)* |
| Inbathamizhan S | Real-project backtest and GitHub import | *(to be written by Inbathamizhan)* |
| Vedhan S | Trust test suite | *(to be written by Vedhan)* |

## 11. Tool disclosure

*(Each member lists the tools they used, as the event rules require.)*
