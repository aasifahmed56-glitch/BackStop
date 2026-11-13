"""
Shared pytest configuration — adds backend/ to sys.path so all tests can
import app.* without installing the package.
"""
import sys
import os

# Allow  `from app.xxx import ...`  in every test file.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

