"""
Test to verify that no hardcoded demo content, fake claims, or banned strings
appear in the frontend/src directory.
"""
from pathlib import Path
import re
import pytest

BANNED_LITERALS = [
    "Stripe",
    "MongoDB",
    "JSONB",
    "SSL certificate",
    "INC-8492",
    "114 minutes",
    "MERKLE",
    "GPG",
    "SHA256",
    "HASH:",
    "RFC-094",
    "Worker #1",
    "python_ast_evaluator",
    "Staff Software Engineer",
    "gh/campus-events",
    "3 human verifiers",
    "sealed",
    "immutable",
    "38 secrets",
    "outperforms",
    "cryptographic",
    "100% deterministic",
    "System Admin",
]

BANNED_REGEXES = [
    r"\bAST\b",
    r"\bZero\b",
    # Timestamp log patterns e.g. 10:42:01.012
    r"\b\d{2}:\d{2}:\d{2}\.\d{3}\b",
]


def test_no_banned_strings_in_frontend():
    frontend_src = Path(__file__).parent.parent.parent / "frontend" / "src"
    assert frontend_src.exists(), f"Frontend src directory not found at {frontend_src}"

    violations = []

    for file_path in frontend_src.rglob("*"):
        if file_path.suffix not in {".js", ".jsx", ".ts", ".tsx", ".html", ".css"}:
            continue

        text = file_path.read_text(encoding="utf-8")
        lines = text.splitlines()

        for line_num, line in enumerate(lines, start=1):
            for banned in BANNED_LITERALS:
                if banned.lower() in line.lower():
                    violations.append(
                        f"{file_path.name}:{line_num} contains banned literal '{banned}': {line.strip()}"
                    )

            for pattern in BANNED_REGEXES:
                if re.search(pattern, line):
                    violations.append(
                        f"{file_path.name}:{line_num} matches banned pattern '{pattern}': {line.strip()}"
                    )

    assert not violations, "Found banned strings in frontend/src:\n" + "\n".join(violations)

