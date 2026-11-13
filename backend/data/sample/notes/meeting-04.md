# Meeting 04 — Payments Integration Review

**Date:** 15 Dec 2025
**Attendees:** Riya, Kabir, Dev

## Notes
- Reviewed Stripe webhook integration.
- **Action:** Remove test keys from config before go-live.
  - Current test key in config: sk_test_FAKE_0000000000EXAMPLE (THIS MUST BE REPLACED)
- Kabir to implement refund endpoint by 20 Dec.
- Riya: "idempotency keys are essential for payment retries."

## Risks
- If test key leaks to production there will be issues. Remove immediately.

## Action Items
- [Riya] Rotate Stripe keys before staging deploy.
- [Kabir] Refund endpoint by 20 Dec.
