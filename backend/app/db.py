"""
Database initialisation. Uses a file-based SQLite DB (backstop.db).
"""
import os
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

# Absolute default path so the database location never depends on the
# working directory. Tests override DATABASE_URL with a temporary file.
_DEFAULT_DB = Path(__file__).resolve().parent.parent / "backstop.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_DEFAULT_DB}")
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

