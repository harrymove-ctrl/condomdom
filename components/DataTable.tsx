"use client";
// The library as a data table: sortable headers, hideable columns, pages of 15 (DESIGN.md §7).
import { KIND_PLURAL, PRICING_LABEL, STATUS_LABEL, STATUS_MARK, STATUS_RANK, type Item } from "@/lib/types";
import { Preview } from "./Preview";

export const TABLE_COLUMNS = [
  { id: "thumb", label: "preview", sortable: false },
  { id: "title", label: "title", sortable: true },
  { id: "kind", label: "kind", sortable: true },
  { id: "group", label: "group", sortable: true },
  { id: "pricing", label: "pricing", sortable: true },
  { id: "stage", label: "stage", sortable: true },
  { id: "status", label: "status", sortable: true },
  { id: "tags", label: "tags", sortable: false },
  { id: "added", label: "added", sortable: true },
] as const;
export type TableColumnId = (typeof TABLE_COLUMNS)[number]["id"];
export type Sort = { column: TableColumnId; dir: "asc" | "desc" };

const STAGE_ORDER = ["inspire", "design", "build", "ship", "learn"];
export const PAGE_SIZE = 15;

export function sortItems(items: Item[], sort: Sort) {
  const dir = sort.dir === "asc" ? 1 : -1;
  const key = (it: Item): string | number => {
    switch (sort.column) {
      case "status": return STATUS_RANK[it.status];
      case "stage": return STAGE_ORDER.indexOf(it.stage);
      case "kind": return it.kind;
      case "group": return it.group ?? "~";
      case "pricing": return ["free", "freemium", "paid", "unknown"].indexOf(it.pricing ?? "unknown");
      case "added": return it.added;
      default: return it.title.toLowerCase();
    }
  };
  return [...items].sort((a, b) => {
    const x = key(a), y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir || a.title.localeCompare(b.title);
  });
}

export function DataTable({ rows, total, visible, sort, onSort, page, onPage, onOpen }: {
  rows: Item[];
  total: number;
  visible: Set<string>;
  sort: Sort;
  onSort: (s: Sort) => void;
  page: number;
  onPage: (p: number) => void;
  onOpen: (id: string) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? page * PAGE_SIZE + 1 : 0;
  const last = Math.min(total, (page + 1) * PAGE_SIZE);
  const cols = TABLE_COLUMNS.filter((c) => visible.has(c.id));

  const header = (c: (typeof TABLE_COLUMNS)[number]) => {
    const sorted = sort.column === c.id;
    const ariaSort = sorted ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;
    return (
      <th key={c.id} className={`c-${c.id}`} aria-sort={ariaSort} scope="col">
        {c.sortable ? (
          <button onClick={() => onSort({ column: c.id, dir: sorted && sort.dir === "asc" ? "desc" : "asc" })}>
            {c.label}<span aria-hidden="true">{sorted ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
          </button>
        ) : <span className="sr-only">{c.label}</span>}
      </th>
    );
  };

  return (
    <>
      <div className="table-wrap">
        <table className="data">
          <thead><tr>{cols.map(header)}</tr></thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} tabIndex={0} onClick={() => onOpen(it.id)} onKeyDown={(e) => { if (e.key === "Enter") onOpen(it.id); }}>
                {visible.has("thumb") && <td className="c-thumb"><Preview item={it} /></td>}
                {visible.has("title") && (
                  <td className="c-title">
                    <div className="t">{it.title}{it.also?.length ? <span className="more"> +{it.also.length}</span> : null}{it.check ? <span className="warn" title={`couldn't check: ${it.check}`}> ⚠</span> : null}</div>
                    {it.summary && <div className="s">{it.summary}</div>}
                  </td>
                )}
                {visible.has("kind") && <td className="c-kind">{KIND_PLURAL[it.kind].replace(/s$/, "")}</td>}
                {visible.has("group") && <td className="c-group">{it.group ?? "—"}</td>}
                {visible.has("pricing") && <td className="c-pricing"><span className={`price ${it.pricing ?? "unknown"}`}>{PRICING_LABEL[it.pricing ?? "unknown"]}</span></td>}
                {visible.has("stage") && <td className="c-stage">{it.stage}</td>}
                {visible.has("status") && (
                  <td className="c-status"><span className={`mark ${it.status}`} aria-hidden="true">{STATUS_MARK[it.status]}</span>{STATUS_LABEL[it.status]}</td>
                )}
                {visible.has("tags") && <td className="c-tags">{it.tags.slice(0, 3).map((t) => <span key={t}>#{t}</span>)}</td>}
                {visible.has("added") && <td className="c-added">{it.added}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>showing {first}–{last} of {total}</span>
        <span className="pager">
          <button className="btn ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>← prev</button>
          <span className="hint" style={{ alignSelf: "center" }}>{page + 1} / {pages}</span>
          <button className="btn ghost" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>next →</button>
        </span>
      </div>
    </>
  );
}
