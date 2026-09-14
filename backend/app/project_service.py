from __future__ import annotations

from .repository import now


class ProjectArchivedError(Exception):
    pass


class ArchiveConfirmationRequiredError(Exception):
    def __init__(self, summary: dict) -> None:
        self.summary = summary


class PendingProjectActionsError(Exception):
    pass


class DeleteConfirmationError(Exception):
    pass


class ProjectService:
    """Project lifecycle rules kept outside HTTP route handlers."""

    def __init__(self, repository, recover_actions) -> None:
        self.repository = repository
        self.recover_actions = recover_actions

    def archive_summary(self, project_id: str) -> dict:
        tasks = self.repository.project_tasks(project_id)
        columns = self.repository.project_columns(project_id)
        done = columns[-1]["id"] if columns else None
        completed = sum(task["column_id"] == done for task in tasks)
        return {"total_tasks": len(tasks), "completed_tasks": completed, "incomplete_tasks": len(tasks) - completed}

    def ensure_writable(self, project_id: str) -> None:
        if self.repository.projects[project_id].get("is_archived", False):
            raise ProjectArchivedError("Archived projects are read-only. Restore the project to make changes.")

    def archive(self, project_id: str, confirm_incomplete: bool) -> dict:
        self.recover_actions()
        if any(action["project_id"] == project_id and (
            action["status"] in {"PENDING", "PROCESSING"}
            or (action["status"] == "FAILED" and action["attempt_count"] < 5)
        ) for action in self.repository.actions.values()):
            raise PendingProjectActionsError("Board moves are still pending. Wait for them to finish before archiving.")
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
        for action_id, action in list(self.repository.actions.items()):
            if action["project_id"] == project_id:
                del self.repository.actions[action_id]
        self.repository.action_keys = {(action["project_id"], action["idempotency_key"]): action["id"] for action in self.repository.actions.values()}
        del self.repository.projects[project_id]
