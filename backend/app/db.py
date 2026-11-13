"""
Database initialisation. Uses a file-based SQLite DB (backstop.db).
"""
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = "sqlite:///./backstop.db"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

