from fastapi.testclient import TestClient

from app.main import app


def client() -> TestClient:
    return TestClient(app)


def create_project(api: TestClient, name: str = "Launch plan") -> dict:
    response = api.post("/api/projects", json={"name": name, "description": "Ship the MVP"})
    assert response.status_code == 201
    return response.json()


def test_projects_have_default_workflow_and_board_projection() -> None:
    api = client()
    project = create_project(api)

    listing = api.get("/api/projects")
    assert listing.status_code == 200
    assert listing.json()[0]["id"] == project["id"]
    assert listing.json()[0]["total_tasks"] == 0

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
