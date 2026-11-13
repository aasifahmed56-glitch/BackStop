# Meeting 10 — Riya's Last Day Handover

**Date:** 14 Mar 2026
**Attendees:** Riya, Dev, Sara, Kabir, Meena

## Final Handover Notes from Riya

### Auth
- JWT is the auth mechanism. Sessions were rejected due to load failures in the Oct demo.
- Sara knows the codebase well — she reviewed all PRs.
- Remaining: GDPR deletion endpoint (hand to Meena).

### Payments
- Stripe v2 SDK in use. Migration to v3 is planned but postponed.
- Kabir has context on the gateway. See issue #31 for migration status.

### Deploy
- Deploy process is in deploy/. Runbook is partial — some steps are undocumented.
- Dev: please read the nginx and docker-compose configs carefully.
- Vault config is NOT documented. Ask me via email if urgent.

### Notifications
- Polling implementation is stable. No changes since late January.
- FCM push key is unresolved — nobody has console access.

### General
- Prof. Nair is the advisor. Contact via university portal.
- Run all tests before any production deploy.

## Risks Riya Flagged
- deploy/ is effectively sole knowledge.
- Payments migration has a conflict in the docs — refer to issue #31.
- Push notification setup is fully blocked.
