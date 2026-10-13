"use client";
// The explorer (DESIGN.md §7): your collections as a tree on the left, the chosen resource on the right, large:
// a skill's real file tree, a site's logo, a video's frame and player. Arrow keys move through the tree.
import { useEffect, useMemo, useRef } from "react";
import { KINDS, KIND_PLURAL, STATUS_MARK, STATUS_RANK, type Item, type Stage } from "@/lib/types";
import { Ascii } from "ascii.rest/react";
import { ItemDetail } from "./Drawers";
import { drawTree } from "./Preview";

const SOURCE_LABEL = (it: Item) => (it.file ? "video" : it.path ? "folder" : it.url ? "link" : "note");

export function Explorer({ items, stages, selected, onSelect, onEdit }: {
  items: Item[];
  stages: Stage[];
  selected: string | null;
  onSelect: (id: string) => void;
  onEdit: (it: Item) => void;
}) {
  // kind/ → group/ → files. Items without a group sit directly in their kind's folder, after the groups.
  const folders = useMemo(() => KINDS
    .map((k) => {
      const inKind = items.filter((i) => i.kind === k).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));
      const names = [...new Set(inKind.map((i) => i.group).filter((g): g is string => !!g))].sort();
      return {
        kind: k, items: inKind,
        groups: names.map((g) => ({ name: g, items: inKind.filter((i) => i.group === g) })),
        loose: inKind.filter((i) => !i.group),
      };
    })
    .filter((f) => f.items.length), [items]);
  const order = useMemo(() => folders.flatMap((f) => [...f.groups.flatMap((g) => g.items), ...f.loose].map((i) => i.id)), [folders]);
  // Nothing chosen (or "condomdom/" clicked) shows the whole library as a file tree.
  const current = items.find((i) => i.id === selected) ?? null;
  const fileName = (it: Item) => `${it.id.length > 24 ? it.id.slice(0, 23) + "…" : it.id}${it.file ? ".mp4" : it.path ? "/" : ".md"}`;
  // The animated piece has room for 21 lines: each folder with its first three files (core first).
  // The animated piece: each kind with its groups as folders (and their sizes), or its first files when it has none.
  const overview = useMemo(() => folders.map((f) => [
    `${KIND_PLURAL[f.kind]}/`,
    ...(f.groups.length
      ? f.groups.map((g) => `  ${g.name}/ (${g.items.length})`)
      : [...f.items.slice(0, 3).map((it) => `  ${fileName(it)}`), ...(f.items.length > 3 ? [`  +${f.items.length - 3} more`] : [])]),
  ].join("\n")).join("\n"), [folders]);
  const everything = useMemo(() => folders.map((f) => [
    `${KIND_PLURAL[f.kind]}/`,
    ...f.groups.flatMap((g) => [`  ${g.name}/`, ...g.items.map((it) => `    ${fileName(it)}`)]),
    ...f.loose.map((it) => `  ${fileName(it)}`),
  ].join("\n")).join("\n"), [folders]);
  const treeRef = useRef<HTMLElement>(null);

  // Keep the chosen file in view as the arrows move it.
  useEffect(() => {
    treeRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(current?.id ?? "")}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current?.id]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = current ? order.indexOf(current.id) : -1;
    const next = order[Math.max(0, Math.min(order.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) { onSelect(next); treeRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(next)}"]`)?.focus(); }
  };

  const leaf = (it: Item) => (
    <li key={it.id}>
      <button className="leaf" data-id={it.id} aria-current={current?.id === it.id} onClick={() => onSelect(it.id)} title={it.title}>
        <span className={`mark ${it.status}`} aria-hidden="true">{STATUS_MARK[it.status]}</span>
        <span className="name">{it.title}</span>
        <span className="src">{SOURCE_LABEL(it)}</span>
      </button>
    </li>
  );

  if (!items.length) return <div className="state"><p>nothing to explore yet. press <kbd>n</kbd> to add something.</p></div>;

  return (
    <section className="explorer" aria-label="explorer">
      <nav className="explorer-tree" ref={treeRef} aria-label="collections" onKeyDown={onKey}>
        <button className="tree-root" aria-current={!current} onClick={() => onSelect("")} title="the whole library">condomdom/ <span className="count">{items.length}</span></button>
        <ul className="tree">
          {folders.map((f) => (
            <li key={f.kind}>
              <details open>
                <summary><span className="folder">{KIND_PLURAL[f.kind]}/</span><span className="count">{f.items.length}</span></summary>
                <ul>
                  {f.groups.map((g) => (
                    <li key={g.name}>
                      <details open>
                        <summary><span className="folder">{g.name}/</span><span className="count">{g.items.length}</span></summary>
                        <ul>{g.items.map(leaf)}</ul>
                      </details>
                    </li>
                  ))}
                  {f.loose.map(leaf)}
                </ul>
              </details>
            </li>
          ))}
        </ul>
      </nav>
      <article className="explorer-pane" aria-live="polite">
        {current ? <ItemDetail item={current} stage={stages.find((s) => s.id === current.stage)} onEdit={onEdit} /> : (
          <div className="overview">
            <p className="kicker"><span>the whole library</span><span>{folders.length} collections</span><span>{items.length} items</span></p>
            <h2>condomdom/</h2>
            <div className="preview large tree">
              <Ascii piece="file-tree" options={{ root: "condomdom/", entries: overview }} className="ascii" label="the library as a file tree" />
            </div>
            <p className="hint">pick a file on the left to open it: a skill shows its own folder, a link its logo, a video a frame and the player. ↑ ↓ move through the tree.</p>
            <details className="all-files">
              <summary>every file ({items.length})</summary>
              <pre className="static-tree">{drawTree("condomdom/", everything)}</pre>
            </details>
          </div>
        )}
      </article>
    </section>
  );
}
