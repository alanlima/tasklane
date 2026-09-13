import { useState } from "react";
import { ArrowLeft, Check, Plus, Tags, Trash2 } from "lucide-react";

export function ProjectSettingsPage({ project, onBack, onSave, onLabels }) {
  const [section, setSection] = useState("general");
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [labelName, setLabelName] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [labelError, setLabelError] = useState("");
  const [labelAction, setLabelAction] = useState("");

  const edit = (setter) => (event) => { setter(event.target.value); setStatus("idle"); setError(""); };
  const submit = async (event) => {
    event.preventDefault(); if (!name.trim()) return setError("Project name is required."); setStatus("saving"); setError("");
    try { await onSave({ name: name.trim(), description: description.trim() }); setStatus("saved"); }
    catch { setStatus("idle"); setError("Could not save project settings. Please try again."); }
  };
  const addLabel = async (event) => {
    event.preventDefault(); if (!labelName.trim()) return; setLabelAction("create"); setLabelError("");
    try { await onLabels("createLabel", project.id, labelName.trim()); setLabelName(""); }
    catch { setLabelError("Could not create that label. Please try again."); }
    finally { setLabelAction(""); }
  };
  const renameLabel = async (label, event) => {
    const nextName = event.target.value.trim(); if (!nextName || nextName === label.name) return;
    setLabelAction(`rename-${label.id}`); setLabelError("");
    try { await onLabels("updateLabel", label.id, nextName, label.colour); }
    catch { event.target.value = label.name; setLabelError(`Could not rename “${label.name}”. Your previous name was restored.`); }
    finally { setLabelAction(""); }
  };
  const deleteLabel = async (label) => {
    setLabelAction(`delete-${label.id}`); setLabelError("");
    try { await onLabels("deleteLabel", label.id); }
    catch { setLabelError(`Could not delete “${label.name}”. Please try again.`); }
    finally { setLabelAction(""); }
  };

  return <main className="page settings-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Back to board</button><p className="eyebrow">Project settings</p><h1>{section === "general" ? "General" : "Labels"}</h1><nav className="settings-menu" aria-label="Project settings"><button className={section === "general" ? "chosen" : ""} onClick={() => setSection("general")}>General</button><button className={section === "labels" ? "chosen" : ""} onClick={() => setSection("labels")}><Tags size={15} /> Labels <span>{project.labels.length}</span></button></nav>{section === "general" ? <form className="settings-card form-stack" onSubmit={submit}><p className="settings-intro">Update the project details shown across your workspace.</p><label>Project name<input autoFocus value={name} onChange={edit(setName)} /></label><label>Description <em>optional</em><textarea value={description} onChange={edit(setDescription)} /></label>{error && <p role="alert">{error}</p>}<div><button className="primary-button" type="submit" disabled={status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button>{status === "saved" && <span className="saved"><Check size={14} /> Saved</span>}</div></form> : <section className="settings-card labels-card"><div className="labels-intro"><div className="labels-icon"><Tags size={18} /></div><div><h2>Make work easier to scan</h2><p>Create a label once, then add it to any task in this project.</p></div></div><form className="label-create-form" onSubmit={addLabel}><label htmlFor="new-label">New label</label><div><input id="new-label" value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="e.g. Design" /><button className="primary-button" aria-label="Create label" disabled={labelAction === "create"}><Plus size={16} /> {labelAction === "create" ? "Adding…" : "Add label"}</button></div></form>{labelError && <p className="label-error" role="alert">{labelError}</p>}<div className="label-list" aria-label="Project labels">{project.labels.length ? project.labels.map((label) => <div className="label-management-row" key={label.id}><span className="label-swatch" style={{ backgroundColor: label.colour }} aria-hidden="true" /><input aria-label={`Rename ${label.name}`} defaultValue={label.name} onBlur={(event) => renameLabel(label, event)} disabled={labelAction === `rename-${label.id}`} /><button className="delete-label-button" aria-label={`Delete ${label.name}`} disabled={labelAction === `delete-${label.id}`} onClick={() => deleteLabel(label)}><Trash2 size={15} /> {labelAction === `delete-${label.id}` ? "Deleting…" : "Delete"}</button></div>) : <p className="labels-empty">No labels yet. Create your first one above.</p>}</div></section>}</main>;
}
