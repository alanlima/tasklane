from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .repository import MockRepository, new_id, now
from .database import DatabaseRepository

app = FastAPI(title="Tasklane API", version="0.1.0", openapi_url="/openapi.json")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["*"], allow_headers=["*"])
repository = DatabaseRepository(MockRepository())

@app.middleware("http")
async def persist_changes(request, call_next):
    response = await call_next(request)
    if request.method in {"POST", "PATCH", "DELETE"} and response.status_code < 400:
        repository.save()
    return response


class ProjectCreate(BaseModel): name: str = Field(min_length=1, max_length=120); description: str | None = Field(default=None, max_length=2000)
class ProjectUpdate(BaseModel): name: str | None = Field(default=None, min_length=1, max_length=120); description: str | None = Field(default=None, max_length=2000)
class Named(BaseModel): name: str = Field(min_length=1, max_length=80)
class TaskCreate(BaseModel): column_id: str; title: str = Field(min_length=1, max_length=240); description: str | None = None; priority: str = "NONE"; story_points: int | None = Field(default=None, ge=0); due_date: date | None = None; label_ids: list[str] = []
class TaskUpdate(BaseModel): title: str | None = Field(default=None, min_length=1, max_length=240); description: str | None = None; priority: str | None = None; story_points: int | None = Field(default=None, ge=0); due_date: date | None = None; label_ids: list[str] | None = None
class ChecklistCreate(BaseModel): title: str = Field(min_length=1, max_length=240)
class ChecklistUpdate(BaseModel): title: str | None = Field(default=None, min_length=1, max_length=240); is_completed: bool | None = None; position: int | None = Field(default=None, ge=0)
class LabelCreate(BaseModel): name: str = Field(min_length=1, max_length=60); colour: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
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


@app.get("/api/projects")
def list_projects() -> list[dict]:
    summaries = []
    for project in sorted(repository.projects.values(), key=lambda item: item["updated_at"], reverse=True):
        tasks = repository.project_tasks(project["id"]); done = next((column["id"] for column in repository.project_columns(project["id"]) if column["name"].lower() == "done"), None); completed = sum(task["column_id"] == done for task in tasks)
        summaries.append(repository.copy(project) | {"total_tasks": len(tasks), "completed_tasks": completed, "completion_percentage": round(completed / len(tasks) * 100) if tasks else 0})
    return summaries

@app.post("/api/projects", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate) -> dict: return repository.create_project(payload.name, payload.description)
@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict: return repository.copy(project_or_404(project_id))
@app.patch("/api/projects/{project_id}")
def update_project(project_id: str, payload: ProjectUpdate) -> dict:
    project = project_or_404(project_id); project.update(payload.model_dump(exclude_unset=True)); project["updated_at"] = now(); return repository.copy(project)
@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str) -> Response:
    project_or_404(project_id); task_ids = [task["id"] for task in repository.project_tasks(project_id)]
    for task_id in task_ids:
        for item_id, item in list(repository.checklist.items()):
            if item["task_id"] == task_id: del repository.checklist[item_id]
        del repository.tasks[task_id]
    for store in (repository.columns, repository.labels):
        for key, value in list(store.items()):
            if value["project_id"] == project_id: del store[key]
    del repository.projects[project_id]; return Response(status_code=204)
@app.get("/api/projects/{project_id}/board")
def get_board(project_id: str) -> dict: project_or_404(project_id); return repository.board(project_id)

@app.post("/api/projects/{project_id}/columns", status_code=201)
def create_column(project_id: str, payload: Named) -> dict: project_or_404(project_id); return repository.create_column(project_id, payload.name)
@app.patch("/api/columns/{column_id}")
def update_column(column_id: str, payload: Named) -> dict: column = column_or_404(column_id); column["name"] = payload.name; column["updated_at"] = now(); return repository.copy(column)
@app.delete("/api/columns/{column_id}", status_code=204)
def delete_column(column_id: str, destination_column_id: str | None = None) -> Response:
    column = column_or_404(column_id); tasks = [task for task in repository.tasks.values() if task["column_id"] == column_id]
    if tasks and not destination_column_id: raise HTTPException(409, "Destination column required")
    if destination_column_id:
        destination = column_or_404(destination_column_id)
        if destination["project_id"] != column["project_id"]: raise HTTPException(409, "Destination must belong to the same project")
        for task in tasks: task["column_id"] = destination_column_id; task["position"] = len(repository.project_tasks(column["project_id"]))
        repository.reindex_tasks(column["project_id"], destination_column_id)
    del repository.columns[column_id]; repository.reindex_columns(column["project_id"]); return Response(status_code=204)

@app.post("/api/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: str, payload: TaskCreate) -> dict:
    project_or_404(project_id); column = column_or_404(payload.column_id)
    if column["project_id"] != project_id: raise HTTPException(409, "Column does not belong to project")
    if any(label_or_404(label_id)["project_id"] != project_id for label_id in payload.label_ids): raise HTTPException(409, "Label does not belong to project")
    timestamp = now(); task = {"id": new_id(), "project_id": project_id, "column_id": payload.column_id, "title": payload.title, "description": payload.description, "priority": payload.priority, "story_points": payload.story_points, "due_date": str(payload.due_date) if payload.due_date else None, "position": sum(item["column_id"] == payload.column_id for item in repository.tasks.values()), "label_ids": payload.label_ids, "created_at": timestamp, "updated_at": timestamp}; repository.tasks[task["id"]] = task; return repository.task_view(task)
@app.get("/api/tasks/{task_id}")
def get_task(task_id: str) -> dict: return repository.task_view(task_or_404(task_id))
@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, payload: TaskUpdate) -> dict:
    task = task_or_404(task_id); changes = payload.model_dump(exclude_unset=True)
    if "due_date" in changes: changes["due_date"] = str(changes["due_date"]) if changes["due_date"] else None
    if changes.get("label_ids") is not None and any(label_or_404(label_id)["project_id"] != task["project_id"] for label_id in changes["label_ids"]): raise HTTPException(409, "Label does not belong to project")
    task.update(changes); task["updated_at"] = now(); return repository.task_view(task)
@app.delete("/api/tasks/{task_id}", status_code=204)
def delete_task(task_id: str) -> Response:
    task_or_404(task_id)
    for item_id, item in list(repository.checklist.items()):
        if item["task_id"] == task_id: del repository.checklist[item_id]
    del repository.tasks[task_id]; return Response(status_code=204)

@app.post("/api/tasks/{task_id}/checklist", status_code=201)
def create_checklist(task_id: str, payload: ChecklistCreate) -> dict:
    task_or_404(task_id); timestamp = now(); item = {"id": new_id(), "task_id": task_id, "title": payload.title, "is_completed": False, "position": sum(existing["task_id"] == task_id for existing in repository.checklist.values()), "created_at": timestamp, "updated_at": timestamp}; repository.checklist[item["id"]] = item; return repository.copy(item)
@app.patch("/api/checklist/{item_id}")
def update_checklist(item_id: str, payload: ChecklistUpdate) -> dict:
    if item_id not in repository.checklist: raise HTTPException(404, "Checklist item not found")
    item = repository.checklist[item_id]; item.update(payload.model_dump(exclude_unset=True)); item["updated_at"] = now(); return repository.copy(item)
@app.delete("/api/checklist/{item_id}", status_code=204)
def delete_checklist(item_id: str) -> Response:
    if item_id not in repository.checklist: raise HTTPException(404, "Checklist item not found")
    del repository.checklist[item_id]; return Response(status_code=204)

@app.get("/api/projects/{project_id}/labels")
def list_labels(project_id: str) -> list[dict]: project_or_404(project_id); return [repository.copy(label) for label in repository.labels.values() if label["project_id"] == project_id]
@app.post("/api/projects/{project_id}/labels", status_code=201)
def create_label(project_id: str, payload: LabelCreate) -> dict:
    project_or_404(project_id); label = {"id": new_id(), "project_id": project_id, "name": payload.name, "colour": payload.colour, "created_at": now()}; repository.labels[label["id"]] = label; return repository.copy(label)
@app.patch("/api/labels/{label_id}")
def update_label(label_id: str, payload: LabelCreate) -> dict: label = label_or_404(label_id); label.update(payload.model_dump()); return repository.copy(label)
@app.delete("/api/labels/{label_id}", status_code=204)
def delete_label(label_id: str) -> Response:
    label_or_404(label_id)
    for task in repository.tasks.values(): task["label_ids"] = [item for item in task["label_ids"] if item != label_id]
    del repository.labels[label_id]; return Response(status_code=204)

def process_action(action: dict) -> None:
    action["status"] = "PROCESSING"; action["started_at"] = now(); action["attempt_count"] += 1
    try:
        payload = action["payload"]; project_id = action["project_id"]
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

def recover_actions() -> None:
    for action in sorted(repository.actions.values(), key=lambda item: item["created_at"]):
        if action["status"] not in {"PENDING", "PROCESSING", "FAILED"}: continue
        if action["attempt_count"] >= 5: action["status"] = "FAILED"; continue
        try: process_action(action)
        except HTTPException: pass
    repository.save()

def accepted_action(project_id: str, action_type: str, payload: dict[str, Any]) -> dict:
    key = (project_id, payload["idempotency_key"])
    if key in repository.action_keys: action = repository.actions[repository.action_keys[key]]; return {"action_id": action["id"], "status": action["status"]}
    action = {"id": new_id(), "project_id": project_id, "action_type": action_type, "payload": payload, "idempotency_key": payload["idempotency_key"], "status": "PENDING", "attempt_count": 0, "last_error": None, "created_at": now(), "started_at": None, "completed_at": None}; repository.actions[action["id"]] = action; repository.action_keys[key] = action["id"]
    process_action(action)
    return {"action_id": action["id"], "status": action["status"]}

@app.post("/api/projects/{project_id}/actions/move-task", status_code=202)
def move_task(project_id: str, payload: MoveTask) -> dict: project_or_404(project_id); return accepted_action(project_id, "MOVE_TASK", payload.model_dump())
@app.post("/api/projects/{project_id}/actions/move-column", status_code=202)
def move_column(project_id: str, payload: MoveColumn) -> dict: project_or_404(project_id); return accepted_action(project_id, "MOVE_COLUMN", payload.model_dump())
@app.get("/api/actions/{action_id}")
def get_action(action_id: str) -> dict:
    if action_id not in repository.actions: raise HTTPException(404, "Action not found")
    return repository.copy(repository.actions[action_id])


# FastAPI executes this during application startup, before serving requests.
app.router.on_startup.append(recover_actions)
