import { useState } from "react";
import { Archive, ArrowLeft, Check, Plus, RotateCcw, Tags, Trash2 } from "lucide-react";

export function ProjectSettingsPage({ project, onBack, onSave, onLabels, onGetArchiveSummary, onArchive, onRestore, onDelete }) {
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

  const readOnly = project.is_archived;
  return <main className="page settings-page"><button className="back-link" onClick={onBack}><ArrowLeft size={17} /> Back to board</button><p className="eyebrow">Project settings</p><h1>{section === "general" ? "General" : "Labels"}</h1><nav className="settings-menu" aria-label="Project settings"><button className={section === "general" ? "chosen" : ""} onClick={() => setSection("general")}>General</button><button className={section === "labels" ? "chosen" : ""} onClick={() => setSection("labels")}><Tags size={15} /> Labels <span>{project.labels.length}</span></button></nav>{section === "general" ? <><form className="settings-card form-stack" onSubmit={submit}><p className="settings-intro">{readOnly ? "Archived projects are read-only. Restore it below to make changes." : "Update the project details shown across your workspace."}</p><label>Project name<input autoFocus value={name} onChange={edit(setName)} disabled={readOnly} /></label><label>Description <em>optional</em><textarea value={description} onChange={edit(setDescription)} disabled={readOnly} /></label>{error && <p role="alert">{error}</p>}<div><button className="primary-button" type="submit" disabled={readOnly || status === "saving"}>{status === "saving" ? "Saving…" : "Save changes"}</button>{status === "saved" && <span className="saved"><Check size={14} /> Saved</span>}</div></form><ProjectLifecycle project={project} onGetArchiveSummary={onGetArchiveSummary} onArchive={onArchive} onRestore={onRestore} onDelete={onDelete} /></> : <section className="settings-card labels-card"><div className="labels-intro"><div className="labels-icon"><Tags size={18} /></div><div><h2>Make work easier to scan</h2><p>{readOnly ? "Restore this project to manage its labels." : "Create a label once, then add it to any task in this project."}</p></div></div><form className="label-create-form" onSubmit={addLabel}><label htmlFor="new-label">New label</label><div><input id="new-label" value={labelName} onChange={(event) => setLabelName(event.target.value)} placeholder="e.g. Design" disabled={readOnly} /><button className="primary-button" aria-label="Create label" disabled={readOnly || labelAction === "create"}><Plus size={16} /> {labelAction === "create" ? "Adding…" : "Add label"}</button></div></form>{labelError && <p className="label-error" role="alert">{labelError}</p>}<div className="label-list" aria-label="Project labels">{project.labels.length ? project.labels.map((label) => <div className="label-management-row" key={label.id}><span className="label-swatch" style={{ backgroundColor: label.colour }} aria-hidden="true" /><input aria-label={`Rename ${label.name}`} defaultValue={label.name} onBlur={(event) => renameLabel(label, event)} disabled={readOnly || labelAction === `rename-${label.id}`} /><button className="delete-label-button" aria-label={`Delete ${label.name}`} disabled={readOnly || labelAction === `delete-${label.id}`} onClick={() => deleteLabel(label)}><Trash2 size={15} /> {labelAction === `delete-${label.id}` ? "Deleting…" : "Delete"}</button></div>) : <p className="labels-empty">No labels yet. Create your first one above.</p>}</div></section>}</main>;
}

function ProjectLifecycle({ project, onGetArchiveSummary, onArchive, onRestore, onDelete }) {
  const [summary, setSummary] = useState(null); const [mode, setMode] = useState(""); const [typedName, setTypedName] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const prepareArchive = async () => { setError(""); setBusy(true); try { setSummary(await onGetArchiveSummary()); setMode("archive"); } catch { setError("Could not check project tasks. Please try again."); } finally { setBusy(false); } };
  const archive = async () => { setBusy(true); setError(""); try { await onArchive(); } catch { setError("Could not archive this project. Please try again."); setBusy(false); } };
  const restore = async () => { setBusy(true); setError(""); try { await onRestore(); } catch { setError("Could not restore this project. Please try again."); setBusy(false); } };
  const remove = async () => { setBusy(true); setError(""); try { await onDelete(typedName); } catch { setError("The project name did not match, or deletion could not be completed."); setBusy(false); } };
  return <section className="settings-card lifecycle-card"><div><p className="eyebrow">Project lifecycle</p><h2>{project.is_archived ? "Archived project" : "Archive or delete"}</h2><p>{project.is_archived ? "This project is hidden from the active dashboard and its board is read-only." : "Archive completed work to hide it from the dashboard, or permanently delete it."}</p></div>{error && <p role="alert" className="label-error">{error}</p>}<div className="lifecycle-actions">{project.is_archived ? <button className="secondary-button" onClick={restore} disabled={busy}><RotateCcw size={16} /> Restore project</button> : <button className="secondary-button" onClick={prepareArchive} disabled={busy}><Archive size={16} /> Archive project</button>}<button className="danger-button" onClick={() => { setMode("delete"); setError(""); }} disabled={busy}><Trash2 size={16} /> Delete permanently</button></div>{mode === "archive" && <div className="confirmation-panel"><h3>Archive {project.name}?</h3><p>{summary?.incomplete_tasks ? `${summary.incomplete_tasks} incomplete of ${summary.total_tasks} tasks will remain on this read-only board.` : `All ${summary?.total_tasks ?? 0} tasks are complete.`}</p><div><button className="secondary-button" onClick={() => setMode("")}>Cancel</button><button className="primary-button" onClick={archive} disabled={busy}>Archive project</button></div></div>}{mode === "delete" && <div className="confirmation-panel danger-panel"><h3>Delete {project.name} permanently?</h3><p>This cannot be undone. Type the exact project name to continue.</p><label>Project name<input value={typedName} onChange={(event) => setTypedName(event.target.value)} /></label><div><button className="secondary-button" onClick={() => setMode("")}>Cancel</button><button className="danger-button" onClick={remove} disabled={busy || typedName !== project.name}>Delete permanently</button></div></div>}</section>;
}
