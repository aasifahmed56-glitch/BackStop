"""
Export a public, permissively licensed repository as a Backstop dataset.

Example (run from backend/):
  python scripts/export_real_project.py /path/to/mocha.git \
      --name mocha --departure-date 2014-05-16 --leaver "TJ Holowaychuk" \
      --alias "TJ Holowaychuk,visionmedia" \
      --repo-url https://github.com/mochajs/mocha --licence MIT \
      --evidence https://medium.com/@tjholowaychuk/farewell-node-js-4ba9e7f3e52b \
      --until 2015-05-16

Writes backend/data/real/<name>/: git_log.txt, manifest.json, metadata.json, LICENSE_NOTICE.md.
The leaver and alias names are used only to group commits; they are never written.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.realdata import export_dataset  # noqa: E402

REAL_DIR = Path(__file__).resolve().parents[1] / "data" / "real"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("repo", type=Path, help="Local clone (bare is fine)")
    p.add_argument("--name", required=True)
    p.add_argument("--departure-date", required=True, type=date.fromisoformat)
    p.add_argument("--leaver", required=True, help="Leaver's author name as it appears in git")
    p.add_argument("--alias", action="append", default=[], help="Comma-separated names of one person")
    p.add_argument("--repo-url", required=True)
    p.add_argument("--licence", required=True)
    p.add_argument("--evidence", default="")
    p.add_argument("--until", type=date.fromisoformat, default=None, help="Ignore commits after this date")
    p.add_argument("--out", type=Path, default=None)
    a = p.parse_args(argv)

    if not a.repo_url.startswith("https://github.com/"):
        p.error("--repo-url must be a public https://github.com/ URL")
    out = a.out or REAL_DIR / a.name
    meta = export_dataset(
        a.repo, out, name=a.name, departure_date=a.departure_date, leaver=a.leaver,
        repo_url=a.repo_url, licence=a.licence, evidence_url=a.evidence,
        aliases=[s.split(",") for s in a.alias], until=a.until, timeout=300,
    )
    print(f"Wrote {out}: {meta['commit_count']} commits, {meta['contributor_count']} contributors, "
          f"leaver = {meta['leaver']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
