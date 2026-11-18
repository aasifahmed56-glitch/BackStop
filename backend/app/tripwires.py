"""
Tripwires: warn before someone changes an area with a known history.

Plain code only, no AI. A tripwire is built from claims the reviewer can see
(and from the git history behind derived claims). When a proposed change (a
list of file paths and/or a short description) touches a tripwire's area, the
tripwire fires and says why it matched.

Tripwire kinds
  reverted_work   high    REVERTED WORK derived claims, plus related decision,
                          issue or chat claims that share a keyword (the reason).
  decision        high    approved/corrected 'decision' claims with a stated reason.
  sole_knowledge  medium  SOLE KNOWLEDGE RISK derived claims, with who to ask.
  stale_module    medium  STALE MODULE derived claims, with who to ask.
  conflict        medium  claims whose status is 'conflicting'.

Access control
  Tripwires are built per role from the claims that role may see. A claim above
  the role's ceiling is never read, so its text, quotes and keywords cannot
  reach the warning, the evidence or the matching. A tripwire whose base claim
  is above the ceiling is therefore never built for that role. Raw source text
  is never returned: evidence is the claim quote, the source file name and
  line numbers, or a commit hash and message.

Endpoints
  GET  /api/projects/{id}/tripwires?role=...
  POST /api/projects/{id}/tripwires/check   {files, diff, description, role}
  GET  /api/tripwires/replay                saved replay validation result
"""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Iterable, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db import get_session
from app.derived import _module_of, parse_commits_from_chunks
from app.models import (
    Chunk,
    Claim,
    ClaimKind,
    ClaimStatus,
    ClaimType,
    Project,
    ReviewState,
    Role,
    Source,
    SourceKind,
    role_can_see,
    strictest_access,
)

router = APIRouter(tags=["tripwires"])

REPLAY_PATH = Path(__file__).parent.parent / "data" / "trust" / "tripwire_replay.json"

SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}

MAX_FILES = 500
MAX_DIFF_CHARS = 400_000
MAX_DESCRIPTION_CHARS = 2_000

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

# Words too common to say anything about an area of the code.
_STOPWORDS = set("""
a about above after again against all also am an and any are as at be because been before being
below between both but by can could did do does doing done down during each few for from further
had has have having he her here hers him his how i if in into is it its itself just let me more
most my no nor not now of off on once only or other our out over own same she should so some such
than that the their them then there these they this those through to too under until up very was
we were what when where which while who whom why will with would you your yours
add added adding change changed changes changing code file files module modules new update updated
updates make makes made use used uses using need needs needed going go goes went get got set sets
fix fixes fixed fixing bug bugs issue issues revert reverts reverted reverting switch switched
minor small cleanup clean tidy wip tmp misc stuff thing things work works working done way one two
per see via etc yes okay ok good better best easier harder safer still already again first last
next soon later today week day days time times now then plan planned demo test tests testing
had have it's dont don't can't cannot won't isn't wasn't i'll we'll i'm we're let's should must
section endpoint component readme docs doc document documentation notes note version bump
broke broken break breaks failed fail fails failure failures rejected reject postponed postpone
load mechanism decision decided reason enough instead really quite much many lot lots
""".split())

_TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9+#]*(?:[.-][a-z0-9+#]+)*")


def _norm_token(t: str) -> str:
    t = t.lower().strip(".-")
    if len(t) > 4 and t.endswith("s") and not t.endswith("ss"):
        t = t[:-1]
    return t


def tokens(text: str, extra_stop: Iterable[str] = ()) -> set[str]:
    """Distinctive lowercase tokens (3+ chars, not stopwords), plural 's' removed."""
    stop = _STOPWORDS | {_norm_token(s) for s in extra_stop}
    out = set()
    for raw in _TOKEN_RE.findall((text or "").lower()):
        t = _norm_token(raw)
        if len(t) < 3 or t.isdigit() or t in stop or raw in stop:
            continue
        out.add(t)
    return out


def normalise_path(p: str) -> str:
    p = (p or "").strip().strip('"').replace("\\", "/")
    for prefix in ("a/", "b/", "./"):
        if p.startswith(prefix):
            p = p[len(prefix):]
    return p.lstrip("/")


def files_from_diff(diff: str) -> list[str]:
    """File paths from a unified diff ('+++ b/path' lines; '--- a/path' for deletions)."""
    files: list[str] = []
    minus: Optional[str] = None
    for line in (diff or "").splitlines():
        if line.startswith("--- "):
            minus = line[4:].split("\t")[0].strip()
        elif line.startswith("+++ "):
            plus = line[4:].split("\t")[0].strip()
            path = plus if plus != "/dev/null" else (minus or "")
            path = normalise_path(path)
            if path and path != "dev/null" and path not in files:
                files.append(path)
            minus = None
    return files


_EXPLICIT_BECAUSE = re.compile(r"\s(?:because|since|due to|as a result of)\s", re.I)
_REASON_SPLIT = re.compile(r"\s+(?:because|since|due to|as a result of)\s+|\s+[—–]\s+|\s+-\s+|(?<=[a-z0-9)])\.\s+(?=[A-Z])", re.I)


def split_reason(text: str) -> Optional[tuple[str, str]]:
    """Split 'decision — reason' / 'decision because reason' / 'Decision. Reason.'"""
    parts = _REASON_SPLIT.split(text.strip(), maxsplit=1)
    if len(parts) != 2:
        return None
    decision, reason = parts[0].strip(" .:"), parts[1].strip(" .")
    if len(decision.split()) < 2 and len(tokens(decision)) < 1:
        return None
    if len(reason.split()) < 3:
        return None
    return decision, reason


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class Tripwire:
    id: str
    kind: str
    severity: str
    title: str
    warning: str
    modules: list[str] = field(default_factory=list)     # module names (matched with module_fn)
    files: list[str] = field(default_factory=list)       # exact file paths
    keywords: list[str] = field(default_factory=list)    # normalised tokens
    evidence: list[dict] = field(default_factory=list)
    contacts: list[str] = field(default_factory=list)
    access_level: str = "public"
    claim_ids: list[int] = field(default_factory=list)

    def area(self) -> dict[str, Any]:
        return {
            "paths": [f"{m}/" if m != "root" else "top-level files" for m in self.modules] + self.files,
            "keywords": self.keywords,
        }

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["area"] = self.area()
        return d


def match_tripwire(tw: Tripwire, files: list[str], desc_tokens: set[str],
                   module_fn: Callable[[str], str] = _module_of) -> list[dict]:
    """Return the reasons a change matches a tripwire (empty list = no match)."""
    reasons: list[dict] = []
    exact = set(tw.files)
    mods = set(tw.modules)
    for f in files:
        if f in exact:
            reasons.append({"type": "path", "file": f, "matched": f,
                            "text": f"{f} is a file named in this tripwire"})
        elif module_fn(f) in mods:
            m = module_fn(f)
            label = "a top-level file" if m == "root" else f"inside {m}/"
            reasons.append({"type": "path", "file": f, "matched": m,
                            "text": f"{f} is {label}"})
    hit_words = sorted(desc_tokens & set(tw.keywords))
    if hit_words:
        reasons.append({"type": "keyword", "matched": hit_words,
                        "text": "description mentions " + ", ".join(f"'{w}'" for w in hit_words)})
    return reasons


def match_change(tripwires: list[Tripwire], files: list[str], description: str,
                 module_fn: Callable[[str], str] = _module_of) -> list[dict]:
    """Pure matcher: triggered tripwires with why, high severity first."""
    files = [normalise_path(f) for f in files if normalise_path(f)]
    desc_tokens = tokens(description)
    out = []
    for tw in tripwires:
        reasons = match_tripwire(tw, files, desc_tokens, module_fn)
        if reasons:
            out.append({**tw.to_dict(), "why": reasons,
                        "matched_by": sorted({r["type"] for r in reasons})})
    out.sort(key=lambda r: (SEVERITY_RANK.get(r["severity"], 9), -len(r["why"]), r["id"]))
    return out


# ---------------------------------------------------------------------------
# Building tripwires from claims (per role)
# ---------------------------------------------------------------------------

_REVERT_RE = re.compile(r'^REVERTED WORK — "(?P<msg>.*?)"(?: \(reverts "(?P<orig>.*?)"\))? on (?P<date>[\d-]+|None)')
_SOLE_RE = re.compile(r"^SOLE KNOWLEDGE RISK — (?P<mod>[^/:]+)/")
_STALE_RE = re.compile(r"^STALE MODULE — (?P<mod>[^/:]+)/")
_CONTACT_RE = re.compile(r"^CONTACT for (?P<mod>[^/:]+)/: ask (?P<who>[^(]+?) \(")
_OWNER_RE = re.compile(r"^(?P<who>.+?) owns (?P<mod>[^/]+)/")
_TAKES_OVER_RE = re.compile(r"^\W*(?:\[)?(?P<who>[A-Z][a-z]+)\]?:? takes over (?P<mod>[a-z][\w-]*)/?", re.I)

_REASON_TYPES = {ClaimType.decision, ClaimType.risk, ClaimType.blocker, ClaimType.open_question}


def _claim_ev(c: Claim, source_names: dict[int, str]) -> list[dict]:
    out = []
    for e in c.evidence()[:2]:
        out.append({
            "kind": "claim",
            "claim_id": c.id,
            "claim_type": c.type.value,
            "review_state": c.review_state.value,
            "access_level": c.access_level.value,
            "quote": e.get("quote", ""),
            "source_name": source_names.get(e.get("source_id"), e.get("source_name") or "unknown"),
            "line_start": e.get("line_start"),
            "line_end": e.get("line_end"),
        })
    return out or [{"kind": "claim", "claim_id": c.id, "claim_type": c.type.value,
                    "review_state": c.review_state.value, "access_level": c.access_level.value,
                    "quote": c.text, "source_name": "derived", "line_start": None, "line_end": None}]


def _commit_ev(commit: dict) -> dict:
    return {
        "kind": "commit",
        "commit": commit["hash"][:10],
        "message": commit.get("message", ""),
        "date": commit["date"].isoformat() if commit.get("date") else None,
        "files": commit.get("files", [])[:5],
    }


def _join_people(names: list[str]) -> str:
    names = list(dict.fromkeys(n for n in names if n))
    if not names:
        return ""
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]


def build_tripwires(session: Session, project_id: int, role: Role) -> dict[str, Any]:
    """Build the tripwires visible to *role*. Claims above the ceiling are never read."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found.")

    sources = session.exec(select(Source).where(Source.project_id == project_id)).all()
    source_names = {s.id: s.name for s in sources}

    all_claims = session.exec(select(Claim).where(Claim.project_id == project_id)).all()
    live = [c for c in all_claims if c.review_state != ReviewState.rejected]
    visible = [c for c in live if role_can_see(role, c.access_level)]
    hidden_count = len(live) - len(visible)

    # Git history the role may see (only used for file lists and commit evidence).
    commits: list[dict] = []
    for s in sources:
        if s.kind == SourceKind.git and role_can_see(role, s.access_level):
            commits.extend(parse_commits_from_chunks(
                session.exec(select(Chunk).where(Chunk.source_id == s.id)).all()))
    by_chunk = {c["chunk_id"]: c for c in commits}
    known_modules = sorted({_module_of(f) for c in commits for f in c["files"]} - {"root"})

    people = {project.leaver_name} | {c["author"] for c in commits}
    proj_stop = set(project.name.lower().split()) | {p.lower() for p in people}

    def toks(text: str) -> set[str]:
        return tokens(text, proj_stop)

    module_tokens = {_norm_token(m): m for m in known_modules}

    def modules_in(text: str) -> list[str]:
        found = []
        for t in toks(text) | tokens(text.replace("/", " "), proj_stop):
            if t in module_tokens and module_tokens[t] not in found:
                found.append(module_tokens[t])
        return sorted(found)

    # Who to ask, per module (from visible claims only).
    contacts: dict[str, list[str]] = {}
    owners: dict[str, str] = {}
    contact_claims: dict[str, list[Claim]] = {}
    for c in visible:
        m = _CONTACT_RE.match(c.text)
        if m:
            contacts.setdefault(m["mod"], []).append(m["who"].strip())
            contact_claims.setdefault(m["mod"], []).append(c)
            continue
        m = _OWNER_RE.match(c.text) if c.kind == ClaimKind.derived else None
        if m:
            owners[m["mod"]] = m["who"].strip()
            continue
        m = _TAKES_OVER_RE.match(c.text)
        if m and m["mod"] in known_modules:
            contacts.setdefault(m["mod"], []).insert(0, m["who"])
            contact_claims.setdefault(m["mod"], []).insert(0, c)

    def who_to_ask(mod: str) -> list[str]:
        names = list(contacts.get(mod, []))
        owner = owners.get(mod)
        if not names and owner and owner != project.leaver_name:
            names = [owner]
        return list(dict.fromkeys(names))[:3]

    tripwires: list[Tripwire] = []
    revert_related: set[int] = set()
    interpreted = [c for c in visible if c.kind in (ClaimKind.interpreted, ClaimKind.rule) and c.type in _REASON_TYPES]

    # 1. Reverted work ------------------------------------------------------
    for c in visible:
        m = _REVERT_RE.match(c.text) if c.kind == ClaimKind.derived else None
        if not m:
            continue
        revert_msg, orig_msg = m["msg"], m["orig"] or ""
        files: list[str] = []
        commit_ev: list[dict] = []
        for e in c.evidence():
            cm = by_chunk.get(e.get("chunk_id"))
            if cm:
                files += cm["files"]
                commit_ev.append(_commit_ev(cm))
        # The original commit, when its message matches.
        if orig_msg:
            for cm in commits:
                if cm["message"].strip().lower() == orig_msg.strip().lower():
                    files += cm["files"]
                    commit_ev.append(_commit_ev(cm))
                    break
        mods = sorted({_module_of(f) for f in files} - {"root"})
        base = (toks(revert_msg) | toks(orig_msg)) - set(module_tokens)
        related = [r for r in interpreted if base & toks(r.text)]
        related.sort(key=lambda r: (r.review_state not in (ReviewState.approved, ReviewState.corrected),
                                    r.type != ClaimType.decision, r.id))
        counts: dict[str, int] = {}
        for r in related:
            for t in toks(r.text) - set(module_tokens):
                counts[t] = counts.get(t, 0) + 1
        expanded = {t for t, n in counts.items() if n >= 2}
        keywords = sorted(base | expanded | {_norm_token(x) for x in mods})
        reason_claim = next((r for r in related if split_reason(r.text) or
                             re.search(r"\b(broke|broken|failed|fails|drops?|crash)", r.text, re.I)), None)
        reason = f' Recorded reason: "{reason_claim.text}"' if reason_claim else \
            " No recorded reason was found; ask before redoing it."
        if reason_claim and reason_claim.review_state not in (ReviewState.approved, ReviewState.corrected):
            reason += " (this reason is not reviewed yet)"
        when = m["date"] if m["date"] != "None" else "an unknown date"
        ask = _join_people([p for mod in mods for p in who_to_ask(mod)])
        used = [c] + related[:3]
        revert_related.update(r.id for r in related)
        tripwires.append(Tripwire(
            id=f"reverted-{c.id}",
            kind="reverted_work",
            severity="high",
            title=f"Reverted work: {revert_msg}",
            warning=f'This area had work reverted on {when}: "{revert_msg}".{reason}'
                    + (f" Ask {ask}." if ask else ""),
            modules=mods,
            files=sorted(set(files)),
            keywords=keywords,
            evidence=commit_ev + [e for r in used for e in _claim_ev(r, source_names)],
            contacts=[p for mod in mods for p in who_to_ask(mod)],
            access_level=strictest_access([x.access_level for x in used]).value,
            claim_ids=[x.id for x in used],
        ))

    # 2. Decisions with a stated reason ------------------------------------------
    # A keyword links a decision to a module when the visible git history mentions
    # it in commit messages of at most two modules (e.g. 'jwt' -> auth/).
    kw_modules: dict[str, set[str]] = {}
    for cm in commits:
        cmods = {_module_of(f) for f in cm["files"]} - {"root"}
        for t in toks(cm["message"]):
            kw_modules.setdefault(t, set()).update(cmods)

    already_used = {cid for t in tripwires for cid in t.claim_ids} | revert_related
    decisions = []
    for c in visible:
        if c.type != ClaimType.decision or c.status == ClaimStatus.conflicting:
            continue
        if c.review_state not in (ReviewState.approved, ReviewState.corrected):
            continue
        if c.id in already_used:
            continue  # already the recorded reason of a reverted-work tripwire
        sr = split_reason(c.text)
        if not sr:
            continue
        kw = (toks(sr[0]) or toks(c.text)) - set(module_tokens)
        mods = set(modules_in(c.text))
        for t in kw:
            if 0 < len(kw_modules.get(t, ())) <= 2:
                mods |= kw_modules[t]
        if not kw and not mods:
            continue
        decisions.append((c, sr, kw, mods))

    # Decisions that share a keyword describe the same choice: group them.
    parent = list(range(len(decisions)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(decisions)):
        for j in range(i + 1, len(decisions)):
            if decisions[i][2] & decisions[j][2]:
                parent[find(j)] = find(i)
    groups: dict[int, list] = {}
    for i, d in enumerate(decisions):
        groups.setdefault(find(i), []).append(d)

    for members in groups.values():
        members.sort(key=lambda d: (not _EXPLICIT_BECAUSE.search(d[0].text), d[0].id))
        c, (decision, reason), _, _ = members[0]
        mods = sorted(set().union(*(d[3] for d in members)))
        kw = set().union(*(d[2] for d in members))
        keywords = sorted(kw | {_norm_token(x) for x in mods})
        if _EXPLICIT_BECAUSE.search(c.text):
            warning = f"This changes a recorded decision: {decision} because {reason}."
        else:
            warning = f'This changes a recorded decision: "{c.text.strip()}"'
        if len(members) > 1:
            warning += f" {len(members) - 1} more source(s) record the same decision."
        ask_list = list(dict.fromkeys(p for mod in mods for p in who_to_ask(mod)))
        if ask_list:
            warning += f" Ask {_join_people(ask_list)}."
        used = [d[0] for d in members]
        tripwires.append(Tripwire(
            id="decision-" + "-".join(str(x.id) for x in used),
            kind="decision",
            severity="high",
            title=f"Recorded decision: {decision}",
            warning=warning,
            modules=mods,
            keywords=keywords,
            evidence=[e for x in used for e in _claim_ev(x, source_names)],
            contacts=ask_list,
            access_level=strictest_access([x.access_level for x in used]).value,
            claim_ids=[x.id for x in used],
        ))

    # 3. Sole knowledge and stale modules ------------------------------------------
    for c in visible:
        if c.kind != ClaimKind.derived:
            continue
        sole, stale = _SOLE_RE.match(c.text), _STALE_RE.match(c.text)
        if not (sole or stale):
            continue
        mod = (sole or stale)["mod"]
        ask_list = who_to_ask(mod)
        ask = _join_people(ask_list)
        cc = contact_claims.get(mod, [])[:2]
        if sole:
            kind, title = "sole_knowledge", f"Sole knowledge: {mod}/"
            warning = (f"{mod}/ was known mainly by {project.leaver_name}, who has left. "
                       f"{c.text.split(': ', 1)[-1]} ")
        else:
            kind, title = "stale_module", f"Stale module: {mod}/"
            rest = c.text.split(": ", 1)[-1]
            warning = f"{mod}/ has not been touched for a while: {rest[:1].lower() + rest[1:]} "
        warning += f"Ask {ask} before changing it." if ask else "Nobody else is recorded as knowing it."
        used = [c] + cc
        tripwires.append(Tripwire(
            id=f"{kind}-{c.id}",
            kind=kind,
            severity="medium",
            title=title,
            warning=warning,
            modules=[mod],
            keywords=[_norm_token(mod)],
            evidence=[e for r in used for e in _claim_ev(r, source_names)],
            contacts=ask_list,
            access_level=strictest_access([x.access_level for x in used]).value,
            claim_ids=[x.id for x in used],
        ))

    # 4. Conflicts ----------------------------------------------------------------
    for c in visible:
        if c.status != ClaimStatus.conflicting:
            continue
        topic = c.text.split(":", 1)[0].replace("CONFLICT —", "").strip()
        mods = modules_in(c.text)
        keywords = sorted(toks(topic) | {_norm_token(x) for x in mods})
        if not keywords:
            continue
        ask_list = [p for mod in mods for p in who_to_ask(mod)]
        tripwires.append(Tripwire(
            id=f"conflict-{c.id}",
            kind="conflict",
            severity="medium",
            title=f"Unresolved: {topic}",
            warning=f"Unresolved: two sources disagree. {c.text}"
                    + (f" Ask {_join_people(ask_list)}." if ask_list else ""),
            modules=mods,
            keywords=keywords,
            evidence=_claim_ev(c, source_names),
            contacts=ask_list,
            access_level=c.access_level.value,
            claim_ids=[c.id],
        ))

    pending_decisions = sum(
        1 for c in visible
        if c.type == ClaimType.decision and c.review_state == ReviewState.pending and split_reason(c.text))
    return {
        "project_id": project_id,
        "role": role.value,
        "tripwires": tripwires,
        "claims_withheld": hidden_count,
        "decisions_waiting_for_review": pending_decisions,
        "known_modules": known_modules,
    }


def check_change(session: Session, project_id: int, files: list[str], description: str,
                 role: Role) -> dict[str, Any]:
    built = build_tripwires(session, project_id, role)
    files = [normalise_path(f) for f in files if normalise_path(f)]
    triggered = match_change(built["tripwires"], files, description)
    return {
        "project_id": project_id,
        "role": role.value,
        "files": files,
        # The description is not echoed back: the caller already has it, and
        # repeating free text lets restricted words ride out in a response.
        "tripwires_checked": len(built["tripwires"]),
        "triggered": triggered,
        "claims_withheld": built["claims_withheld"],
        "decisions_waiting_for_review": built["decisions_waiting_for_review"],
        "note": "No tripwires matched. This does not mean the change is safe." if not triggered else None,
    }


# ---------------------------------------------------------------------------
# Building tripwires from git history alone (used by the replay validation)
# ---------------------------------------------------------------------------

_REVERT_MSG_RE = re.compile(r'^revert\b[:\s]*"?(?P<orig>.*?)"?\s*(?:this reverts commit (?P<hash>[0-9a-f]{7,40}).*)?$',
                            re.I | re.S)


def build_git_tripwires(commits: list[dict], leaver: str, cutoff,
                        module_fn: Callable[[str], str] = _module_of,
                        stale_days: int = 30) -> list[Tripwire]:
    """Tripwires from commits on or before *cutoff* only (no claims, no AI)."""
    from app.derived import compute_ownership, compute_sole_knowledge, compute_stale_modules

    pre = [c for c in commits if c.get("date") and c["date"] <= cutoff]
    people = {leaver} | {c["author"] for c in pre}
    stop = {p.lower() for p in people}
    by_hash = {c["hash"]: c for c in pre}
    by_msg = {c["message"].strip().lower(): c for c in pre}

    own = compute_ownership(pre, leaver, cutoff, module_fn=module_fn)
    by_mod = {o["module"]: o for o in own}

    def ask(mod: str) -> list[str]:
        o = by_mod.get(mod)
        if not o:
            return []
        ranked = sorted(((n, a) for a, n in o["authors"].items() if a != leaver), reverse=True)
        return [a for _, a in ranked[:2]]

    out: list[Tripwire] = []
    for c in pre:
        m = _REVERT_MSG_RE.match(c["message"].strip())
        if not m or not c["message"].lower().startswith("revert"):
            continue
        orig_msg = (m["orig"] or "").strip()
        orig = None
        if m["hash"]:
            orig = next((v for h, v in by_hash.items() if h.startswith(m["hash"])), None)
        orig = orig or by_msg.get(orig_msg.lower())
        files = list(c["files"]) + (orig["files"] if orig else [])
        mods = sorted({module_fn(f) for f in files})
        kw = tokens(orig_msg or c["message"], stop) - {_norm_token(x) for x in mods}
        out.append(Tripwire(
            id=f"reverted-{c['hash'][:10]}", kind="reverted_work", severity="high",
            title=f"Reverted work: {c['message'][:80]}",
            warning=f"Work was reverted on {c['date']}: {c['message'][:120]}",
            modules=[], files=sorted(set(files)), keywords=sorted(kw),
            evidence=[_commit_ev(c)] + ([_commit_ev(orig)] if orig else []),
            contacts=[p for mod in mods for p in ask(mod)][:3],
        ))
    for s in compute_sole_knowledge(own, leaver):
        out.append(Tripwire(
            id=f"sole_knowledge-{s['module']}", kind="sole_knowledge", severity="medium",
            title=f"Sole knowledge: {s['module']}/",
            warning=f"{s['module']}/: {leaver} wrote {s['leaver_share']:.0%} of commits.",
            modules=[s["module"]], keywords=[], contacts=ask(s["module"]),
        ))
    for s in compute_stale_modules(pre, cutoff, stale_days, module_fn=module_fn):
        out.append(Tripwire(
            id=f"stale_module-{s['module']}", kind="stale_module", severity="medium",
            title=f"Stale module: {s['module']}/",
            warning=f"{s['module']}/: last commit {s['last_commit_date']}.",
            modules=[s["module"]], keywords=[], contacts=ask(s["module"]),
        ))
    return out


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

class CheckRequest(BaseModel):
    files: list[str] = Field(default_factory=list)
    diff: Optional[str] = None
    description: str = ""
    role: Role = Role.incoming_dev


@router.get("/projects/{project_id}/tripwires", summary="List tripwires visible to a role")
def list_tripwires(project_id: int, role: Role = Query(Role.incoming_dev),
                   session: Session = Depends(get_session)):
    built = build_tripwires(session, project_id, role)
    tws = built["tripwires"]
    tws.sort(key=lambda t: (SEVERITY_RANK.get(t.severity, 9), t.id))
    return {**built, "tripwires": [t.to_dict() for t in tws], "count": len(tws)}


@router.post("/projects/{project_id}/tripwires/check", summary="Check a proposed change against tripwires")
def check_tripwires(project_id: int, req: CheckRequest, session: Session = Depends(get_session)):
    if req.diff and len(req.diff) > MAX_DIFF_CHARS:
        raise HTTPException(413, f"The diff is too large. Paste at most {MAX_DIFF_CHARS // 1000} KB, or list the file paths instead.")
    if len(req.description) > MAX_DESCRIPTION_CHARS:
        raise HTTPException(422, f"The description is too long. Keep it under {MAX_DESCRIPTION_CHARS} characters.")
    files = list(req.files) + files_from_diff(req.diff or "")
    files = list(dict.fromkeys(normalise_path(f) for f in files if normalise_path(f)))
    if len(files) > MAX_FILES:
        raise HTTPException(422, f"Too many files ({len(files)}). Check at most {MAX_FILES} at a time.")
    if not files and not req.description.strip():
        raise HTTPException(422, "Enter at least one file path, a diff, or a description of the change.")
    return check_change(session, project_id, files, req.description, req.role)


@router.get("/tripwires/replay", summary="Saved replay validation of tripwires")
def get_replay():
    if not REPLAY_PATH.exists():
        raise HTTPException(404, "No replay result has been saved yet. Run backend/scripts/replay_tripwires.py.")
    return json.loads(REPLAY_PATH.read_text(encoding="utf-8"))
