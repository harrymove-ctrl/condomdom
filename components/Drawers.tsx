"use client";
// Item panels on <dialog> (DESIGN.md §7, §10), in three modes: side (a right-hand drawer), center (a card over the
// blurred page) and full (the whole page, content in a reading column). Focus moves in, esc closes, focus returns.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KINDS, KIND_PLURAL, PRICINGS, PRICING_LABEL, STATUSES, STATUS_LABEL, STATUS_MARK, type Item, type Stage } from "@/lib/types";
import { Preview } from "./Preview";

export const PANEL_MODES = ["side", "center", "full"] as const;
export type PanelMode = (typeof PANEL_MODES)[number];

/** The side · center · full switch in a panel's header. */
export function ModeSwitch({ mode, onMode }: { mode: PanelMode; onMode: (m: PanelMode) => void }) {
  return (
    <div className="mode-switch" role="group" aria-label="how to show this">
      {PANEL_MODES.map((m) => (
        <button key={m} aria-pressed={mode === m} onClick={() => onMode(m)} title={`show as ${m} (m cycles)`}>{m}</button>
      ))}
    </div>
  );
}

function Drawer({ open, mode, onClose, label, children }: { open: boolean; mode: PanelMode; onClose: () => void; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLElement | null>(null); // what had focus before, to return it on close
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { back.current = document.activeElement as HTMLElement | null; d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref} className={`panel panel-${mode}`} aria-label={label}
      onClose={() => { back.current?.focus?.(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {open && <div className="panel-body">{children}</div>}
    </dialog>
  );
}

/** An item in full: what it is, its preview, why you keep it, where it is. Used by the drawer and the explorer. */
export function ItemDetail({ item, stage, onEdit, onClose, mode, onMode }: {
  item: Item; stage?: Stage; onEdit: (it: Item) => void; onClose?: () => void; mode?: PanelMode; onMode?: (m: PanelMode) => void;
}) {
  return (
    <>
      {mode && onMode && (
        <div className="panel-head">
          <ModeSwitch mode={mode} onMode={onMode} />
          {onClose && <button className="btn ghost" onClick={onClose} aria-label="close">esc ×</button>}
        </div>
      )}
      <div className="kicker">
        <span><span className={`mark ${item.status}`} aria-hidden="true">{STATUS_MARK[item.status]}</span>{STATUS_LABEL[item.status]}</span>
        <span>{KIND_PLURAL[item.kind].replace(/s$/, "")}{item.group ? ` / ${item.group}` : ""}</span>
        <span>{stage?.label.toLowerCase() ?? item.stage}</span>
        {item.pricing && item.pricing !== "unknown" && <span className={`price ${item.pricing}`}>{PRICING_LABEL[item.pricing]}</span>}
        <span>{item.added}</span>
      </div>
      <h2>{item.title}</h2>
      {item.summary && <p>{item.summary}</p>}
      <Preview key={item.id} item={item} size="large" />
      {item.note && <p className="note">{item.note}</p>}
      {item.tags.length > 0 && <div className="tags">{item.tags.map((t) => <span key={t}>#{t}</span>)}</div>}
      <div className="links">
        {item.url && <a className="btn primary" href={item.url} target="_blank" rel="noopener">open ↗</a>}
        {item.also?.length ? (
          <p className="also">also: {item.also.map((a, i) => <span key={a.url}>{i ? " · " : ""}<a href={a.url} target="_blank" rel="noopener">{a.label} ↗</a></span>)}</p>
        ) : null}
        {item.check && <p className="hint">⚠ couldn&apos;t check this link: {item.check}. it may still open fine in your browser.</p>}
        {item.path && <span className="hint">folder: <code>{item.path}</code></span>}
        {item.file && <span className="hint">file: <code>{item.file}</code></span>}
      </div>
      <div className="actions">
        <button className="btn" onClick={() => onEdit(item)}>edit</button>
        <span className="spacer" />
        {onClose && !mode && <button className="btn" onClick={onClose}>close</button>}
      </div>
    </>
  );
}

export function DetailDrawer({ item, stage, mode, onMode, onClose, onEdit }: {
  item: Item | null; stage?: Stage; mode: PanelMode; onMode: (m: PanelMode) => void; onClose: () => void; onEdit: (it: Item) => void;
}) {
  return (
    <Drawer open={!!item} mode={mode} onClose={onClose} label={item?.title ?? "item"}>
      {item && <ItemDetail item={item} stage={stage} onEdit={onEdit} onClose={onClose} mode={mode} onMode={onMode} />}
    </Drawer>
  );
}

export type Saved = { item: Item; created: boolean } | { deleted: Item };

export function EditorDrawer({ open, item, stages, groups, defaults, mode, onMode, onClose, onSaved }: {
  open: boolean;
  groups: string[];
  mode: PanelMode;
  onMode: (m: PanelMode) => void;
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
    <Drawer open={open} mode={mode} onClose={onClose} label={item ? "edit item" : "add to the library"}>
      <div className="panel-head"><ModeSwitch mode={mode} onMode={onMode} /><button className="btn ghost" onClick={onClose} aria-label="close">esc ×</button></div>
      <form className="editor" onSubmit={save} key={item?.id ?? "new"}>
        <h2>{item ? "edit item" : "add to the library"}</h2>
        <label>title<input name="title" required autoFocus defaultValue={v.title ?? ""} /></label>
        <div className="fields">
          <label>kind<select name="kind" defaultValue={v.kind ?? "component"}>{KINDS.map((k) => <option key={k} value={k}>{KIND_PLURAL[k].replace(/s$/, "")}</option>)}</select></label>
          <label>stage<select name="stage" defaultValue={v.stage ?? "build"}>{stages.map((s) => <option key={s.id} value={s.id}>{s.label.toLowerCase()}</option>)}</select></label>
          <label>pricing<select name="pricing" defaultValue={v.pricing ?? "unknown"}>{PRICINGS.map((p) => <option key={p} value={p}>{PRICING_LABEL[p]}</option>)}</select></label>
          <label>status<select name="status" defaultValue={v.status ?? "to-try"}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></label>
        </div>
        <label>group <small>a category inside its kind, e.g. animated-react, svelte: pick one or type a new one</small>
          <input name="group" list="groups" placeholder="animated-react" defaultValue={v.group ?? ""} />
          <datalist id="groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        </label>
        <label>link <small>its logo becomes the ascii preview</small><input name="url" type="url" placeholder="https://" defaultValue={v.url ?? ""} /></label>
        <label>folder <small>a skill or project on this Mac: its files become the preview</small><input name="path" placeholder="~/.agents/skills/…" defaultValue={v.path ?? ""} /></label>
        <label>video file <small>anywhere in your home folder or on the Dev drive</small><input name="file" placeholder="~/Downloads/demo.mp4" defaultValue={v.file ?? ""} /></label>
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
