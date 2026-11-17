# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the README, PROJECT_DETAILS.md and the running app; the owner was away when this was written. Lines marked (inferred) await confirmation.

## Platform

web

## Users

- **Team lead** of a small software team, the day before someone leaves: reviews what Backstop found and approves, edits or rejects each claim.
- **Incoming developer or project manager** taking over the work: reads a handover limited to what their role may see, then signs for it.
- **Hackathon judges** (inferred, current priority): open the live site cold, with no walkthrough, and must understand and complete the journey alone.

## Product Purpose

Backstop turns a departing engineer's scattered activity (git log, issues, meeting notes, tasks, chat) into a ledger of claims. Every claim shows the exact source quote or the code that calculated it, plus a check status. A person approves each one before it reaches the successor's handover. Success: the successor starts with verified, role-appropriate knowledge instead of guesses.

## Positioning

Not a summariser. Each statement carries proof: a verbatim substring of the source, or a deterministic calculation, and a human sign-off. Missing evidence is shown as a question, not filled in.

## Operating Context

Journey: Overview → Check the claims (review queue) → Handover dossier (role switch, Day 1 / Week 1 / Month 1 plan, acknowledge, print) → Backtest (precision@k / recall@k against post-departure ground truth). Roles are simulated, no sign-in. Sample data is synthetic (Campus Event App, leaver Riya).

## Capabilities and Constraints

- Claim kinds: Derived (plain code) and Interpreted (LLM, quote-checked). Statuses: Quote matched (verified), Inferred, Conflicting, Missing evidence. Review states: pending, approved, corrected, rejected.
- Access levels: public, team, confidential, restricted; lower roles see locked placeholders.
- React + Vite + Tailwind v4 frontend served by FastAPI. The backtest page and the Overview GitHub import box are owned by parallel work and must not be restyled structurally.
- Must not break on bad input, empty states, refresh or repeated actions.

## Evidence on Hand

Synthetic sample project only (99 claims, 16 sources). No customers, testimonials or real benchmarks beyond the backtest's own numbers. Never invent any.

## Product Principles

1. Proof before prose: show the quote or the calculation next to every claim.
2. A person decides: automation sorts, never approves on its own.
3. Say what is missing: gaps become debrief questions.
4. Least access by default: hide, and say that something is hidden.
