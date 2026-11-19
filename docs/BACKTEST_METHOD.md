# Backtest method

Backstop ranks the modules where knowledge is most at risk when a person leaves. The backtest asks: if Backstop had been run on the day the person left, would its top-ranked modules be the ones that actually caused trouble afterwards?

These rules were written down before the real-project results were computed and have not been tuned since. If a result is unfavourable, it is reported as it is.

## Datasets

| Dataset | What it is | Ground truth |
|---|---|---|
| Synthetic sample | A generated student project (`backend/data/sample`) | Hand-written in `ground_truth.json` |
| mocha (real) | Public commit history of [mochajs/mocha](https://github.com/mochajs/mocha), MIT licence, exported with `backend/scripts/export_real_project.py` | Computed from post-departure commits with the rules below |

### Why mocha

The original author made about 1,100 of the first ~1,300 commits, made his last commit on **16 May 2014**, and announced on 4 July 2014 that he was stepping away and looking for maintainers ([Farewell Node.js](https://medium.com/@tjholowaychuk/farewell-node-js-4ba9e7f3e52b)). Several other people carried the project on. Contributors are pseudonymised in the dataset; the leaver is "Contributor A".

The cutoff is the date of the leaver's last commit, not the announcement, so the ranking cannot see any of his later activity.

## Rules for real datasets

**Module.** The top-level directory of a file. Because most of mocha's code lives under `lib/` and `test/`, those two directories (and `src/` if present) are split one level deeper: `lib/reporters/spec.js` belongs to `lib/reporters`, `lib/runner.js` belongs to `lib`. Files at the repository root belong to `root`.

**Ranking (pre-cutoff only).** Only commits dated on or before the cutoff are given to the ranking, and only modules the leaver had committed to are ranked. Three rankings are compared:

1. **Backstop**: the knowledge-at-risk score already used in the product: leaver share × (1 + staleness) ÷ number of other contributors.
2. **Baseline A, commit count**: modules ordered by the leaver's raw commit count.
3. **Baseline B, commit share**: modules ordered by the leaver's share of the module's commits.

Ties are broken by total commits, then module name.

**Added later: candidate score v2.** After the first mocha result (Backstop 0 of 5 in the top 5), a fourth ranking was added: leaver share × √(leaver commits), with the same tie rule. It drops the division by other contributors, which pushed small single-owner folders to the top. Because it was chosen after seeing mocha, its mocha numbers are in-sample and do not count as evidence. The rules above, the ground truth and the control dates were not changed. v2 is not used for claims in the product until it holds on a second departure.

**Ground truth (post-cutoff only).** A module is a *positive* (it caused trouble after the handover) when, within **180 days** after the cutoff, both of these are true:

- at least **2 commits** to it were made by authors who had **zero commits to that module before the cutoff** (someone new had to pick it up), and
- at least **1 commit** to it has a message matching `revert`, `fix`, `fixes`, `fixed` or `bug` (whole word, any case).

**Metrics.** Precision@k and recall@k for k = 1 to 5, the number of positives, and the precision a random ordering would get on average (positives ÷ modules).

**Control cutoffs.** The same procedure is repeated at 12, 18 and 24 months before the real cutoff, when the leaver was still active. If Backstop only beats the baselines at the real departure, that supports the method; if it does just as well at the controls, the ranking is mostly measuring "busy modules", and we say so.

## Guarantees checked by tests

- The ranking function is given only pre-cutoff commits, and a test proves that changing or deleting every post-cutoff commit leaves the ranking identical.
- Precision and recall are checked on a hand-made example.

## Limitations

- One real project, one departure. This is a case study, not a statistical result.
- "Fix" and "revert" in a commit message is a rough signal for trouble. It misses trouble that was never fixed and counts routine fixes.
- Module boundaries are directories, which is coarse for small projects.
- The leaver's departure is inferred from public sources and the commit record; we do not know what happened privately.
