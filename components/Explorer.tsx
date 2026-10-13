"use client";
// The explorer (DESIGN.md §7): your collections as a tree on the left, the chosen resource on the right, large:
// a skill's real file tree, a site's logo, a video's frame and player. Arrow keys move through the tree.
import { useEffect, useMemo, useRef } from "react";
import { KINDS, KIND_PLURAL, STATUS_MARK, STATUS_RANK, type Item, type Stage } from "@/lib/types";
import { ItemDetail } from "./Drawers";

const SOURCE_LABEL = (it: Item) => (it.file ? "video" : it.path ? "folder" : it.url ? "link" : "note");

export function Explorer({ items, stages, selected, onSelect, onEdit }: {
  items: Item[];
  stages: Stage[];
  selected: string | null;
  onSelect: (id: string) => void;
  onEdit: (it: Item) => void;
}) {
  const folders = useMemo(() => KINDS
    .map((k) => ({ kind: k, items: items.filter((i) => i.kind === k).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title)) }))
    .filter((f) => f.items.length), [items]);
  const order = useMemo(() => folders.flatMap((f) => f.items.map((i) => i.id)), [folders]);
  const current = items.find((i) => i.id === selected) ?? items.find((i) => i.id === order[0]) ?? null;
  const treeRef = useRef<HTMLElement>(null);

  // Keep the chosen file in view as the arrows move it.
  useEffect(() => {
    treeRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(current?.id ?? "")}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = order.indexOf(current?.id ?? "");
    const next = order[Math.max(0, Math.min(order.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) { onSelect(next); treeRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next)}"]`)?.focus(); }
  };

  if (!items.length) return <div className="state"><p>nothing to explore yet. press <kbd>n</kbd> to add something.</p></div>;

  return (
    <section className="explorer" aria-label="explorer">
      <nav className="explorer-tree" ref={treeRef} aria-label="collections" onKeyDown={onKey}>
        <p className="tree-root">condomdom/</p>
        <ul className="tree">
          {folders.map((f) => (
            <li key={f.kind}>
              <details open>
                <summary><span className="folder">{KIND_PLURAL[f.kind]}/</span><span className="count">{f.items.length}</span></summary>
                <ul>
                  {f.items.map((it) => (
                    <li key={it.id}>
                      <button
                        className="leaf" data-id={it.id} aria-current={current?.id === it.id}
                        onClick={() => onSelect(it.id)} title={it.title}
                      >
                        <span className={`mark ${it.status}`} aria-hidden="true">{STATUS_MARK[it.status]}</span>
                        <span className="name">{it.title}</span>
                        <span className="src">{SOURCE_LABEL(it)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </nav>
      <article className="explorer-pane" aria-live="polite">
        {current && <ItemDetail item={current} stage={stages.find((s) => s.id === current.stage)} onEdit={onEdit} />}
      </article>
    </section>
  );
}
