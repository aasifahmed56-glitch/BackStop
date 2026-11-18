"""
Shared pytest configuration — adds backend/ to sys.path so all tests can
import app.* without installing the package.
"""
import sys
import os
import tempfile

# Isolate tests from the app's real database. This must run before any
# `app.*` import, because app.db creates its engine at import time.
_TEST_DB_DIR = tempfile.mkdtemp(prefix="backstop-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(_TEST_DB_DIR, 'test.db')}"
os.environ.setdefault("LLM_PROVIDER", "none")

# Allow  `from app.xxx import ...`  in every test file.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

