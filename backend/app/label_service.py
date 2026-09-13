"""Label lifecycle rules kept separate from FastAPI route handling."""
from __future__ import annotations

from hashlib import sha256

from .repository import new_id, now


def generated_colour(project_id: str, label_name: str, attempt: int = 0) -> str:
    """Generate a readable, deterministic hex colour from label identity and a probe."""
    digest = sha256(f"{project_id}:{label_name.casefold()}:{attempt}".encode()).digest()
    # Constrain RGB channels to mid-tone values so both text and tinted badges stay legible.
    red, green, blue = (76 + value % 128 for value in digest[:3])
    return f"#{red:02X}{green:02X}{blue:02X}"


class LabelService:
    def __init__(self, repository) -> None:
        self.repository = repository

    def create(self, project_id: str, name: str, colour: str | None = None) -> dict:
        used_colours = {
            label["colour"]
            for label in self.repository.labels.values()
            if label["project_id"] == project_id
        }
        selected_colour = colour
        attempt = 0
        while selected_colour is None or selected_colour in used_colours:
            selected_colour = generated_colour(project_id, name, attempt)
            attempt += 1
        label = {
            "id": new_id(),
            "project_id": project_id,
            "name": name,
            "colour": selected_colour,
            "created_at": now(),
        }
        self.repository.labels[label["id"]] = label
        return self.repository.copy(label)

    def update(self, label_id: str, changes: dict) -> dict:
        label = self.repository.labels[label_id]
        label.update(changes)
        return self.repository.copy(label)

    def delete(self, label_id: str) -> None:
        for task in self.repository.tasks.values():
            task["label_ids"] = [item for item in task["label_ids"] if item != label_id]
        del self.repository.labels[label_id]
