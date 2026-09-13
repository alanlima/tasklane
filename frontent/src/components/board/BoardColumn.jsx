import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TaskCard } from "../task/TaskCard";

export function BoardColumn({ column, index, tasks, labels, onTaskOpen, onTaskDragStart, onDrop, onMove, onAddTask }) {
  return <section className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={() => onDrop(column.id)}><header className="column-heading"><div><span className="column-dot" /><strong>{column.name}</strong><span className="count">{tasks.length}</span></div><div className="column-actions"><button className="tiny-button" aria-label={`Move ${column.name} left`} onClick={() => onMove(index, -1)}><ChevronLeft size={15} /></button><button className="tiny-button" aria-label={`Move ${column.name} right`} onClick={() => onMove(index, 1)}><ChevronRight size={15} /></button></div></header><div className="task-stack">{tasks.map((task) => <TaskCard key={task.id} task={task} labels={labels} onOpen={onTaskOpen} onDragStart={onTaskDragStart} />)}{tasks.length === 0 && <div className="column-empty">Drop tasks here</div>}</div><button className="add-task-link" onClick={() => onAddTask(column.id)}><Plus size={15} /> Add task</button></section>;
}
