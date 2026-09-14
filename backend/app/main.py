from __future__ import annotations

from datetime import date
from functools import wraps
from typing import Any

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .action_lock import board_action_lock, serialized_board_action
from .repository import MockRepository, new_id, now
from .database import DatabaseRepository
from .label_service import LabelService
from .project_service import ArchiveConfirmationRequiredError, DeleteConfirmationError, PendingProjectActionsError, ProjectArchivedError, ProjectService

app = FastAPI(title="Tasklane API", version="0.1.0", openapi_url="/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
repository = DatabaseRepository(MockRepository())
label_service = LabelService(repository)
project_service = ProjectService(repository, lambda: recover_actions())

def persisted_mutation(operation):
    """Keep validation, mutation and durable save in one request boundary."""
    @wraps(operation)
    def persisted(*args, **kwargs):
        with board_action_lock:
            result = operation(*args, **kwargs)
            repository.save()
            return result
    return persisted


class ProjectCreate(BaseModel): name: str = Field(min_length=1, max_length=120); description: str | None = Field(default=None, max_length=2000)
class ProjectUpdate(BaseModel): name: str | None = Field(default=None, min_length=1, max_length=120); description: str | None = Field(default=None, max_length=2000)
class ArchiveProject(BaseModel): confirm_incomplete: bool = False
class DeleteProject(BaseModel): confirmation_name: str = Field(min_length=1, max_length=120)
class Named(BaseModel): name: str = Field(min_length=1, max_length=80)
class TaskCreate(BaseModel): column_id: str; title: str = Field(min_length=1, max_length=240); description: str | None = None; priority: str = "NONE"; story_points: int | None = Field(default=None, ge=0); due_date: date | None = None; label_ids: list[str] = []
class TaskUpdate(BaseModel): title: str | None = Field(default=None, min_length=1, max_length=240); description: str | None = None; priority: str | None = None; story_points: int | None = Field(default=None, ge=0); due_date: date | None = None; label_ids: list[str] | None = None
class ChecklistCreate(BaseModel): title: str = Field(min_length=1, max_length=240)
class ChecklistUpdate(BaseModel): title: str | None = Field(default=None, min_length=1, max_length=240); is_completed: bool | None = None; position: int | None = Field(default=None, ge=0)
class LabelCreate(BaseModel): name: str = Field(min_length=1, max_length=60); colour: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
class LabelUpdate(BaseModel): name: str | None = Field(default=None, min_length=1, max_length=60); colour: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
class MoveTask(BaseModel): task_id: str; target_column_id: str; target_position: int = Field(ge=0); idempotency_key: str
class MoveColumn(BaseModel): column_id: str; target_position: int = Field(ge=0); idempotency_key: str


def project_or_404(project_id: str) -> dict:
    if project_id not in repository.projects: raise HTTPException(404, "Project not found")
    return repository.projects[project_id]
def column_or_404(column_id: str) -> dict:
    if column_id not in repository.columns: raise HTTPException(404, "Column not found")
    return repository.columns[column_id]
def task_or_404(task_id: str) -> dict:
    if task_id not in repository.tasks: raise HTTPException(404, "Task not found")
    return repository.tasks[task_id]
def label_or_404(label_id: str) -> dict:
    if label_id not in repository.labels: raise HTTPException(404, "Label not found")
    return repository.labels[label_id]
def writable_project(project_id: str) -> dict:
    project = project_or_404(project_id)
    try: project_service.ensure_writable(project_id)
    except ProjectArchivedError as error: raise HTTPException(409, str(error)) from error
    return project
def writable_column(column_id: str) -> dict:
    column = column_or_404(column_id); writable_project(column["project_id"]); return column
def writable_task(task_id: str) -> dict:
    task = task_or_404(task_id); writable_project(task["project_id"]); return task


@app.get("/api/projects")
def list_projects(include_archived: bool = False) -> list[dict]:
    summaries = []
    for project in sorted(repository.projects.values(), key=lambda item: item["updated_at"], reverse=True):
        if project.get("is_archived", False) and not include_archived: continue
        summary = project_service.archive_summary(project["id"]); total = summary["total_tasks"]; completed = summary["completed_tasks"]
        summaries.append(repository.copy(project) | {"total_tasks": total, "completed_tasks": completed, "completion_percentage": round(completed / total * 100) if total else 0})
    return summaries

@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
@persisted_mutation
def create_project(payload: ProjectCreate) -> dict: return repository.create_project(payload.name, payload.description)
@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict: return repository.copy(project_or_404(project_id))
@app.patch("/api/projects/{project_id}")
@persisted_mutation
def update_project(project_id: str, payload: ProjectUpdate) -> dict:
    project = writable_project(project_id); project.update(payload.model_dump(exclude_unset=True)); project["updated_at"] = now(); return repository.copy(project)
@app.get("/api/projects/{project_id}/archive-summary")
def archive_summary(project_id: str) -> dict:
    project_or_404(project_id); return project_service.archive_summary(project_id)
@app.post("/api/projects/{project_id}/archive")
@persisted_mutation
def archive_project(project_id: str, payload: ArchiveProject) -> dict:
    project_or_404(project_id)
    try: return project_service.archive(project_id, payload.confirm_incomplete)
    except PendingProjectActionsError as error: raise HTTPException(409, str(error)) from error
    except ArchiveConfirmationRequiredError as error: raise HTTPException(409, {"message": "This project has incomplete tasks. Confirm to archive it.", **error.summary}) from error
@app.post("/api/projects/{project_id}/restore")
@persisted_mutation
def restore_project(project_id: str) -> dict:
    project_or_404(project_id); return project_service.restore(project_id)
@app.delete("/api/projects/{project_id}", status_code=204)
@persisted_mutation
def delete_project(project_id: str, payload: DeleteProject) -> Response:
    project_or_404(project_id)
    try: project_service.delete(project_id, payload.confirmation_name)
    except DeleteConfirmationError as error: raise HTTPException(409, str(error)) from error
    return Response(status_code=204)
@app.get("/api/projects/{project_id}/board")
def get_board(project_id: str) -> dict: project_or_404(project_id); return repository.board(project_id)

@app.post("/api/projects/{project_id}/columns", status_code=201)
@persisted_mutation
def create_column(project_id: str, payload: Named) -> dict: writable_project(project_id); return repository.create_column(project_id, payload.name)
@app.patch("/api/columns/{column_id}")
@persisted_mutation
def update_column(column_id: str, payload: Named) -> dict: column = writable_column(column_id); column["name"] = payload.name; column["updated_at"] = now(); return repository.copy(column)
@app.delete("/api/columns/{column_id}", status_code=204)
@persisted_mutation
def delete_column(column_id: str, destination_column_id: str | None = None) -> Response:
    column = writable_column(column_id); tasks = [task for task in repository.tasks.values() if task["column_id"] == column_id]
    if tasks and not destination_column_id: raise HTTPException(409, "Destination column required")
    if destination_column_id:
        destination = column_or_404(destination_column_id)
        if destination["project_id"] != column["project_id"]: raise HTTPException(409, "Destination must belong to the same project")
        for task in tasks: task["column_id"] = destination_column_id; task["position"] = len(repository.project_tasks(column["project_id"]))
        repository.reindex_tasks(column["project_id"], destination_column_id)
    del repository.columns[column_id]; repository.reindex_columns(column["project_id"]); return Response(status_code=204)

@app.post("/api/projects/{project_id}/tasks", status_code=201)
@persisted_mutation
def create_task(project_id: str, payload: TaskCreate) -> dict:
    writable_project(project_id); column = column_or_404(payload.column_id)
    if column["project_id"] != project_id: raise HTTPException(409, "Column does not belong to project")
    if any(label_or_404(label_id)["project_id"] != project_id for label_id in payload.label_ids): raise HTTPException(409, "Label does not belong to project")
    timestamp = now(); task = {"id": new_id(), "project_id": project_id, "column_id": payload.column_id, "title": payload.title, "description": payload.description, "priority": payload.priority, "story_points": payload.story_points, "due_date": str(payload.due_date) if payload.due_date else None, "position": sum(item["column_id"] == payload.column_id for item in repository.tasks.values()), "label_ids": payload.label_ids, "created_at": timestamp, "updated_at": timestamp}; repository.tasks[task["id"]] = task; return repository.task_view(task)
@app.get("/api/tasks/{task_id}")
def get_task(task_id: str) -> dict: return repository.task_view(task_or_404(task_id))
@app.patch("/api/tasks/{task_id}")
@persisted_mutation
def update_task(task_id: str, payload: TaskUpdate) -> dict:
    task = writable_task(task_id); changes = payload.model_dump(exclude_unset=True)
    if "due_date" in changes: changes["due_date"] = str(changes["due_date"]) if changes["due_date"] else None
    if changes.get("label_ids") is not None and any(label_or_404(label_id)["project_id"] != task["project_id"] for label_id in changes["label_ids"]): raise HTTPException(409, "Label does not belong to project")
    task.update(changes); task["updated_at"] = now(); return repository.task_view(task)
@app.delete("/api/tasks/{task_id}", status_code=204)
@persisted_mutation
def delete_task(task_id: str) -> Response:
    writable_task(task_id)
    for item_id, item in list(repository.checklist.items()):
        if item["task_id"] == task_id: del repository.checklist[item_id]
    del repository.tasks[task_id]; return Response(status_code=204)

@app.post("/api/tasks/{task_id}/checklist", status_code=201)
@persisted_mutation
def create_checklist(task_id: str, payload: ChecklistCreate) -> dict:
    writable_task(task_id); timestamp = now(); item = {"id": new_id(), "task_id": task_id, "title": payload.title, "is_completed": False, "position": sum(existing["task_id"] == task_id for existing in repository.checklist.values()), "created_at": timestamp, "updated_at": timestamp}; repository.checklist[item["id"]] = item; return repository.copy(item)
@app.patch("/api/checklist/{item_id}")
@persisted_mutation
def update_checklist(item_id: str, payload: ChecklistUpdate) -> dict:
    if item_id not in repository.checklist: raise HTTPException(404, "Checklist item not found")
    item = repository.checklist[item_id]; writable_task(item["task_id"]); item.update(payload.model_dump(exclude_unset=True)); item["updated_at"] = now(); return repository.copy(item)
@app.delete("/api/checklist/{item_id}", status_code=204)
@persisted_mutation
def delete_checklist(item_id: str) -> Response:
    if item_id not in repository.checklist: raise HTTPException(404, "Checklist item not found")
    writable_task(repository.checklist[item_id]["task_id"])
    del repository.checklist[item_id]; return Response(status_code=204)

@app.get("/api/projects/{project_id}/labels")
def list_labels(project_id: str) -> list[dict]: project_or_404(project_id); return [repository.copy(label) for label in repository.labels.values() if label["project_id"] == project_id]
@app.post("/api/projects/{project_id}/labels", status_code=201)
@persisted_mutation
def create_label(project_id: str, payload: LabelCreate) -> dict:
    writable_project(project_id)
    return label_service.create(project_id, payload.name, payload.colour)
@app.patch("/api/labels/{label_id}")
@persisted_mutation
def update_label(label_id: str, payload: LabelUpdate) -> dict:
    label = label_or_404(label_id); writable_project(label["project_id"])
    return label_service.update(label_id, payload.model_dump(exclude_unset=True, exclude_none=True))
@app.delete("/api/labels/{label_id}", status_code=204)
@persisted_mutation
def delete_label(label_id: str) -> Response:
    label = label_or_404(label_id); writable_project(label["project_id"])
    label_service.delete(label_id)
    return Response(status_code=204)

@serialized_board_action
def process_action(action: dict) -> None:
    action["status"] = "PROCESSING"; action["started_at"] = now(); action["attempt_count"] += 1
    try:
        payload = action["payload"]; project_id = action["project_id"]
        try: project_service.ensure_writable(project_id)
        except ProjectArchivedError as error: raise HTTPException(409, str(error)) from error
        if action["action_type"] == "MOVE_TASK":
            task = task_or_404(payload["task_id"]); target = column_or_404(payload["target_column_id"])
            if task["project_id"] != project_id or target["project_id"] != project_id: raise HTTPException(409, "Task and target column must belong to project")
            old_column = task["column_id"]
            destination_tasks = [item for item in repository.project_tasks(project_id) if item["column_id"] == target["id"] and item["id"] != task["id"]]
            destination_tasks.insert(min(payload["target_position"], len(destination_tasks)), task)
            task["column_id"] = target["id"]
            for position, item in enumerate(destination_tasks): item["position"] = position
            if old_column != target["id"]: repository.reindex_tasks(project_id, old_column)
        else:
            column = column_or_404(payload["column_id"])
            if column["project_id"] != project_id: raise HTTPException(409, "Column must belong to project")
            columns = repository.project_columns(project_id); columns.remove(column); columns.insert(min(payload["target_position"], len(columns)), column)
            for position, item in enumerate(columns): item["position"] = position
        action["status"] = "COMPLETED"; action["completed_at"] = now(); action["last_error"] = None
    except HTTPException as error:
        action["status"] = "FAILED"; action["completed_at"] = now(); action["last_error"] = error.detail; raise

@serialized_board_action
def recover_actions() -> None:
    for action in sorted(repository.actions.values(), key=lambda item: item["created_at"]):
        if action["status"] not in {"PENDING", "PROCESSING", "FAILED"}: continue
        if action["attempt_count"] >= 5: action["status"] = "FAILED"; continue
        try: process_action(action)
        except HTTPException: pass
    repository.save()

@serialized_board_action
def accepted_action(project_id: str, action_type: str, payload: dict[str, Any]) -> dict:
    key = (project_id, payload["idempotency_key"])
    if key in repository.action_keys: action = repository.actions[repository.action_keys[key]]; return {"action_id": action["id"], "status": action["status"]}
    writable_project(project_id)
    action = {"id": new_id(), "project_id": project_id, "action_type": action_type, "payload": payload, "idempotency_key": payload["idempotency_key"], "status": "PENDING", "attempt_count": 0, "last_error": None, "created_at": now(), "started_at": None, "completed_at": None}; repository.actions[action["id"]] = action; repository.action_keys[key] = action["id"]
    process_action(action)
    return {"action_id": action["id"], "status": action["status"]}

@app.post("/api/projects/{project_id}/actions/move-task", status_code=202)
@persisted_mutation
def move_task(project_id: str, payload: MoveTask) -> dict: project_or_404(project_id); return accepted_action(project_id, "MOVE_TASK", payload.model_dump())
@app.post("/api/projects/{project_id}/actions/move-column", status_code=202)
@persisted_mutation
def move_column(project_id: str, payload: MoveColumn) -> dict: project_or_404(project_id); return accepted_action(project_id, "MOVE_COLUMN", payload.model_dump())
@app.get("/api/actions/{action_id}")
def get_action(action_id: str) -> dict:
    if action_id not in repository.actions: raise HTTPException(404, "Action not found")
    return repository.copy(repository.actions[action_id])


# FastAPI executes this during application startup, before serving requests.
app.router.on_startup.append(recover_actions)
