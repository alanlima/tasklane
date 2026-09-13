from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from uuid import uuid4


def now() -> str:
    return datetime.now(UTC).isoformat()


def new_id() -> str:
    return str(uuid4())


class MockRepository:
    """In-memory persistence boundary; replace with a database-backed implementation later."""

    def __init__(self) -> None:
        self.projects: dict[str, dict] = {}
        self.columns: dict[str, dict] = {}
        self.tasks: dict[str, dict] = {}
        self.checklist: dict[str, dict] = {}
        self.labels: dict[str, dict] = {}
        self.actions: dict[str, dict] = {}
        self.action_keys: dict[tuple[str, str], str] = {}

    def copy(self, value: dict) -> dict:
        return deepcopy(value)

    def create_project(self, name: str, description: str | None) -> dict:
        timestamp = now()
        project = {"id": new_id(), "name": name, "description": description, "created_at": timestamp, "updated_at": timestamp}
        self.projects[project["id"]] = project
        for position, column_name in enumerate(("Backlog", "To Do", "In Progress", "Done")):
            self.create_column(project["id"], column_name, position)
        return self.copy(project)

    def create_column(self, project_id: str, name: str, position: int | None = None) -> dict:
        columns = self.project_columns(project_id)
        timestamp = now()
        column = {"id": new_id(), "project_id": project_id, "name": name, "position": len(columns) if position is None else position, "created_at": timestamp, "updated_at": timestamp}
        self.columns[column["id"]] = column
        return self.copy(column)

    def project_columns(self, project_id: str) -> list[dict]:
        return sorted((column for column in self.columns.values() if column["project_id"] == project_id), key=lambda column: column["position"])

    def project_tasks(self, project_id: str) -> list[dict]:
        return sorted((task for task in self.tasks.values() if task["project_id"] == project_id), key=lambda task: (task["column_id"], task["position"]))

    def task_view(self, task: dict) -> dict:
        result = self.copy(task)
        result["checklist"] = [self.copy(item) for item in sorted((item for item in self.checklist.values() if item["task_id"] == task["id"]), key=lambda item: item["position"])]
        return result

    def board(self, project_id: str) -> dict:
        project = self.projects[project_id]
        return {"project": self.copy(project), "columns": [self.copy(column) for column in self.project_columns(project_id)], "tasks": [self.task_view(task) for task in self.project_tasks(project_id)], "labels": [self.copy(label) for label in self.labels.values() if label["project_id"] == project_id]}

    def reindex_tasks(self, project_id: str, column_id: str) -> None:
        tasks = sorted((task for task in self.tasks.values() if task["project_id"] == project_id and task["column_id"] == column_id), key=lambda task: task["position"])
        for position, task in enumerate(tasks): task["position"] = position

    def reindex_columns(self, project_id: str) -> None:
        for position, column in enumerate(self.project_columns(project_id)): column["position"] = position
