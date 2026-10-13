"use client";
// The library's structure, on the left (DESIGN.md §6, §7): ascii.rest's file-tree piece drawn from the real
// library, and under it the same tree as text you can use: a folder filters the table, a file opens the item.
import { useMemo } from "react";
import { Ascii } from "ascii.rest/react";
import { KINDS, KIND_PLURAL, STATUS_MARK, STATUS_RANK, type Item, type Kind } from "@/lib/types";

const PER_FOLDER = 3; // the piece is 23 rows: five folders of three files fit

const fileName = (it: Item) => {
  const base = it.id.length > 22 ? it.id.slice(0, 21) + "…" : it.id;
  return `${base}.${it.kind === "video" ? "mp4" : it.kind === "skill" ? "skill" : "md"}`;
};

export function Sidebar({ items, activeKind, onKind, onOpen }: {
  items: Item[];
  activeKind: Kind | null;
  onKind: (k: Kind | null) => void;
  onOpen: (id: string) => void;
}) {
  const folders = useMemo(() => KINDS
    .map((k) => ({
      kind: k,
      items: items.filter((i) => i.kind === k)
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title)),
    }))
    .filter((f) => f.items.length), [items]);

  // The ascii tree: core items first in each folder, then "+n more".
  const entries = useMemo(() => folders.map((f) => {
    const shown = f.items.slice(0, PER_FOLDER).map((it) => `  ${fileName(it)}`);
    const more = f.items.length > PER_FOLDER ? [`  +${f.items.length - PER_FOLDER} more`] : [];
    return [`${KIND_PLURAL[f.kind]}/`, ...shown, ...more].join("\n");
  }).join("\n"), [folders]);

  return (
    <aside className="sidebar" aria-label="library structure">
      <div className="tree-art" aria-hidden="true">
        <Ascii piece="file-tree" options={{ root: "condomdom/", entries }} className="ascii" />
      </div>
      <p className="side-label">structure</p>
      <ul className="tree">
        {folders.map((f) => (
          <li key={f.kind}>
            <details open={activeKind === f.kind}>
              <summary>
                <button
                  className="folder-btn"
                  aria-pressed={activeKind === f.kind}
                  onClick={(e) => { e.preventDefault(); onKind(activeKind === f.kind ? null : f.kind); }}
                  title={`show only ${KIND_PLURAL[f.kind]}`}
                >
                  {KIND_PLURAL[f.kind]}/
                </button>
                <span className="count">{f.items.length}</span>
              </summary>
              <ul>
                {f.items.map((it) => (
                  <li key={it.id}>
                    <button className="leaf" onClick={() => onOpen(it.id)} title={it.title}>
                      <span className={`mark ${it.status}`} aria-hidden="true">{STATUS_MARK[it.status]}</span>
                      <span className="name">{it.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </aside>
  );
}
