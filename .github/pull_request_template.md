## What changed

<!-- One or two sentences. -->

## Why

## How it was checked

- [ ] `cd backend && python -m pytest -q` passes
- [ ] `npm --prefix frontend run lint && npm --prefix frontend run build` pass
- [ ] Works with `LLM_PROVIDER=none`
- [ ] Any new route that returns text enforces the caller's role (leak harness still at 0)
- [ ] Docs updated if behaviour changed

## Screenshots

<!-- For UI changes. -->
