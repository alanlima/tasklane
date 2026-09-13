from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config


@pytest.fixture(autouse=True)
def isolated_database(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Run every API test against a freshly migrated SQLite database."""
    database_url = f"sqlite:///{tmp_path / 'tasklane-test.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    from app import main
    from app.database import DatabaseRepository
    from app.label_service import LabelService
    from app.repository import MockRepository
    main.repository = DatabaseRepository(MockRepository())
    main.label_service = LabelService(main.repository)
    yield
