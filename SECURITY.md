# Security

## Reporting a problem

Please do not open a public issue for a security problem. Contact the maintainers privately through GitHub (the repository owner's profile), with steps to reproduce. We aim to reply within a few days.

## What Backstop protects

- **Role ceilings.** Every route that returns claim, source or chunk text enforces the caller's role on the server. A leak harness (`backend/tests/trust/`) attacks every route with every role and tampered role values on each test run.
- **Masking.** Secrets and personal data are masked before text leaves the server.
- **Uploads.** 5 MB limit, extension allow-list, sanitised names, text-only parsing.
- **Rate limits** on upload, extraction and GitHub import.
- **Headers.** `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`.

## Known gaps

- Roles are chosen by the client; there is no sign-in. Do not put real confidential data into a public deployment.
- Rate limits are in memory and reset on restart.

Results and the list of fixed leaks are in [docs/TRUST_REPORT.md](docs/TRUST_REPORT.md).
