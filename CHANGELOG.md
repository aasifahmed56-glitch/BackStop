# Changelog

All notable changes, grouped by hackathon round. Dates are in IST.

## Round 3 (17–20 Nov 2026)

### Added
- **Real-project backtest** on pseudonymised mocha history, with two baselines, control cutoffs and a dataset switch on the Backtest page. Method fixed before results; see `docs/BACKTEST_METHOD.md`.
- **Analyse a public GitHub repository** from the Backtest page, with timeout, size and rate limits.
- **Leak harness** that attacks every API route with every role and tampered role values, and a **Trust report** page.
- **Deterministic detail check** and a 40-pair labelled set for the support-check evaluation.
- **Tripwires**: the *Check a change* page and API, access ceilings, and replays on the sample and on mocha.
- **Debrief** questions for the person leaving, recorded answers as new claims, and a **handover readiness** score.
- **Projects and Records**: create projects, paste or upload records, import GitHub history, and build claims offline with keyword rules.
- Review queue conflict view, keyboard review, search, shareable claim links and a command palette (Ctrl/⌘ + K).
- New visual design and its documented design system.
- Documentation: architecture, API, deployment, user guide, final report, changelog, contributing and security guides.
- GitHub Actions CI running backend tests, frontend lint and build.

### Fixed
- 126 data leaks found by the harness, across claim context, claim versions, handover, projects and other routes; plus 7 in *Check a change* found after merging.
- Claim verification fails closed; planted demo results removed.
- Claim access is recomputed from the sources each claim cites.
- The demo button no longer wipes review work; Reset asks for confirmation.

### Changed
- Repository layout: long-form documents moved to `docs/`, design documents to `docs/design/`; unused frontend assets and local design-tool state removed.
- `.env.example` defaults to `LLM_PROVIDER=none` so a fresh clone runs offline.
- `npm run dev` proxies `/api` to the backend.

## Round 2 (13–14 Nov 2026)

- Single-service Render deployment with Dockerfile and `render.yaml`.
- Role access ceilings, role emphasis and withheld placeholders in the handover.
- Handover acknowledgement with recipient name and note.
- Stable cache keys across environments; no duplicate claims.
- Overview, review queue, handover and backtest screens restyled.

## Round 1

- Ingest, redaction, derived claims, interpreted claims with exact quotes, review queue, role-gated handover and the synthetic backtest.
