"use client";
// Right-hand drawers on <dialog> (DESIGN.md §7, §10): focus moves in, esc closes, focus returns.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KINDS, KIND_PLURAL, STATUSES, STATUS_LABEL, STATUS_MARK, type Item, type Stage } from "@/lib/types";
import { Thumb } from "./Thumb";

function Drawer({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null); // what had focus before, to return it on close
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { back.current = document.activeElement as HTMLElement | null; d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref} className="drawer" aria-label={label}
      onClose={() => { back.current?.focus?.(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open && children}
    </dialog>
  );
}

export function DetailDrawer({ item, stage, onClose, onEdit }: { item: Item | null; stage?: Stage; onClose: () => void; onEdit: (it: Item) => void }) {
  return (
    <Drawer open={!!item} onClose={onClose} label={item?.title ?? "item"}>
      {item && (
        <>
          <div className="kicker">
            <span><span className={`mark ${item.status}`} aria-hidden="true">{STATUS_MARK[item.status]}</span>{STATUS_LABEL[item.status]}</span>
            <span>{KIND_PLURAL[item.kind].replace(/s$/, "")}</span>
            <span>{stage?.label.toLowerCase() ?? item.stage}</span>
            <span>{item.added}</span>
          </div>
          <h2>{item.title}</h2>
          {item.summary && <p>{item.summary}</p>}
          {item.url && <Thumb item={item} big />}
          {item.file && (
            <>
              <video src={`/${item.file}`} controls preload="metadata" />
              <p className="hint">no picture? put the file at <code>{item.file}</code>.</p>
            </>
          )}
          {item.note && <p className="note">{item.note}</p>}
          {item.tags.length > 0 && <div className="tags">{item.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
          <div className="links">
            {item.url && <a className="btn primary" href={item.url} target="_blank" rel="noopener">open ↗</a>}
            {item.path && <span className="hint">local: <code>{item.path}</code></span>}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => onEdit(item)}>edit</button>
            <span className="spacer" />
            <button className="btn" onClick={onClose}>close</button>
          </div>
        </>
      )}
    </Drawer>
  );
}

export type Saved = { item: Item; created: boolean } | { deleted: Item };

export function EditorDrawer({ open, item, stages, defaults, onClose, onSaved }: {
  open: boolean;
  item: Item | null;
  stages: Stage[];
  defaults: Partial<Item>;
  onClose: () => void;
  onSaved: (s: Saved) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setError(null); }, [open]);
  const v = item ?? defaults;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const data = Object.fromEntries(new FormData(e.currentTarget));
      const res = await fetch(item ? `/api/items/${encodeURIComponent(item.id)}` : "/api/items", {
        method: item ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
      });
      const out = await res.json();
      if (!res.ok) return setError(out.error ?? "couldn't save");
      onSaved({ item: out, created: !item });
    } catch {
      setError("couldn't reach the server. is pnpm dev still running?");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (!item || !confirm(`delete “${item.title}” from the library?`)) return;
    const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return setError("delete failed. is the server running?");
    onSaved({ deleted: item });
  }

  return (
    <Drawer open={open} onClose={onClose} label={item ? "edit item" : "add to the library"}>
      <form className="editor" onSubmit={save} key={item?.id ?? "new"}>
        <h2>{item ? "edit item" : "add to the library"}</h2>
        <label>title<input name="title" required autoFocus defaultValue={v.title ?? ""} /></label>
        <div className="fields">
          <label>kind<select name="kind" defaultValue={v.kind ?? "component"}>{KINDS.map((k) => <option key={k} value={k}>{KIND_PLURAL[k].replace(/s$/, "")}</option>)}</select></label>
          <label>stage<select name="stage" defaultValue={v.stage ?? "build"}>{stages.map((s) => <option key={s.id} value={s.id}>{s.label.toLowerCase()}</option>)}</select></label>
          <label>status<select name="status" defaultValue={v.status ?? "to-try"}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        </div>
        <label>link <small>its share image becomes the ascii preview</small><input name="url" type="url" placeholder="https://" defaultValue={v.url ?? ""} /></label>
        <label>local path <small>skill folder, project</small><input name="path" placeholder="~/.agents/skills/…" defaultValue={v.path ?? ""} /></label>
        <label>video file <small>inside media/videos</small><input name="file" placeholder="media/videos/demo.mp4" defaultValue={v.file ?? ""} /></label>
        <label>what it is<input name="summary" defaultValue={v.summary ?? ""} /></label>
        <label>why i keep it / how i use it<textarea name="note" rows={3} defaultValue={v.note ?? ""} /></label>
        <label>tags <small>comma separated</small><input name="tags" placeholder="react, motion" defaultValue={(v.tags ?? []).join(", ")} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          {item && <button type="button" className="btn danger" onClick={remove}>delete</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? "saving…" : "save"}</button>
        </div>
      </form>
    </Drawer>
  );
}
