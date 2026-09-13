"""Database configuration and a temporary SQLAlchemy persistence adapter."""
from __future__ import annotations

import os
from copy import deepcopy

from sqlalchemy import JSON, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column


class Base(DeclarativeBase): pass


class TasklaneState(Base):
    __tablename__ = "tasklane_state"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


def database_url() -> str:
    return os.getenv("DATABASE_URL", "sqlite:///./tasklane.db")


class DatabaseRepository:
    def __init__(self, seed):
        connect = {"check_same_thread": False} if database_url().startswith("sqlite") else {}
        self.engine = create_engine(database_url(), connect_args=connect)
        with Session(self.engine) as session:
            state = session.scalar(select(TasklaneState).where(TasklaneState.id == "default"))
        if state:
            self.__dict__.update(deepcopy(state.value))
        else:
            self.__dict__.update(deepcopy(seed.__dict__))
        self.action_keys = {(action["project_id"], action["idempotency_key"]): action["id"] for action in self.actions.values()}

    def save(self):
        state = {key: value for key, value in self.__dict__.items() if key not in {"engine", "action_keys"}}
        with Session(self.engine) as session:
            row = session.get(TasklaneState, "default")
            if row: row.value = deepcopy(state)
            else: session.add(TasklaneState(id="default", value=deepcopy(state)))
            session.commit()

    def __getattr__(self, name):
        # Retain the existing API repository surface while persistence migrates.
        from .repository import MockRepository
        member = getattr(MockRepository, name)
        return member.__get__(self, type(self))
