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
        self.seed_development_data()

    def seed_development_data(self) -> None:
        """Provide a useful, disposable board when running the mock backend."""
        project = self.create_project("Tasklane Development", "A sample board for exploring the Tasklane workflow.")
        columns = {column["name"]: column for column in self.project_columns(project["id"])}
        review = self.create_column(project["id"], "Review", 3)
        columns["Done"]["position"] = 4
        columns["Review"] = review
        frontend = {"id": new_id(), "project_id": project["id"], "name": "Frontend", "colour": "#6574C9", "created_at": now()}
        backend = {"id": new_id(), "project_id": project["id"], "name": "Backend", "colour": "#35685B", "created_at": now()}
        self.labels[frontend["id"]] = frontend
        self.labels[backend["id"]] = backend
        timestamp = now()
        tasks = (
            ("Define API contract", "Backlog", "HIGH", 3, [backend["id"]]),
            ("Connect React board", "In Progress", "MEDIUM", 5, [frontend["id"], backend["id"]]),
            ("Review Docker setup", "Review", "LOW", 2, [backend["id"]]),
            ("Create project dashboard", "Done", "NONE", 3, [frontend["id"]]),
        )
        for position, (title, column_name, priority, points, label_ids) in enumerate(tasks):
            column = columns[column_name]
            task = {"id": new_id(), "project_id": project["id"], "column_id": column["id"], "title": title, "description": None, "priority": priority, "story_points": points, "due_date": None, "position": sum(item["column_id"] == column["id"] for item in self.tasks.values()), "label_ids": label_ids, "created_at": timestamp, "updated_at": timestamp}
            self.tasks[task["id"]] = task
            if position == 1:
                item = {"id": new_id(), "task_id": task["id"], "title": "Call board endpoint", "is_completed": True, "position": 0, "created_at": timestamp, "updated_at": timestamp}
                self.checklist[item["id"]] = item

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
