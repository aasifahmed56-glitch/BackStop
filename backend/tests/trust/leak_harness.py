"""
Leak harness: calls every API route with every simulated role (and with
unknown, empty, missing and tampered role values) and checks that no response
contains text the caller's role may not see.

What counts as a leak
  - A secret or personal contact detail from the sample (fake API key, email,
    phone) in ANY response, for ANY role. These are masked for everyone.
  - Text of a restricted claim or source (advisor note) in a response to a role
    whose ceiling is below "restricted".
  - Text of a confidential claim or source (budget note, rupee amounts) in a
    response to a role whose ceiling is below "confidential".
  - The full raw text of a multi-chunk source (Source.raw_text) or a
    "raw_text" field in any response.
  - A write (approve, edit, reject, bulk approve) that succeeds, or changes a
    claim, for a role that may not review that claim. A missing, empty or
    unknown role must get the LOWEST access, never a reviewer's.

Roles are simulated: the server trusts the role value it is sent. This harness
tests the access rules, not authentication.

Run it on its own to write the report:
    cd backend && python -m tests.trust.leak_harness            # writes data/trust/leak_report.json
    cd backend && python -m tests.trust.leak_harness --out other.json
"""
from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_REPORT = BACKEND_DIR / "data" / "trust" / "leak_report.json"

ACCESS_RANK = {"public": 0, "team": 1, "restricted": 2, "confidential": 3}

# ---------------------------------------------------------------------------
# Role variants. "ceiling" is the highest access level the variant may see.
# Anything that is not exactly a known role must be treated as the lowest.
# ---------------------------------------------------------------------------

_MISSING = object()


@dataclass(frozen=True)
class RoleVariant:
    label: str
    value: Any            # sent as-is; _MISSING means "do not send a role"
    ceiling: str
    reviewer: bool = False


ROLE_VARIANTS: list[RoleVariant] = [
    RoleVariant("incoming_dev", "incoming_dev", "team"),
    RoleVariant("incoming_pm", "incoming_pm", "team"),
    RoleVariant("lead", "lead", "restricted", reviewer=True),
    RoleVariant("admin (control)", "admin", "confidential", reviewer=True),
    RoleVariant("unknown role 'intern'", "intern", "team"),
    RoleVariant("empty role ''", "", "team"),
    RoleVariant("no role sent", _MISSING, "team"),
    RoleVariant("tampered 'LEAD'", "LEAD", "team"),
    RoleVariant("tampered 'Admin'", "Admin", "team"),
    RoleVariant("tampered ' lead' (space)", " lead", "team"),
    RoleVariant("tampered 'lead;admin'", "lead;admin", "team"),
]

# JSON-only tampering (wrong types in a request body).
BODY_TAMPER_VARIANTS: list[RoleVariant] = [
    RoleVariant("tampered role null", None, "team"),
    RoleVariant("tampered role ['admin']", ["admin"], "team"),
    RoleVariant("tampered role 3", 3, "team"),
    RoleVariant("tampered role {'value':'admin'}", {"value": "admin"}, "team"),
]


# ---------------------------------------------------------------------------
# Planted strings
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Marker:
    label: str
    text: str
    level: Optional[str]   # None = never shown to anyone


STATIC_MARKERS: list[Marker] = [
    Marker("fake API key", "sk_test_FAKE_0000000000EXAMPLE", None),
    Marker("personal email", "riya.example@example.org", None),
    Marker("personal phone", "+91 00000 00000", None),
    Marker("restricted advisor note: concern", "engagement level of one team member", "restricted"),
    Marker("restricted advisor note: check-in", "one-on-one check-in", "restricted"),
    Marker("restricted advisor note: attendance", "meeting attendance has dropped", "restricted"),
    Marker("confidential budget: hosting amount", "1,20,000", "confidential"),
    Marker("confidential budget: email amount", "18,000", "confidential"),
    Marker("confidential budget: payment amount", "24,000", "confidential"),
    Marker("confidential budget: total", "1,62,000", "confidential"),
    Marker("confidential budget: vendor", "FictionalCloud", "confidential"),
    Marker("confidential budget: vendor 2", "FictionalPay", "confidential"),
    Marker("confidential budget: renewal", "Contract renewal due", "confidential"),
]


def _visible(marker: Marker, ceiling: str) -> bool:
    if marker.level is None:
        return False
    return ACCESS_RANK[marker.level] <= ACCESS_RANK[ceiling]


# ---------------------------------------------------------------------------
# Harness
# ---------------------------------------------------------------------------

@dataclass
class Result:
    attack: str
    endpoint: str
    method: str
    url: str
    role: str
    status: int
    passed: bool
    leaked: list[str] = field(default_factory=list)
    detail: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "attack": self.attack,
            "endpoint": self.endpoint,
            "method": self.method,
            "url": self.url,
            "role": self.role,
            "status": self.status,
            "passed": self.passed,
            "leaked": self.leaked,
            "detail": self.detail,
        }


class LeakHarness:
    def __init__(self, client):
        self.client = client
        self.results: list[Result] = []
        self.markers: list[Marker] = list(STATIC_MARKERS)
        self.raw_texts: list[tuple[str, str]] = []
        self.targets: dict[str, list[int]] = {}
        self.covered: set[tuple[str, str]] = set()

    # -- setup -------------------------------------------------------------

    def setup(self) -> None:
        """Fresh sample; approve restricted and confidential claims; add an edit."""
        _clear_rate_limits()
        r = self.client.post("/api/sample/reset")
        assert r.status_code == 200, r.text
        claims = self._admin_claims()
        by_level: dict[str, list[dict]] = {}
        for c in claims:
            by_level.setdefault(c["access_level"], []).append(c)
        hi = by_level.get("restricted", []) + by_level.get("confidential", [])
        assert hi, "sample has no restricted/confidential claims to attack"
        for c in hi:
            note = "Conflict resolved by harness" if c.get("status") == "conflicting" else None
            r = self.client.post(f"/api/claims/{c['id']}/approve", json={"role": "admin", "note": note})
            assert r.status_code == 200, r.text
        # One edited restricted claim so version history holds old and new text.
        edited = by_level["restricted"][0]
        r = self.client.post(
            f"/api/claims/{edited['id']}/edit",
            json={"role": "admin", "corrected_text": edited["text"] + " Reviewed by the advisor.", "note": "harness edit"},
        )
        assert r.status_code == 200, r.text
        team = [c for c in by_level.get("team", []) if c.get("status") == "verified"][:3]
        for c in team:
            self.client.post(f"/api/claims/{c['id']}/approve", json={"role": "admin"})

        self.targets = {
            "restricted": [c["id"] for c in by_level.get("restricted", [])],
            "confidential": [c["id"] for c in by_level.get("confidential", [])],
            "team": [team[0]["id"]] if team else [],
        }
        # Dynamic markers: the full text of every restricted/confidential claim, every version.
        for c in self._admin_claims():
            if c["access_level"] in ("restricted", "confidential"):
                self.markers.append(Marker(f"{c['access_level']} claim #{c['id']} text", c["text"], c["access_level"]))
                for q in [e.get("quote") for e in c.get("evidence", [])]:
                    if q and len(q) > 12:
                        self.markers.append(Marker(f"{c['access_level']} claim #{c['id']} quote", q, c["access_level"]))
                vr = self.client.get(f"/api/claims/{c['id']}/versions", params={"role": "admin"})
                if vr.status_code == 200:
                    for v in vr.json().get("versions", []):
                        self.markers.append(Marker(f"{c['access_level']} claim #{c['id']} v{v['version']} text", v["text"], c["access_level"]))
        # Raw text of multi-chunk sources must never be returned whole.
        from sqlmodel import Session, select
        from app.db import engine
        from app.models import Chunk, Source
        with Session(engine) as s:
            for src in s.exec(select(Source)).all():
                n = len(s.exec(select(Chunk).where(Chunk.source_id == src.id)).all())
                if n > 1 and src.raw_text.strip():
                    self.raw_texts.append((src.name, src.raw_text.strip()))
        self.snapshot = self._state()

    def _has_route(self, method: str, path: str) -> bool:
        from app.main import app
        return (method, path) in api_routes(app)

    def _admin_claims(self) -> list[dict]:
        r = self.client.get("/api/claims", params={"role": "admin"})
        assert r.status_code == 200, r.text
        return r.json()

    def _state(self) -> dict[int, tuple]:
        """Review state, text and version of every claim (read straight from the database)."""
        from sqlmodel import Session, select
        from app.db import engine
        from app.models import Claim
        with Session(engine) as s:
            return {c.id: (c.review_state.value, c.text, c.current_version) for c in s.exec(select(Claim)).all()}

    # -- checks ------------------------------------------------------------

    def _scan(self, resp, ceiling: str) -> list[str]:
        try:
            body = json.dumps(resp.json(), ensure_ascii=False)
        except Exception:
            body = ""
        hay = (resp.text + "\n" + body).lower()
        leaked = []
        for m in self.markers:
            if not _visible(m, ceiling) and m.text.lower() in hay:
                leaked.append(m.label)
        for name, raw in self.raw_texts:
            if raw.lower() in hay:
                leaked.append(f"raw text of {name}")
        if '"raw_text"' in hay:
            leaked.append("raw_text field")
        return sorted(set(leaked))

    def _record(self, attack, endpoint, method, url, variant: RoleVariant, resp, extra_fail: str = "") -> None:
        self.covered.add((method, endpoint))
        leaked = self._scan(resp, variant.ceiling)
        if resp.status_code >= 500:
            extra_fail = extra_fail or f"server error {resp.status_code}"
        passed = not leaked and not extra_fail
        detail = extra_fail or ("leaked: " + ", ".join(leaked) if leaked else "no restricted text in response")
        self.results.append(Result(attack, endpoint, method, url, variant.label, resp.status_code, passed, leaked, detail))

    # -- request helpers ---------------------------------------------------

    def _get(self, path: str, variant: RoleVariant, params: Optional[dict] = None):
        p = dict(params or {})
        if variant.value is not _MISSING:
            p["role"] = variant.value
        return self.client.get(path, params=p)

    def _post(self, path: str, variant: RoleVariant, body: Optional[dict] = None, params: Optional[dict] = None):
        b = dict(body or {})
        if variant.value is not _MISSING:
            b["role"] = variant.value
        return self.client.post(path, json=b, params=params or {})

    # -- attacks -----------------------------------------------------------

    def run_reads(self) -> None:
        reads = [
            ("list claims", "/api/claims", "/api/claims", {}),
            ("list claims (project path)", "/api/projects/{project_id}/claims", "/api/projects/1/claims", {}),
            ("list claims, filter restricted states", "/api/claims", "/api/claims", {"review_state": "approved"}),
            ("claim stats", "/api/claims/stats", "/api/claims/stats", {}),
            ("handover", "/api/projects/{project_id}/handover", "/api/projects/1/handover", {}),
            ("project detail", "/api/projects/{project_id}", "/api/projects/1", {}),
            ("sample backtest", "/api/backtest/projects/{project_id}", "/api/backtest/projects/1", {}),
            ("dataset list", "/api/backtest/datasets", "/api/backtest/datasets", {}),
            ("real backtest", "/api/backtest/real/{name}", "/api/backtest/real/mocha", {}),
            ("trust report", "/api/trust/report", "/api/trust/report", {}),
            ("health", "/healthz", "/healthz", {}),
            ("OpenAPI schema", "/openapi.json", "/openapi.json", {}),
        ]
        for attack, endpoint, url, params in reads:
            for v in ROLE_VARIANTS:
                r = self._get(url, v, params)
                self._record(attack, endpoint, "GET", r.request.url.path + ("?" + r.request.url.query.decode() if r.request.url.query else ""), v, r)

        # Direct ID guessing on restricted and confidential claims.
        for level in ("restricted", "confidential", "team"):
            for cid in self.targets.get(level, []):
                for kind in ("versions", "context"):
                    endpoint = f"/api/claims/{{claim_id}}/{kind}"
                    for v in ROLE_VARIANTS:
                        r = self._get(f"/api/claims/{cid}/{kind}", v)
                        self._record(f"direct id: {level} claim {kind}", endpoint, "GET", f"/api/claims/{cid}/{kind}", v, r)

        # Sweep: context and history of EVERY claim, for the lowest, missing,
        # lead and admin roles. Secrets and contact details must be masked even
        # when the chunk a claim cites contains them.
        sweep_roles = [ROLE_VARIANTS[0], ROLE_VARIANTS[6], ROLE_VARIANTS[2], ROLE_VARIANTS[3]]
        for c in self._admin_claims():
            for kind in ("versions", "context"):
                for v in sweep_roles:
                    r = self._get(f"/api/claims/{c['id']}/{kind}", v)
                    self._record(f"sweep: every claim's {kind}", f"/api/claims/{{claim_id}}/{kind}", "GET", f"/api/claims/{c['id']}/{kind}", v, r)

        # Tripwires (only when that feature is present in this build).
        if self._has_route("GET", "/api/projects/{project_id}/tripwires"):
            for v in ROLE_VARIANTS:
                r = self._get("/api/projects/1/tripwires", v)
                self._record("tripwire list", "/api/projects/{project_id}/tripwires", "GET", "/api/projects/1/tripwires", v, r)
        if self._has_route("POST", "/api/projects/{project_id}/tripwires/check"):
            probes = [
                {"description": "Change the FictionalCloud contract hosting and vendor budget", "files": ["notes/budget-confidential.md"]},
                {"description": "Advisor performance concern engagement one-on-one check-in", "files": ["notes/advisor-private.md"]},
                {"description": "Rotate the Stripe test key in payments config", "files": ["payments/config.py"]},
            ]
            for body in probes:
                for v in ROLE_VARIANTS + BODY_TAMPER_VARIANTS:
                    r = self._post("/api/projects/1/tripwires/check", v, {**body, "diff": None})
                    self._record("check a change with restricted words", "/api/projects/{project_id}/tripwires/check", "POST", "/api/projects/1/tripwires/check", v, r)
        if self._has_route("GET", "/api/tripwires/replay"):
            for v in ROLE_VARIANTS:
                r = self._get("/api/tripwires/replay", v)
                self._record("tripwire replay", "/api/tripwires/replay", "GET", "/api/tripwires/replay", v, r)

        # Path tricks on the dataset endpoint.
        for name in ("..%2Fsample", "../sample", "sample", "..", "%2e%2e"):
            v = ROLE_VARIANTS[6]
            r = self.client.get(f"/api/backtest/real/{name}")
            self._record("path traversal on dataset name", "/api/backtest/real/{name}", "GET", f"/api/backtest/real/{name}", v, r)

        # Unknown IDs must not error.
        for kind in ("versions", "context"):
            v = ROLE_VARIANTS[0]
            r = self._get(f"/api/claims/999999/{kind}", v)
            self._record("direct id: claim that does not exist", f"/api/claims/{{claim_id}}/{kind}", "GET", f"/api/claims/999999/{kind}", v, r)

    def run_writes(self) -> None:
        """A role may only approve, edit or reject claims at or below its ceiling."""
        actions = [
            ("approve", lambda: {"note": "harness"}),
            ("reject", lambda: {"reason": "harness"}),
            ("edit", lambda: {"corrected_text": "HARNESS OVERWRITE", "note": "harness"}),
        ]
        for level in ("restricted", "confidential", "team"):
            for cid in self.targets.get(level, []):
                for action, body in actions:
                    endpoint = f"/api/claims/{{claim_id}}/{action}"
                    for v in ROLE_VARIANTS + BODY_TAMPER_VARIANTS:
                        allowed = v.reviewer and ACCESS_RANK[level] <= ACCESS_RANK[v.ceiling]
                        if allowed:
                            continue  # a permitted write is not an attack
                        before = self._state()
                        r = self._post(f"/api/claims/{cid}/{action}", v, body())
                        after = self._state()
                        fail = ""
                        if r.status_code < 400:
                            fail = f"write accepted (HTTP {r.status_code})"
                        elif after.get(cid) != before.get(cid):
                            fail = "claim changed although the request was refused"
                        self._record(f"{action} {level} claim above role ceiling", endpoint, "POST", f"/api/claims/{cid}/{action}", v, r, fail)

        for endpoint, url in (
            ("/api/claims/bulk-approve-verified", "/api/claims/bulk-approve-verified?project_id=1"),
            ("/api/projects/{project_id}/claims/bulk-approve-verified", "/api/projects/1/claims/bulk-approve-verified"),
        ):
            for v in ROLE_VARIANTS + BODY_TAMPER_VARIANTS:
                if v.reviewer:
                    continue
                before = self._state()
                r = self._post(url.split("?")[0], v, {}, params={"project_id": 1} if "?" in url else None)
                after = self._state()
                fail = ""
                if r.status_code < 400:
                    fail = f"bulk approve accepted (HTTP {r.status_code})"
                elif after != before:
                    fail = "claims changed although the request was refused"
                self._record("bulk approve without a reviewer role", endpoint, "POST", url, v, r, fail)

        for v in ROLE_VARIANTS + BODY_TAMPER_VARIANTS:
            r = self._post("/api/projects/1/acknowledge", v, {"recipient_name": "Harness"})
            self._record("acknowledge handover", "/api/projects/{project_id}/acknowledge", "POST", "/api/projects/1/acknowledge", v, r)

    def run_admin_routes(self) -> None:
        """Routes without a role parameter: their responses must not carry restricted text."""
        lowest = ROLE_VARIANTS[6]
        _clear_rate_limits()
        r = self.client.post("/api/import/github", json={"url": "https://example.com/not-github", "departure_date": "2024-01-01", "leaver": "x"})
        self._record("GitHub import with a bad URL", "/api/import/github", "POST", "/api/import/github", lowest, r)
        r = self.client.post(
            "/api/projects/1/upload",
            files={"file": ("probe.txt", b"harness probe text", "text/plain")},
            data={"access_level": "confidential"},
        )
        self._record("upload response", "/api/projects/{project_id}/upload", "POST", "/api/projects/1/upload", lowest, r)
        r = self.client.post("/api/claims/recompute-access")
        self._record("recompute access", "/api/claims/recompute-access", "POST", "/api/claims/recompute-access", lowest, r)
        r = self.client.post("/api/projects/1/derive")
        self._record("re-run derivation", "/api/projects/{project_id}/derive", "POST", "/api/projects/1/derive", lowest, r)
        r = self.client.post("/api/projects/1/extract")
        self._record("re-run extraction", "/api/projects/{project_id}/extract", "POST", "/api/projects/1/extract", lowest, r)
        r = self.client.post("/api/sample/load")
        self._record("load sample", "/api/sample/load", "POST", "/api/sample/load", lowest, r)
        r = self.client.post("/api/sample/reset")
        self._record("reset sample", "/api/sample/reset", "POST", "/api/sample/reset", lowest, r)

    def run(self) -> dict[str, Any]:
        self.setup()
        self.run_reads()
        self.run_writes()
        self.run_admin_routes()
        return self.report()

    # -- report ------------------------------------------------------------

    def report(self) -> dict[str, Any]:
        failed = [r for r in self.results if not r.passed]
        by_endpoint: dict[str, dict[str, int]] = {}
        for r in self.results:
            key = f"{r.method} {r.endpoint}"
            e = by_endpoint.setdefault(key, {"run": 0, "blocked": 0, "leaked": 0})
            e["run"] += 1
            e["blocked" if r.passed else "leaked"] += 1
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "llm_provider": os.getenv("LLM_PROVIDER", "none"),
            "note": "Roles are simulated: the server trusts the role value it is sent. "
                    "These are tested cases of the access rules, not a test of authentication.",
            "summary": {
                "attacks_run": len(self.results),
                "blocked": len(self.results) - len(failed),
                "leaked": len(failed),
                "endpoints_covered": len(by_endpoint),
                "role_variants": [v.label for v in ROLE_VARIANTS + BODY_TAMPER_VARIANTS],
                "markers_checked": len(self.markers) + len(self.raw_texts),
            },
            "by_endpoint": by_endpoint,
            "failures": [r.as_dict() for r in failed],
            "results": [r.as_dict() for r in self.results],
        }


def api_routes(app) -> set[tuple[str, str]]:
    """Every (method, path) the FastAPI app serves, except the SPA catch-all and static mounts."""
    out = set()
    for route in app.routes:
        methods = getattr(route, "methods", None)
        if not methods:
            continue
        if route.path in ("/{full_path:path}", "/docs", "/docs/oauth2-redirect", "/redoc"):
            continue
        for m in methods:
            if m in ("HEAD", "OPTIONS"):
                continue
            out.add((m, route.path))
    return out


def _clear_rate_limits() -> None:
    from app import main
    main._rate_limits.clear()


def print_summary(rep: dict[str, Any]) -> None:
    s = rep["summary"]
    print(f"Leak harness: {s['attacks_run']} attacks run, {s['blocked']} blocked, {s['leaked']} leaked "
          f"across {s['endpoints_covered']} endpoints.")
    seen = set()
    for f in rep["failures"]:
        key = (f["method"], f["endpoint"], f["attack"])
        if key in seen:
            continue
        seen.add(key)
        n = sum(1 for g in rep["failures"] if (g["method"], g["endpoint"], g["attack"]) == key)
        print(f"  LEAK  {f['method']} {f['endpoint']}  [{f['attack']}]  x{n}: {f['detail']}")


def main(argv: list[str]) -> int:
    import tempfile
    out = DEFAULT_REPORT
    if "--out" in argv:
        out = Path(argv[argv.index("--out") + 1]).resolve()
    tmp = tempfile.mkdtemp(prefix="backstop-leak-")
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp}/leak.db"
    os.environ.setdefault("LLM_PROVIDER", "none")
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))
    import logging
    logging.disable(logging.WARNING)
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        h = LeakHarness(client)
        rep = h.run()
        rep["routes_not_attacked"] = sorted(f"{m} {p}" for m, p in api_routes(app) - h.covered)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(rep, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print_summary(rep)
    if rep["routes_not_attacked"]:
        print("  Routes not attacked:", ", ".join(rep["routes_not_attacked"]))
    print(f"Report written to {out}")
    return 1 if rep["summary"]["leaked"] else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
