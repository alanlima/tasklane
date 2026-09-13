import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";

export function ProjectSettingsPage({ project, onBack, onSave }) {
  const [name, setName] = useState(project.name); const [description, setDescription] = useState(project.description ?? ""); const [status, setStatus] = useState("idle"); const [error, setError] = useState("");
  const submit = async (event) => { event.preventDefault(); if (!name.trim()) { setError("Project name is required."); return; } setStatus("saving"); setError(""); try { await onSave({ name: name.trim(), description: description.trim() }); setStatus("saved"); } catch { setStatus("idle"); setError("Could not save project settings. Please try again."); } };
  return <main className="page settings-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Back to board</button><p className="eyebrow">Project settings</p><h1>General</h1><p>Update the project details shown across your workspace.</p><form className="settings-card form-stack" onSubmit={submit}><label>Project name<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label>Description <em>optional</em><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<div><button className="primary-button" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button>{status === "saved" && <span className="saved"><Check size={14} /> Saved</span>}</div></form></main>;
}
