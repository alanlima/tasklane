# Tasklane

## Product summary

**Tasklane** is a modern, lightweight Kanban project manager.

The application allows a user to create multiple projects. Each project owns an independent Kanban board with its own configurable workflow columns and tasks.

Tasklane is intentionally designed as a focused MVP for learning full-stack application development using:

- React frontend
- FastAPI backend
- SQLAlchemy ORM
- Relational database
- REST APIs
- Optimistic frontend updates
- Durable backend action processing
- Drag-and-drop interactions

There is **no authentication** in the MVP.

The product should feel simple, fast and visual rather than like a complex enterprise project-management system.

---

# 1. Product principles

Tasklane should optimise for:

1. Visual clarity
2. Minimal interaction cost
3. Fast task manipulation
4. Strong feedback after every action
5. Simple architecture
6. Database portability
7. Clear separation between frontend and backend
8. Recoverable drag-and-drop operations

Avoid making the MVP resemble Jira.

The UI should be closer to:

**Notion simplicity + lightweight Trello interaction + modern SaaS polish.**

---

# 2. Brand

## Name

**Tasklane**

Meaning:

> Tasks flowing through lanes toward completion.

The name should be used consistently across:

- application title
- browser title
- README
- API documentation
- Docker services
- repository documentation

Suggested repository name:

`tasklane`

---

# 3. Visual identity

## Design direction

Use a **Notion-inspired light interface**:

- generous whitespace
- warm neutral background
- subtle borders
- low visual noise
- minimal shadows
- compact typography
- colour primarily communicates meaning
- rounded but not overly rounded components

Avoid:

- gradients
- glassmorphism
- strong shadows
- excessive animation
- highly saturated backgrounds
- colourful columns covering the entire screen

---

# 4. Tasklane colour palette

Use the following custom palette.

### Base

| Token | Colour | Usage |
|---|---|---|
| Canvas | `#F7F6F2` | Main application background |
| Surface | `#FFFFFF` | Cards, drawers and panels |
| Surface Soft | `#FBFAF7` | Columns and secondary areas |
| Ink | `#252726` | Primary text |
| Ink Muted | `#71746F` | Secondary text |
| Border | `#E6E3DC` | Borders and separators |

### Brand

| Token | Colour | Usage |
|---|---|---|
| Tasklane Green | `#35685B` | Primary actions |
| Green Hover | `#295448` | Hover/active state |
| Green Soft | `#E8F0ED` | Selected states and soft highlights |
| Lane Indigo | `#6574C9` | Secondary accent |
| Indigo Soft | `#EEF0FA` | Story points / secondary badges |

### Semantic

| Token | Colour | Usage |
|---|---|---|
| Success | `#568565` | Completed |
| Warning | `#C38B3B` | Medium attention |
| Danger | `#C75F5F` | High priority / destructive actions |
| Info | `#6582A7` | Informational elements |

The palette should remain restrained.

Brand green should be the dominant accent.

Indigo should be used sparingly.

---

# 5. Typography

Use:

**Inter**

Fallback:

`Inter, ui-sans-serif, system-ui, sans-serif`

Typical hierarchy:

- Page title: 24–28px / semibold
- Section title: 18–20px / semibold
- Card title: 14–15px / medium
- Body: 14px
- Metadata: 12–13px
- Badge text: 11–12px

Avoid excessive bold text.

---

# 6. Frontend stack

Use:

- React
- Vite
- React Router
- Tailwind CSS
- shadcn/ui
- Lucide icons
- TanStack Query
- dnd-kit

Use shadcn/ui for common interaction primitives but customise the design tokens to match Tasklane rather than retaining the default shadcn appearance.

Use TanStack Query for server-state fetching, mutations, caching and reconciliation.

Use dnd-kit for:

- moving tasks between columns
- reordering tasks within a column
- optionally reordering columns

Its current React API directly supports sortable elements across multiple lists, making it well suited to the Tasklane board model.

---

# 7. High-level navigation

The application has two primary screens.

## Projects

Route:

`/`

Displays all projects.

## Kanban Board

Route:

`/projects/:projectId`

Displays the selected project's board.

Task details appear in a right-side drawer rather than navigating away from the board.

---

# 8. Application shell

Desktop layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Tasklane                          Projects        + Project │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                     Page content                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Keep the header approximately 56–64px tall.

Do not create a permanent large sidebar for the MVP.

The goal is maximum board space.

---

# 9. Projects dashboard

The default route displays:

```text
Projects                                      + New project

Organise your work into focused boards.

┌───────────────────┐  ┌───────────────────┐
│ SignalLoop        │  │ Personal Website  │
│                   │  │                   │
│ 14 tasks          │  │ 8 tasks           │
│ 6 completed       │  │ 5 completed       │
│                   │  │                   │
│ ███████░░ 43%     │  │ ████████░ 62%     │
└───────────────────┘  └───────────────────┘
```

Each project card should contain:

- name
- optional short description
- total tasks
- completed tasks
- completion percentage
- subtle progress bar
- last updated timestamp

Clicking the card opens the project.

Hover should only provide a subtle elevation/border change.

---

# 10. Create project flow

Clicking:

`+ New project`

opens a small modal.

Fields:

- Project name
- Description — optional

On creation provide a default workflow:

1. Backlog
2. To Do
3. In Progress
4. Done

These are only defaults.

Every project can later configure its own columns.

---

# 11. Kanban board layout

Example:

```text
← Projects

Website Redesign                              + Add task
12 tasks · 5 completed

------------------------------------------------------------

Backlog        To Do        In Progress        Review      Done
  3              4               2               1          5

┌─────────┐    ┌─────────┐   ┌─────────┐
│ Task    │    │ Task    │   │ Task    │
│ card    │    │ card    │   │ card    │
└─────────┘    └─────────┘   └─────────┘

┌─────────┐
│ Task    │
└─────────┘

+ Add task
```

The board must horizontally scroll when the project contains more columns than comfortably fit on screen.

Each column should maintain a practical width around:

`280–320px`

Columns should not stretch to fill the entire page.

---

# 12. Configurable workflow columns

A project's columns represent task statuses.

There must NOT be a hard-coded status enum such as:

`TODO / IN_PROGRESS / DONE`

Instead:

```text
Task
 └── column_id
```

determines its current status.

Example projects may therefore use completely different workflows.

### Software project

```text
Backlog
Ready
Development
Review
Testing
Done
```

### Personal project

```text
Ideas
Planned
Doing
Done
```

Users must be able to:

- create columns
- rename columns
- reorder columns
- delete empty columns

Deleting a column containing tasks must require the user to first select a destination column for those tasks.

---

# 13. Task cards

Cards must stay visually compact.

Example:

```text
┌──────────────────────────┐
│ Build project dashboard  │
│                          │
│ ● High                   │
│                          │
│ ✓ 2/4     ◇ 5      Sep 18│
└──────────────────────────┘
```

A card can show:

- title
- priority
- labels
- checklist progress
- story points
- due date

Description should NOT be displayed directly on the card.

---

# 14. Task priority

Supported values:

- None
- Low
- Medium
- High
- Urgent

Keep priority visual treatment subtle.

Example:

```text
Low       grey/blue
Medium    amber
High      red
Urgent    stronger red
```

Do not fill the entire task card with priority colours.

---

# 15. Story points

Task story points are optional.

Allow values such as:

`1, 2, 3, 5, 8, 13`

Do not strictly enforce Fibonacci values at database level.

Store the value as an integer.

Display story points using the Lane Indigo accent.

Example:

`◇ 5`

---

# 16. Task checklist

Tasks may contain zero or more checklist items.

Example drawer:

```text
Checklist                         2 / 4

☑ Create endpoint
☑ Create model
☐ Connect frontend
☐ Add tests

+ Add item
```

Checklist items must support:

- creation
- completion
- editing
- deletion
- reordering

Task card shows completion:

`✓ 2/4`

---

# 17. Task labels

Allow multiple labels per task.

Examples:

- Frontend
- Backend
- Bug
- UX
- API

Labels should use small, subtle pills.

Labels belong to a project so projects can define different label sets.

---

# 18. Task drawer

Clicking a task opens a drawer from the right.

Recommended width:

`440–520px`

The board remains visible behind it.

Example:

```text
                         ┌───────────────────────┐
                         │ Build project board × │
                         │                       │
                         │ Status                │
                         │ In Progress           │
                         │                       │
                         │ Priority    High      │
                         │ Points      5         │
                         │ Due date    Sep 20    │
                         │                       │
                         │ Labels                │
                         │ Frontend   UX         │
                         │                       │
                         │ Description           │
                         │ ....................  │
                         │                       │
                         │ Checklist       2/4   │
                         │ ☑ API                 │
                         │ ☑ model               │
                         │ ☐ frontend            │
                         │ ☐ tests               │
                         └───────────────────────┘
```

Changes should persist without a global Save button.

Individual fields can save:

- on selection
- on blur
- after short debouncing for text

Show subtle status feedback such as:

`Saving…`

followed by:

`Saved`

Avoid disruptive success toasts for every small edit.

---

# 19. Drag and drop

Users must be able to:

### Tasks

- reorder inside a column
- move between columns

### Columns

- reorder the workflow

The UI should update immediately.

Do NOT wait for the backend before visually moving the card.

Use optimistic updates.

---

# 20. Reliable drag-and-drop persistence

This is an important Tasklane architectural requirement.

A card move should follow:

```text
User drops card
       │
       ▼
React updates board immediately
       │
       ▼
POST movement command
       │
       ▼
FastAPI validates request
       │
       ▼
Persist BoardAction in database
       │
       ▼
COMMIT
       │
       ▼
202 Accepted
       │
       ▼
Action worker
       │
       ▼
Apply task movement transaction
       │
       ▼
Action → COMPLETED
```

The API must persist the action **before acknowledging it**.

This means a backend restart after acknowledgement must not lose the requested movement.

---

# 21. Do not use an in-memory queue

Do NOT implement the reliability requirement using:

```python
asyncio.Queue()
```

alone.

Do NOT rely exclusively on:

```python
FastAPI BackgroundTasks
```

for board persistence.

Those mechanisms do not provide the durability Tasklane requires.

Use a database-backed queue.

---

# 22. Board action model

Create an entity similar to:

```text
BoardAction

id
project_id
action_type
payload
idempotency_key
status
attempt_count
last_error
created_at
started_at
completed_at
```

Statuses:

```text
PENDING
PROCESSING
COMPLETED
FAILED
```

Initial action types:

```text
MOVE_TASK
MOVE_COLUMN
```

Possible future actions can extend this model.

---

# 23. Idempotency

Each movement request must contain an:

`idempotency_key`

generated by the frontend.

The backend must enforce uniqueness.

If the same request is retried because of a network error:

```text
POST request
    ↓
connection interrupted
    ↓
frontend retries
    ↓
same idempotency key
```

the backend must NOT apply the movement twice.

Return the previously created action.

---

# 24. Queue ordering

Board actions should execute FIFO.

For the MVP use:

**one action worker**

This avoids concurrent board ordering mutations and keeps behaviour deterministic.

Do not introduce:

- Kafka
- RabbitMQ
- Redis
- Celery

for this module.

The queue itself lives in the same relational database.

The architecture should however allow the worker implementation to be replaced later.

---

# 25. Queue recovery

On worker startup:

- find pending actions
- retry them
- identify stale `PROCESSING` actions
- safely return stale actions to `PENDING`
- enforce a maximum retry count

Example:

`max_attempts = 5`

If processing repeatedly fails:

`FAILED`

Store the final error.

---

# 26. Reconciliation

The frontend should optimistically update the board.

If action processing succeeds:

no visible correction is necessary.

If it fails:

1. show a small warning
2. invalidate the project board query
3. reload authoritative board state from the backend

Avoid permanently maintaining duplicate server state inside React.

---

# 27. Task ordering

Use an integer:

`position`

for task ordering.

For this MVP, prioritise correctness over clever ranking algorithms.

After movement, reindex tasks in affected columns:

```text
0
1
2
3
...
```

Boards are expected to remain small enough that this is acceptable.

Do not use database-specific ranking functionality.

---

# 28. Database model

Minimum entities:

```text
Project
Column
Task
ChecklistItem
Label
TaskLabel
BoardAction
```

---

# 29. Project

Suggested fields:

```text
id
name
description
created_at
updated_at
```

---

# 30. Column

Suggested fields:

```text
id
project_id
name
position
created_at
updated_at
```

Relationship:

```text
Project
 └── Columns[]
```

---

# 31. Task

Suggested fields:

```text
id
project_id
column_id
title
description
priority
story_points
due_date
position
created_at
updated_at
```

Keep `project_id` on the task even though the project can also be derived through the column.

It simplifies validation and querying.

---

# 32. ChecklistItem

```text
id
task_id
title
is_completed
position
created_at
updated_at
```

---

# 33. Label

```text
id
project_id
name
colour
created_at
```

---

# 34. TaskLabel

Association table:

```text
task_id
label_id
```

---

# 35. Database requirements

Use:

**SQLAlchemy ORM**

The application must remain database-agnostic.

Do not:

- write raw PostgreSQL-specific queries
- use database-specific enum types
- depend upon PostgreSQL JSON operators
- rely upon vendor-specific generated columns
- use vendor-specific locking features for core functionality

Use standard SQLAlchemy abstractions.

SQLAlchemy's current 2.x ORM supports both standard ORM usage and asyncio integrations; keep session lifetimes isolated to an operation and never share a single `AsyncSession` across concurrent work.

---

# 36. Database configuration

Database connection must come from:

```text
DATABASE_URL
```

Example local configuration:

```text
SQLite
```

Production-like configuration should be able to use:

```text
PostgreSQL
```

without changing domain/application code.

SQLite should be the default local development database.

Use Alembic migrations.

---

# 37. Backend architecture

Use clear separation:

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── models/
│   ├── schemas/
│   ├── repositories/
│   ├── services/
│   ├── workers/
│   └── main.py
├── migrations/
├── tests/
└── pyproject.toml
```

Responsibilities:

### API

HTTP-specific logic.

### Schemas

Pydantic request/response contracts.

### Services

Business logic.

### Repositories

Database access.

### Models

SQLAlchemy entities.

### Workers

Board action queue processor.

Do not place business logic directly inside FastAPI route handlers.

---

# 38. REST API

Use:

`/api`

as the base prefix.

---

## Projects

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
PATCH  /api/projects/{project_id}
DELETE /api/projects/{project_id}
```

---

## Board

Provide one board endpoint optimised for frontend rendering:

```http
GET /api/projects/{project_id}/board
```

Response should contain:

```text
project
columns
tasks
labels
checklists
```

or an equivalent nested representation.

Avoid forcing the frontend to make one request per column.

---

## Columns

```http
POST   /api/projects/{project_id}/columns
PATCH  /api/columns/{column_id}
DELETE /api/columns/{column_id}
```

Column reordering should go through the BoardAction mechanism.

---

## Tasks

```http
POST   /api/projects/{project_id}/tasks
GET    /api/tasks/{task_id}
PATCH  /api/tasks/{task_id}
DELETE /api/tasks/{task_id}
```

---

## Checklist

```http
POST   /api/tasks/{task_id}/checklist
PATCH  /api/checklist/{item_id}
DELETE /api/checklist/{item_id}
```

---

## Labels

```http
GET    /api/projects/{project_id}/labels
POST   /api/projects/{project_id}/labels
PATCH  /api/labels/{label_id}
DELETE /api/labels/{label_id}
```

---

# 39. Board commands

Task movement:

```http
POST /api/projects/{project_id}/actions/move-task
```

Example:

```json
{
  "task_id": "task-id",
  "target_column_id": "column-id",
  "target_position": 2,
  "idempotency_key": "uuid"
}
```

Response:

```http
202 Accepted
```

```json
{
  "action_id": "action-id",
  "status": "PENDING"
}
```

Column movement:

```http
POST /api/projects/{project_id}/actions/move-column
```

---

# 40. Action status endpoint

Provide:

```http
GET /api/actions/{action_id}
```

Example:

```json
{
  "id": "...",
  "status": "COMPLETED"
}
```

TanStack Query can poll pending operations briefly when required.

Avoid constant board polling.

---

# 41. Frontend architecture

Recommended:

```text
frontend/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── board/
│   │   ├── task/
│   │   └── project/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── queries/
│   ├── lib/
│   └── main.jsx
└── tests/
```

---

# 42. Central services layer

Every backend request must go through a frontend service layer.

Example:

```text
services/
├── apiClient.js
├── projectService.js
├── boardService.js
├── taskService.js
└── labelService.js
```

React components must NOT directly call:

```javascript
fetch(...)
```

or Axios.

Components call services/hooks.

---

# 43. Server state

Use TanStack Query for:

- projects
- boards
- tasks
- mutations
- cache invalidation
- optimistic updates

Do not duplicate API data into a large global React context.

Use local component state for purely visual state such as:

- drawer open state
- currently dragged task
- modal visibility

---

# 44. Empty states

Empty states matter.

## No projects

```text
Your workspace is empty

Create your first project and start moving work forward.

[ Create project ]
```

## Empty column

```text
Drop tasks here

+ Add task
```

These should feel intentional rather than broken.

---

# 45. Responsive behaviour

Tasklane is primarily desktop-oriented because Kanban boards naturally require horizontal space.

Still support:

### Tablet

Horizontal scrolling board.

### Mobile

- compact top bar
- horizontal board scrolling
- columns approximately 80–90vw
- task drawer becomes full-screen sheet

Do not attempt to stack all columns vertically on mobile.

Preserve the Kanban mental model.

---

# 46. Accessibility

Minimum requirements:

- visible focus state
- keyboard-accessible forms
- semantic buttons
- labelled form controls
- sufficient colour contrast
- colour must not be the only priority indicator
- drag handles should have accessible labels

Where practical provide keyboard movement controls as an enhancement.

---

# 47. Feedback states

Support:

- loading skeleton
- empty state
- error state
- optimistic mutation state
- action-processing state

Do not block the entire board during a task movement.

---

# 48. Animations

Animations should be short and purposeful.

Approximately:

`120–200ms`

Use for:

- drawer
- card movement
- hover transitions
- modal transitions

Avoid decorative animation.

---

# 49. Testing

## Backend

Use pytest.

Minimum tests:

- create project
- create custom columns
- create task
- update task
- checklist CRUD
- labels
- moving task between columns
- reordering task
- reordering column
- duplicate idempotency key
- pending action recovery
- failed action retry
- project deletion

---

## Frontend

Use:

- Vitest
- React Testing Library

Test:

- project dashboard
- project creation
- board rendering
- task drawer
- checklist interaction
- optimistic task movement
- failed movement reconciliation
- loading/error states

Do not attempt to unit-test the internals of dnd-kit.

Test the application's behaviour.

---

# 50. Docker

The repository should support:

```bash
docker compose up --build
```

Suggested structure:

```text
tasklane/
├── frontend/
├── backend/
├── docker-compose.yml
├── .env.example
└── README.md
```

Docker Compose should run:

```text
frontend
backend
```

SQLite can initially be persisted through a Docker volume.

Database selection remains configurable using `DATABASE_URL`.

---

# 51. Seed data

Development mode should optionally seed:

### Project

`Tasklane Development`

### Columns

```text
Backlog
To Do
In Progress
Review
Done
```

### Sample tasks

Include examples showing:

- priorities
- labels
- story points
- checklists
- due dates

This makes visual testing much easier.

---

# 52. Backlog — explicitly out of MVP

Document these features but DO NOT implement them unless specifically requested later:

- Authentication
- User accounts
- Multi-user collaboration
- Project sharing
- Real-time WebSockets
- Comments
- Attachments
- Notifications
- Mentions
- Activity history
- Audit log
- Archived projects
- Archived tasks
- Email integration
- Calendar integration
- GitHub integration
- External webhooks
- Templates
- Dark mode
- Analytics
- Time tracking
- Advanced filtering
- Saved views
- Swimlanes
- Automation rules

These are future Tasklane backlog items.

---

# 53. MVP acceptance criteria

The MVP is complete when a user can:

1. Open Tasklane.
2. See all projects.
3. Create a project.
4. Open its board.
5. Create different workflow columns.
6. Rename and reorder columns.
7. Create tasks.
8. Add descriptions.
9. Assign priority.
10. Assign story points.
11. Add labels.
12. Add checklist/subtasks.
13. Add a due date.
14. Open task details in a right-side drawer.
15. Drag tasks within a column.
16. Drag tasks between columns.
17. See the move immediately through optimistic UI.
18. Have moves safely persisted through the durable BoardAction queue.
19. Refresh the browser without losing state.
20. Restart the backend without losing acknowledged pending board actions.
21. Run the entire application locally with Docker Compose.

---

# 54. UX definition of done

The product should feel:

**quiet, responsive and intentional.**

A user should be able to understand how Tasklane works without instructions.

The primary workflow should be:

```text
Project
   ↓
Board
   ↓
Task
   ↓
Move
   ↓
Done
```

Every additional design decision should support that workflow rather than add complexity.