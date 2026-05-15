import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_default_db = str(Path(__file__).resolve().parent / "data" / "scantron2.db")
_raw_url = os.getenv("DATABASE_URL", f"sqlite:///{_default_db}")
# Some cloud providers still emit postgres:// — SQLAlchemy 2 requires postgresql://
DATABASE_URL = (
    _raw_url.replace("postgres://", "postgresql://", 1)
    if _raw_url.startswith("postgres://")
    else _raw_url
)

if DATABASE_URL.startswith("sqlite"):
    Path(_default_db).parent.mkdir(parents=True, exist_ok=True)

_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
