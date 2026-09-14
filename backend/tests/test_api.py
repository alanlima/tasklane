import asyncio
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app import main
from app.database import DatabaseRepository
from app.repository import MockRepository


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


class ApiClient:
    def request(self, method: str, path: str, **kwargs):
        async def send():
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:
                return await api.request(method, path, **kwargs)
        return asyncio.run(send())
    def get(self, path, **kwargs): return self.request("GET", path, **kwargs)
    def post(self, path, **kwargs): return self.request("POST", path, **kwargs)
    def patch(self, path, **kwargs): return self.request("PATCH", path, **kwargs)
    def delete(self, path, **kwargs): return self.request("DELETE", path, **kwargs)


def client() -> ApiClient: return ApiClient()


def create_project(api: ApiClient, name: str = "Launch plan") -> dict:
    response = api.post("/api/projects", json={"name": name, "description": "Ship the MVP"})
    assert response.status_code == 201
    return response.json()


@pytest.mark.anyio
async def test_development_seed_is_available_for_the_integrated_frontend() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as api:

        response = await api.get("/api/projects")

        assert response.status_code == 200
        project = next(project for project in response.json() if project["name"] == "Tasklane Development")
        board = (await api.get(f"/api/projects/{project['id']}/board")).json()
        assert [column["name"] for column in board["columns"]] == ["Backlog", "To Do", "In Progress", "Review", "Done"]
        assert board["tasks"]


def test_projects_have_default_workflow_and_board_projection() -> None:
    api = client()
    project = create_project(api)

    listing = api.get("/api/projects")
    assert listing.status_code == 200
    created_summary = next(summary for summary in listing.json() if summary["id"] == project["id"])
    assert created_summary["total_tasks"] == 0

    board = api.get(f"/api/projects/{project['id']}/board")
    assert board.status_code == 200
    assert [column["name"] for column in board.json()["columns"]] == ["Backlog", "To Do", "In Progress", "Done"]
    assert board.json()["tasks"] == []


def test_task_checklist_and_label_crud() -> None:
    api = client()
    project = create_project(api)
    board = api.get(f"/api/projects/{project['id']}/board").json()
    column_id = board["columns"][0]["id"]

    label = api.post(f"/api/projects/{project['id']}/labels", json={"name": "API", "colour": "#35685B"}).json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": column_id, "title": "Define contract", "label_ids": [label["id"]]}).json()
    assert task["title"] == "Define contract"
    assert task["label_ids"] == [label["id"]]

    updated = api.patch(f"/api/tasks/{task['id']}", json={"priority": "HIGH", "story_points": 3})
    assert updated.status_code == 200
    assert updated.json()["priority"] == "HIGH"

    item = api.post(f"/api/tasks/{task['id']}/checklist", json={"title": "Write examples"})
    assert item.status_code == 201
    completed = api.patch(f"/api/checklist/{item.json()['id']}", json={"is_completed": True})
    assert completed.json()["is_completed"] is True
    assert api.get(f"/api/tasks/{task['id']}").json()["checklist"][0]["title"] == "Write examples"


def test_labels_receive_distinct_automatic_colours_and_are_removed_from_tasks() -> None:
    api = client(); project = create_project(api); board = api.get(f"/api/projects/{project['id']}/board").json()
    first = api.post(f"/api/projects/{project['id']}/labels", json={"name": "Frontend"}).json()
    # Reusing a name produces the same first hash candidate, so the generator
    # must probe and select a colour that is not already used in this project.
    second = api.post(f"/api/projects/{project['id']}/labels", json={"name": "Frontend"}).json()
    assert first["colour"] != second["colour"]
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Labelled", "label_ids": [first["id"]]}).json()
    renamed = api.patch(f"/api/labels/{first['id']}", json={"name": "UI"}).json()
    assert renamed["name"] == "UI"
    assert renamed["colour"] == first["colour"]
    assert api.delete(f"/api/labels/{first['id']}").status_code == 204
    assert api.get(f"/api/tasks/{task['id']}").json()["label_ids"] == []


def test_columns_can_be_created_renamed_and_deleted_when_empty() -> None:
    api = client()
    project = create_project(api)
    created = api.post(f"/api/projects/{project['id']}/columns", json={"name": "Review"})
    assert created.status_code == 201
    renamed = api.patch(f"/api/columns/{created.json()['id']}", json={"name": "Quality"})
    assert renamed.json()["name"] == "Quality"
    assert api.delete(f"/api/columns/{created.json()['id']}").status_code == 204


def test_move_task_is_idempotent_and_action_status_is_available() -> None:
    api = client()
    project = create_project(api)
    board = api.get(f"/api/projects/{project['id']}/board").json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Move me"}).json()
    command = {"task_id": task["id"], "target_column_id": board["columns"][1]["id"], "target_position": 0, "idempotency_key": "be7ad358-f7c6-48ef-85d1-b4c73ca2c8fc"}

    first = api.post(f"/api/projects/{project['id']}/actions/move-task", json=command)
    retry = api.post(f"/api/projects/{project['id']}/actions/move-task", json=command)
    assert first.status_code == retry.status_code == 202
    assert first.json()["action_id"] == retry.json()["action_id"]
    assert api.get(f"/api/actions/{first.json()['action_id']}").json()["status"] == "COMPLETED"
    assert api.get(f"/api/tasks/{task['id']}").json()["column_id"] == command["target_column_id"]


def test_task_checklist_and_label_can_be_updated_and_deleted() -> None:
    api = client(); project = create_project(api); board = api.get(f"/api/projects/{project['id']}/board").json()
    label = api.post(f"/api/projects/{project['id']}/labels", json={"name": "API", "colour": "#35685B"}).json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Contract", "label_ids": [label["id"]]}).json()
    item = api.post(f"/api/tasks/{task['id']}/checklist", json={"title": "Draft"}).json()
    assert api.patch(f"/api/checklist/{item['id']}", json={"title": "Review", "position": 0}).json()["title"] == "Review"
    assert api.patch(f"/api/labels/{label['id']}", json={"name": "Backend", "colour": "#6574C9"}).json()["name"] == "Backend"
    assert api.delete(f"/api/checklist/{item['id']}").status_code == 204
    assert api.delete(f"/api/labels/{label['id']}").status_code == 204
    assert api.get(f"/api/tasks/{task['id']}").json()["label_ids"] == []


def test_project_deletion_removes_its_board_and_requires_exact_name() -> None:
    api = client(); first = create_project(api, "First"); second = create_project(api, "Second")
    first_board = api.get(f"/api/projects/{first['id']}/board").json(); second_board = api.get(f"/api/projects/{second['id']}/board").json()
    task = api.post(f"/api/projects/{first['id']}/tasks", json={"column_id": first_board["columns"][0]["id"], "title": "Keep isolated"}).json()
    assert api.post(f"/api/projects/{first['id']}/tasks", json={"column_id": second_board["columns"][0]["id"], "title": "Invalid"}).status_code == 409
    assert api.post(f"/api/projects/{first['id']}/actions/move-task", json={"task_id": task["id"], "target_column_id": second_board["columns"][0]["id"], "target_position": 0, "idempotency_key": "cross-project"}).status_code == 409
    action = api.post(f"/api/projects/{first['id']}/actions/move-task", json={"task_id": task["id"], "target_column_id": first_board["columns"][1]["id"], "target_position": 0, "idempotency_key": "owned-action"}).json()
    assert api.delete(f"/api/projects/{first['id']}", json={"confirmation_name": "not the name"}).status_code == 409
    assert api.delete(f"/api/projects/{first['id']}", json={"confirmation_name": "First"}).status_code == 204
    assert api.get(f"/api/projects/{first['id']}").status_code == 404
    assert api.get(f"/api/tasks/{task['id']}").status_code == 404
    assert api.get(f"/api/actions/{action['action_id']}").status_code == 404


def test_project_archive_requires_confirmation_hides_dashboard_and_enforces_read_only() -> None:
    api = client(); project = create_project(api, "Archive me"); board = api.get(f"/api/projects/{project['id']}/board").json()
    api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Still open"})

    summary = api.get(f"/api/projects/{project['id']}/archive-summary")
    assert summary.json() == {"total_tasks": 1, "completed_tasks": 0, "incomplete_tasks": 1}
    blocked = api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": False})
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["incomplete_tasks"] == 1

    archived = api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": True})
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True
    assert project["id"] not in {item["id"] for item in api.get("/api/projects").json()}
    assert project["id"] in {item["id"] for item in api.get("/api/projects?include_archived=true").json()}
    assert api.get(f"/api/projects/{project['id']}/board").status_code == 200
    assert api.patch(f"/api/projects/{project['id']}", json={"name": "Nope"}).status_code == 409
    assert api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Nope"}).status_code == 409
    assert api.post(f"/api/projects/{project['id']}/restore").json()["is_archived"] is False
    assert api.patch(f"/api/projects/{project['id']}", json={"name": "Active again"}).status_code == 200


def test_populated_column_requires_destination_and_columns_can_be_reordered() -> None:
    api = client(); project = create_project(api); board = api.get(f"/api/projects/{project['id']}/board").json(); source, target = board["columns"][:2]
    api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": source["id"], "title": "Move with column"})
    assert api.delete(f"/api/columns/{source['id']}").status_code == 409
    assert api.delete(f"/api/columns/{source['id']}?destination_column_id={target['id']}").status_code == 204
    command = {"column_id": board["columns"][2]["id"], "target_position": 0, "idempotency_key": "column-order"}
    assert api.post(f"/api/projects/{project['id']}/actions/move-column", json=command).status_code == 202
    assert api.get(f"/api/projects/{project['id']}/board").json()["columns"][0]["id"] == command["column_id"]


def test_database_seed_is_idempotent_and_state_survives_repository_recreation() -> None:
    initial = main.repository
    seeded = [project for project in initial.projects.values() if project["name"] == "Tasklane Development"]
    assert len(seeded) == 1
    project = create_project(client(), "Persistent")
    restarted = DatabaseRepository(MockRepository())
    assert project["id"] in restarted.projects
    assert len([item for item in restarted.projects.values() if item["name"] == "Tasklane Development"]) == 1


def test_pending_and_failed_actions_are_recovered_and_persisted_at_startup() -> None:
    api = client(); project = create_project(api); board = api.get(f"/api/projects/{project['id']}/board").json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": board["columns"][0]["id"], "title": "Recover"}).json()
    action = {"id": "pending-action", "project_id": project["id"], "action_type": "MOVE_TASK", "payload": {"task_id": task["id"], "target_column_id": board["columns"][1]["id"], "target_position": 0, "idempotency_key": "recover"}, "idempotency_key": "recover", "status": "PENDING", "attempt_count": 0, "last_error": None, "created_at": "2026-01-01T00:00:00+00:00", "started_at": None, "completed_at": None}
    main.repository.actions[action["id"]] = action
    main.repository.save()
    assert main.recover_actions in app.router.on_startup
    main.recover_actions()
    assert action["status"] == "COMPLETED"
    assert main.repository.tasks[task["id"]]["column_id"] == board["columns"][1]["id"]
    restarted = DatabaseRepository(MockRepository())
    assert restarted.actions[action["id"]]["status"] == "COMPLETED"
    assert restarted.tasks[task["id"]]["column_id"] == board["columns"][1]["id"]
    action["status"] = "FAILED"; action["attempt_count"] = 5
    main.recover_actions()
    assert action["status"] == "FAILED"


def test_task_can_be_reordered_within_its_current_column() -> None:
    api = client(); project = create_project(api); board = api.get(f"/api/projects/{project['id']}/board").json(); column = board["columns"][0]
    first = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": column["id"], "title": "First"}).json()
    second = api.post(f"/api/projects/{project['id']}/tasks", json={"column_id": column["id"], "title": "Second"}).json()
    response = api.post(f"/api/projects/{project['id']}/actions/move-task", json={"task_id": second["id"], "target_column_id": column["id"], "target_position": 0, "idempotency_key": "same-column"})
    assert response.status_code == 202
    tasks = api.get(f"/api/projects/{project['id']}/board").json()["tasks"]
    ordered = [task["id"] for task in tasks if task["column_id"] == column["id"]]
    assert ordered == [second["id"], first["id"]]


def test_archive_and_dashboard_completion_use_final_column_not_name() -> None:
    api = client()
    project = api.post("/api/projects", json={"name": "Completion lanes"}).json()
    board = api.get(f"/api/projects/{project['id']}/board").json()
    final = board["columns"][-1]
    assert api.patch(f"/api/columns/{final['id']}", json={"name": "Complete"}).status_code == 200
    api.post(f"/api/projects/{project['id']}/tasks", json={"title": "Finished", "column_id": final["id"]})
    summary = api.get(f"/api/projects/{project['id']}/archive-summary").json()
    assert summary == {"total_tasks": 1, "completed_tasks": 1, "incomplete_tasks": 0}
    dashboard = next(item for item in api.get("/api/projects").json() if item["id"] == project["id"])
    assert dashboard["completion_percentage"] == 100
    assert api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": False}).status_code == 200


@pytest.mark.parametrize("kind", ["task", "column"])
def test_archived_project_returns_accepted_move_retry_but_rejects_new_move(kind: str) -> None:
    api = client()
    project = create_project(api)
    board = api.get(f"/api/projects/{project['id']}/board").json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"title": "Retry me", "column_id": board["columns"][0]["id"]}).json()
    command = {"target_position": 0, "idempotency_key": f"archive-retry-{kind}"}
    if kind == "task":
        command.update(task_id=task["id"], target_column_id=board["columns"][1]["id"])
    else:
        command.update(column_id=board["columns"][1]["id"])
    endpoint = f"/api/projects/{project['id']}/actions/move-{kind}"
    first = api.post(endpoint, json=command)
    assert first.status_code == 202
    original = api.get(f"/api/actions/{first.json()['action_id']}").json()
    assert api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": True}).status_code == 200
    retry = api.post(endpoint, json=command)
    assert retry.status_code == 202
    assert retry.json() == first.json()
    assert api.get(f"/api/actions/{first.json()['action_id']}").json() == original
    assert api.post(endpoint, json={**command, "idempotency_key": "new-command"}).status_code == 409


@pytest.mark.parametrize("action_status,attempts", [("PENDING", 0), ("PROCESSING", 1), ("FAILED", 1)])
def test_archive_waits_for_accepted_moves_before_becoming_read_only(action_status: str, attempts: int) -> None:
    api = client()
    project = create_project(api)
    board = api.get(f"/api/projects/{project['id']}/board").json()
    task = api.post(f"/api/projects/{project['id']}/tasks", json={"title": "Accepted move", "column_id": board["columns"][0]["id"]}).json()
    action_id = f"queued-{project['id']}"
    action = {"id": action_id, "project_id": project["id"], "action_type": "MOVE_TASK", "payload": {"task_id": task["id"], "target_column_id": board["columns"][-1]["id"], "target_position": 0, "idempotency_key": action_id}, "idempotency_key": action_id, "status": action_status, "attempt_count": attempts, "last_error": None, "created_at": "2026-01-01T00:00:00+00:00", "started_at": None, "completed_at": None}
    main.repository.actions[action_id] = action
    main.repository.action_keys[(project["id"], action_id)] = action_id
    main.repository.save()
    archived = api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": False})
    assert archived.status_code == 200
    assert action["status"] == "COMPLETED"
    assert action["attempt_count"] == attempts + 1
    assert api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": False}).status_code == 200
    persisted = DatabaseRepository(MockRepository())
    assert persisted.projects[project["id"]]["is_archived"]
    assert persisted.actions[action_id]["status"] == "COMPLETED"
    assert persisted.tasks[task["id"]]["column_id"] == board["columns"][-1]["id"]
    api.post(f"/api/projects/{project['id']}/restore")
    completed_attempts = action["attempt_count"]
    main.recover_actions()
    assert action["attempt_count"] == completed_attempts


def test_archive_advances_failed_action_to_retry_limit_without_restart() -> None:
    api = client()
    project = create_project(api)
    action_id = "invalid-accepted-action"
    action = {"id": action_id, "project_id": project["id"], "action_type": "MOVE_COLUMN", "payload": {"column_id": "missing-column", "target_position": 0, "idempotency_key": action_id}, "idempotency_key": action_id, "status": "FAILED", "attempt_count": 1, "last_error": "Column not found", "created_at": "2026-01-01T00:00:00+00:00", "started_at": None, "completed_at": None}
    main.repository.actions[action_id] = action
    main.repository.action_keys[(project["id"], action_id)] = action_id
    main.repository.save()
    for attempts in range(2, 6):
        response = api.post(f"/api/projects/{project['id']}/archive", json={"confirm_incomplete": True})
        assert action["attempt_count"] == attempts
        assert action["status"] == "FAILED"
        assert response.status_code == (200 if attempts == 5 else 409)
        persisted = DatabaseRepository(MockRepository())
        assert persisted.actions[action_id]["attempt_count"] == attempts
    api.post(f"/api/projects/{project['id']}/restore")
    main.recover_actions()
    assert action["attempt_count"] == 5
