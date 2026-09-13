import { useState } from "react";
import { Modal } from "../ui/Modal";
export function NewColumnModal({ onCreate, onClose }) { const [name, setName] = useState(""); const submit = (event) => { event.preventDefault(); if (name.trim()) onCreate(name.trim()); }; return <Modal title="Add column" onClose={onClose}><form className="form-stack" onSubmit={submit}><label>Column name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Testing" /></label><button className="primary-button">Add column</button></form></Modal>; }
