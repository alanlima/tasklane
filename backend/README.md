# Tasklane backend

The backend is a FastAPI implementation of the contract in [`../_docs/openapi.yaml`](../_docs/openapi.yaml). It currently uses `MockRepository`, an in-memory persistence boundary designed to be replaced by a database-backed repository later.

## Commands

```bash
uv sync --dev
uv run pytest
uv run uvicorn app.main:app --reload
```

The local API documentation is available at `http://127.0.0.1:8000/docs` while the server is running.

## Current boundary

`app/main.py` contains the HTTP contract and request validation. `app/repository.py` owns the mock persistence and data projections. No database, migrations, authentication, or background worker is included in this implementation.
