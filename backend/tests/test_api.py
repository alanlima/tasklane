import asyncio
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


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
