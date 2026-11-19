# Demo script

A five-minute walk through Backstop for judges or a recorded video. Every step works on the live site with the demo accounts and needs no setup.

**Live site:** https://backstop-atsu.onrender.com
**Accounts:** `manager`, `lead`, `dev`, `pm`, `lead2`, `dev2`, `pm2` with password `backstop-demo` at `/login`; `admin` with password `admin` at `/admin/login`.

> The free Render instance sleeps when idle. Open the site a minute before you start so the first page loads at once.

---

## 0:00 The problem (20 seconds)

> "When a core engineer leaves, the team loses what lived in their head. Backstop reads the trail a team already leaves, turns it into claims, and shows proof for every one of them before a human approves the handover."

## 0:20 Sign in and see the risk (40 seconds)

1. Open `/login` and sign in as **lead**.
2. The **Overview** shows the sample project, *Campus Event App*, with *Riya* leaving.
3. Point at the modules ranked by knowledge at risk.

> "These numbers come from plain code over the git history. Nothing here is generated."

## 1:00 Check the claims (60 seconds)

1. Open **Review** (Check the claims).
2. Select a claim. Show the source quote highlighted in the original record and the verification status.
3. Approve one claim. Edit another and show the version history.
4. Open a claim marked *Conflicting* and show the two sources side by side.

> "Every claim quotes its source word for word, and the quote is checked against the original. If it is not there, the claim is not shown as verified."

## 2:00 Debrief and readiness (30 seconds)

1. Open **Debrief**. Show the questions built from the gaps.
2. Record an answer and watch handover readiness change.

## 2:30 Role-gated handover (45 seconds)

1. Open **Handover**. Show the Day 1 / Week 1 / Month 1 plan.
2. Sign out and sign in as **dev**. The restricted notes now appear as locked placeholders with no text and no quote.

> "Access is enforced on the server. A newcomer cannot unlock a note by changing anything in the browser."

## 3:15 Check a change (30 seconds)

1. Still as **dev**, open **Check a change** and paste a file path from the sample, for example `payments/webhooks.py`.
2. Show the tripwires: reverted work, recorded decisions and who to ask, each linked to evidence.

## 3:45 Did it work? (60 seconds)

1. Sign back in as **lead** and open **Backtest**. Switch to the real mocha history.
2. Say the honest result: today's score found 0 of 8 troubled modules in its top 5, a plain commit count found 5 of 5, and candidate score v2 finds 4 of 5 but was chosen after seeing mocha.
3. Open **Trust report**: 1,568 leak attacks, 0 leaks, after the first run found and fixed 126.

> "We report the weak numbers as they are. That is the same rule the product follows."

## 4:45 Teams and your own project (15 seconds)

Sign in as **manager** and open **Your teams** from the More menu (the ⋯ button): two teams, each lead sees only their own team's projects, and the activity log shows who works where. Then open **Projects** to start a project, import a public GitHub repository, or paste records and build claims offline.

## Close

> "Proof for every claim, a human before every handover, and access enforced on the server."

---

## Backup plan

- If the live site is slow, run it locally: see [README section 3](../README.md#3-run-it-locally).
- Screenshots of every page are in [docs/screenshots/](screenshots/).
