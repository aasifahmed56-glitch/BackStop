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

- Everyone signs in. Team members use `/login` and admins use `/admin/login`; each page refuses the other kind of account. Passwords are stored as scrypt hashes and sessions are HttpOnly cookies.
- The server takes the role from the signed-in account and refuses any role that account may not act as.
- The demo accounts (`DEMO_ACCOUNTS=1`) share a known password. Turn them off, or set `DEMO_PASSWORD`, before putting real confidential data into a deployment.
- Rate limits are in memory and reset on restart.

Results and the list of fixed leaks are in [docs/TRUST_REPORT.md](docs/TRUST_REPORT.md).
