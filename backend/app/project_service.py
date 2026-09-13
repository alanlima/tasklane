from __future__ import annotations

from .repository import now


class ProjectArchivedError(Exception):
    pass


class ArchiveConfirmationRequiredError(Exception):
    def __init__(self, summary: dict) -> None:
        self.summary = summary


class DeleteConfirmationError(Exception):
    pass


class ProjectService:
    """Project lifecycle rules kept outside HTTP route handlers."""

    def __init__(self, repository) -> None:
        self.repository = repository

    def archive_summary(self, project_id: str) -> dict:
        tasks = self.repository.project_tasks(project_id)
        done = next((column["id"] for column in self.repository.project_columns(project_id) if column["name"].lower() == "done"), None)
        completed = sum(task["column_id"] == done for task in tasks)
        return {"total_tasks": len(tasks), "completed_tasks": completed, "incomplete_tasks": len(tasks) - completed}

    def ensure_writable(self, project_id: str) -> None:
        if self.repository.projects[project_id].get("is_archived", False):
            raise ProjectArchivedError("Archived projects are read-only. Restore the project to make changes.")

    def archive(self, project_id: str, confirm_incomplete: bool) -> dict:
        summary = self.archive_summary(project_id)
        if summary["incomplete_tasks"] and not confirm_incomplete:
            raise ArchiveConfirmationRequiredError(summary)
        project = self.repository.projects[project_id]
        project["is_archived"] = True
        project["archived_at"] = now()
        project["updated_at"] = now()
        return self.repository.copy(project)

    def restore(self, project_id: str) -> dict:
        project = self.repository.projects[project_id]
        project["is_archived"] = False
        project["archived_at"] = None
        project["updated_at"] = now()
        return self.repository.copy(project)

    def delete(self, project_id: str, confirmation_name: str) -> None:
        project = self.repository.projects[project_id]
        if confirmation_name != project["name"]:
            raise DeleteConfirmationError("Enter the exact project name to permanently delete it.")
        task_ids = [task["id"] for task in self.repository.project_tasks(project_id)]
        for task_id in task_ids:
            for item_id, item in list(self.repository.checklist.items()):
                if item["task_id"] == task_id:
                    del self.repository.checklist[item_id]
            del self.repository.tasks[task_id]
        for store in (self.repository.columns, self.repository.labels):
            for key, value in list(store.items()):
                if value["project_id"] == project_id:
                    del store[key]
        del self.repository.projects[project_id]
