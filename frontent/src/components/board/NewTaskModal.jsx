import { useState } from "react";
import { Modal } from "../ui/Modal";
export function NewTaskModal({ onCreate, onClose }) { const [title, setTitle] = useState(""); const submit = (event) => { event.preventDefault(); if (title.trim()) onCreate(title.trim()); }; return <Modal title="Add task" onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Task title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to be done?" /></label><button className="primary-button">Create task</button></form></Modal>; }
