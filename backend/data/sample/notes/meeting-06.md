# Meeting 06 — Payments Migration Planning

**Date:** 9 Feb 2026
**Attendees:** Riya, Kabir, Dev

## Agenda
- Plan the Stripe v2 → v3 SDK migration

## Decision
- **Payments migration to the new gateway is on 20 Feb 2026.**
- Kabir leads testing. Riya to review the PR before merging.
- Rollback: revert to v2 SDK branch if issues arise.

## Notes
- Riya: "The v3 SDK has breaking changes in the webhook handler. Plan extra time."
- Dev: "I'll set up the staging environment for migration testing."

## Action Items
- [Kabir] Migration PR by 18 Feb.
- [Riya] Review and merge by 20 Feb.
- [Dev] Staging test environment ready by 15 Feb.
