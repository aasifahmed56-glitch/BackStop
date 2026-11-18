# Projects and records

Backstop is no longer only the sample. Anyone can start a project for a person who is leaving, add that person's records, and build claims from them. Everything here works with `LLM_PROVIDER=none` and no API key.

## The loop

1. **Projects** (`#/projects`): create a project with its name, the person leaving (as written in git) and their last day. Switch between projects from the side bar.
2. **Records** (`#/records`): paste text, choose a file, or import a public GitHub history.
   - Git history: the output of `git log --no-merges --name-status`. Emails are dropped and messages are masked before storing.
   - Notes (Markdown or text), issues (JSON), tasks (CSV) and chat (JSON). Each record gets an access level, which every claim built from it inherits.
   - GitHub import reads commits up to the last day, pseudonymises every author, and maps the person leaving to their pseudonym.
3. **Build claims**: code rules over git and tasks (ownership, sole knowledge, stale modules, reverted work, missing owners), the AI extractor where a model or cached answer exists, and keyword rules for every other record.
4. Check, debrief and hand over exactly as with the sample.

## Keyword rules (`backend/app/rules.py`)

Each sentence of a note, issue, task or chat message is matched against a short published list: blockers, decisions, warnings, dependencies, contacts, owners, next steps, and questions. A match becomes a claim of kind `rule` that quotes the sentence word for word.

- A quote that matches proves only that the record says it, so rule claims start as **Inferred** and wait for a person.
- A decision with no stated reason (no "because", "so that", "to avoid" and similar) becomes **Missing evidence** with a question asking why.
- Building again never duplicates a rule claim and never clears a decision on one. Claims from code and from the extractor are rebuilt, and the app warns before clearing their decisions.

## Routes

| Route | Who |
|---|---|
| `GET /api/projects` | anyone (names and counts only) |
| `POST /api/projects` | lead |
| `DELETE /api/projects/{id}` | lead, never the sample |
| `GET /api/projects/{id}/sources?role=` | anyone; records above the role are counted, not listed |
| `POST /api/projects/{id}/sources/paste` | lead, never the sample |
| `POST /api/projects/{id}/sources/github` | lead, never the sample; 3 imports an hour |
| `DELETE /api/projects/{id}/sources/{source_id}` | lead; also removes claims that cite only that record |
| `POST /api/projects/{id}/analyse` | lead, never the sample |

The trust leak harness attacks every one of these with every role variant (1,543 attacks, 0 leaks on this branch).

## Limits

- Roles are still simulated; there is no sign-in. Anyone who can reach the server can choose the lead role.
- Keyword rules are blunt. They find sentences that look like decisions or warnings; they cannot tell whether a sentence is still true or important. That is the reviewer's job.
- A server holds at most 200 projects and a project at most 40 records of up to 2 MB each.
