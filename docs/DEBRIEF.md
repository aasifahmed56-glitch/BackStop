# Debrief questions and handover readiness

Backstop finds gaps in the records: missing evidence, sources that disagree, claims that are only partly supported, and areas only one person knows. A gap is only useful while the person leaving can still answer it. The Debrief page turns each gap into a question for them, and records their answer as a claim that is checked like any other.

Everything here is plain code (`backend/app/debrief.py`). No AI is called, so it works in production with `LLM_PROVIDER=none`.

## Where questions come from

| Claim | Question | Priority |
|---|---|---|
| `SOLE KNOWLEDGE RISK` (derived) | Walk the team through the module | High |
| `MISSING OWNER` (derived) | Who should own the task, and what is it waiting on | High |
| Status *Conflicting* | Which record is current | High |
| Status *Missing evidence* | Fill the gap | High |
| Status *Inferred* | Is it right, and where is it written down | Medium |
| `REVERTED WORK` (derived) | Why was it undone; should anyone try again | Medium |
| Type *open question* | What is the answer, or who knows | Medium |
| Unreviewed *blocker* | What is the next step | Medium |
| `STALE MODULE` (derived) | Is it still in use; who looks after it | Low |

Rejected claims ask nothing, since a reviewer already decided they are wrong. A question is listed only if the caller's role may see its claim. Questions from claims above the role's access are counted (`withheld_count`) and their text never leaves the server.

## Recording an answer

`POST /api/projects/{id}/debrief/answer {role, question_claim_id, answer}`

- Only the `lead` role may record answers. Every other role, a missing role or a tampered role gets 403.
- The answer is stored as a new source (`debrief/claim-<id>.md`) and a new claim of kind `debrief`. Its quote is the answer word for word.
- The new claim starts as **Not checked**. It reaches a handover only after a person approves it.
- Its access level is the stricter of the question's level and `team`, so an answer can never be less protected than its question.

## Readiness score

A weighted checklist, shown with every part's numbers so it can be checked by hand:

| Part | Weight |
|---|---|
| Claims checked by a person (approved, corrected or rejected) | 40 |
| Risks, blockers and decisions checked | 30 |
| Gaps and disagreements settled (non-verified claims decided) | 20 |
| Handover signed for by the newcomer | 10 |

An empty part counts as complete. 90 or more reads *Ready to hand over*, 50 or more *In progress*, anything lower *Not ready yet*. It is a progress measure, not a prediction of how the handover will go.

## Tests

`backend/tests/test_debrief.py` covers the question rules, the readiness maths, role filtering against the planted restricted and confidential strings, and the answer loop (refused for non-leads and blank answers; a saved answer is pending, quotes itself and is absent from the handover until approved). The trust leak harness attacks both new routes with every role variant.

## Limits

- The question wording comes from fixed templates. It reads plainly but cannot adapt to the person the way an interviewer would.
- The lead types the answer, so the quote is only as faithful as their notes.
- Roles are simulated, as everywhere in Backstop.
