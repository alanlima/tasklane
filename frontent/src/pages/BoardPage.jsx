import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { api } from "../services/mockApi";
import { BoardColumn } from "../components/board/BoardColumn";
import { NewColumnModal } from "../components/board/NewColumnModal";
import { NewTaskModal } from "../components/board/NewTaskModal";
import { TaskDrawer } from "../components/task/TaskDrawer";

export function BoardPage({ project, onBack, onRefresh }) {
  const [activeTaskId, setActiveTaskId] = useState(null); const [draggedTaskId, setDraggedTaskId] = useState(null); const [newTaskColumn, setNewTaskColumn] = useState(null); const [newColumn, setNewColumn] = useState(false);
  const task = project.tasks.find((item) => item.id === activeTaskId); const doneColumn = project.columns.find((column) => column.name.toLowerCase() === "done"); const completeCount = doneColumn ? project.tasks.filter((item) => item.columnId === doneColumn.id).length : 0;
  const createTask = async (title) => { await api.createTask(project.id, { title, columnId: newTaskColumn }); setNewTaskColumn(null); onRefresh(); };
  const drop = async (columnId) => { if (!draggedTaskId) return; const moving = project.tasks.find((item) => item.id === draggedTaskId); if (moving.columnId !== columnId) await api.moveTask(project.id, draggedTaskId, columnId, project.tasks.filter((item) => item.columnId === columnId).length); setDraggedTaskId(null); onRefresh(); };
  const moveColumn = async (index, direction) => { const destination = index + direction; if (destination < 0 || destination >= project.columns.length) return; await api.reorderColumns(project.id, index, destination); onRefresh(); };
  const createColumn = async (name) => { await api.createColumn(project.id, name); setNewColumn(false); onRefresh(); };
  const saveTask = async (taskId, patch) => { await api.updateTask(project.id, taskId, patch); onRefresh(); };
  const toggleChecklistItem = async (item) => { await api.updateChecklistItem(item.id, { done: !item.done }); onRefresh(); };
  const createChecklistItem = async (taskId, title) => { await api.createChecklistItem(taskId, title); onRefresh(); };
  return <main className="board-page"><div className="board-heading"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Projects</button><div className="board-title-row"><div><p className="eyebrow">Project board</p><h1>{project.name}</h1><p>{project.tasks.length} tasks · {completeCount} completed</p></div><button className="primary-button" onClick={() => setNewTaskColumn(project.columns[0]?.id)}><Plus size={17} /> Add task</button></div></div><div className="board-scroll"><div className="board-columns">{project.columns.map((column, index) => <BoardColumn key={column.id} column={column} index={index} tasks={project.tasks.filter((item) => item.columnId === column.id).sort((a, b) => a.position - b.position)} labels={project.labels} onTaskOpen={setActiveTaskId} onTaskDragStart={setDraggedTaskId} onDrop={drop} onMove={moveColumn} onAddTask={setNewTaskColumn} />)}<section className="new-column"><button onClick={() => setNewColumn(true)}><Plus size={16} /> Add column</button></section></div></div>{newTaskColumn && <NewTaskModal onCreate={createTask} onClose={() => setNewTaskColumn(null)} />}{newColumn && <NewColumnModal onCreate={createColumn} onClose={() => setNewColumn(false)} />}{task && <TaskDrawer project={project} task={task} onClose={() => setActiveTaskId(null)} onSave={saveTask} onToggleChecklistItem={toggleChecklistItem} onCreateChecklistItem={createChecklistItem} />}</main>;
}
