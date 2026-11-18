# Contributing

## Set up

Follow [Run it locally](README.md#3-run-it-locally). Keep `LLM_PROVIDER=none` unless you are working on the extractor.

## Workflow

1. Branch from `main`: `feature/<short-name>` or `fix/<short-name>`.
2. Commit under your own name, in small steps, with messages that say what changed and why.
3. Before pushing, run:
   ```bash
   cd backend && python -m pytest -q
   cd ../frontend && npm run lint && npm run build
   ```
4. Open a pull request using the template. CI must pass before merging.

## Rules the code must keep

- **Plain code for numbers.** Ownership, risk and readiness never come from a model.
- **Quotes are exact.** An interpreted claim without an exact substring quote is never shown as verified.
- **Fail closed.** If a check cannot run, the claim is not verified.
- **Role ceilings on the server.** Any new route that returns claim, source or chunk text must take a role and enforce it. The leak harness picks up new routes automatically; it must stay at zero leaks.
- **Works offline.** Every feature must work with `LLM_PROVIDER=none`. Save any model output a feature needs to a committed file.
- **Public or synthetic data only.** Pseudonymise contributors and strip emails from any real history.
- **No secrets in the repository.** Use environment variables.

## Adding a test

Put backend tests in `backend/tests/` (trust and leak tests in `backend/tests/trust/`). `conftest.py` points the suite at a temporary database and sets `LLM_PROVIDER=none`, so tests never touch your local data. For API tests, follow the `client` fixture pattern in `test_api_pipeline.py` (a `TestClient` over `app.main.app`).
