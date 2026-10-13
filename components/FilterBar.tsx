"use client";
// Search plus filters after Bazza UI / sv-table: (filter) → a column → its values with counts. Each filter shows as
// a chip: column · operator (click to change) · values (click to edit) · ×. Styled by DESIGN.md, not shadcn.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { COLUMNS, OPERATORS, column, describe, facet, type ColumnId, type Filter } from "@/lib/filters";
import type { Item } from "@/lib/types";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function ValuePicker({ items, columnId, filter, onChange }: {
  items: Item[]; columnId: ColumnId; filter?: Filter; onChange: (values: string[]) => void;
}) {
  const col = column(columnId);
  const [find, setFind] = useState("");
  const values = filter?.values ?? [];

  if (col.type === "text" || col.type === "date") {
    return (
      <div className="menu-field">
        <label className="hint" htmlFor={`f-${columnId}`}>{col.label} {filter?.operator ?? OPERATORS[col.type][0]}</label>
        <input
          id={`f-${columnId}`} autoFocus type={col.type === "date" ? "date" : "text"}
          defaultValue={values[0] ?? ""} placeholder={col.type === "text" ? "type to filter…" : undefined}
          onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}
        />
      </div>
    );
  }
  const options = facet(items, columnId).filter((o) => o.label.toLowerCase().includes(find.toLowerCase()));
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <>
      <div className="menu-head">
        <span aria-hidden="true">/</span>
        <input autoFocus placeholder={`find a ${col.label === "tags" ? "tag" : col.label}…`} value={find} onChange={(e) => setFind(e.target.value)} aria-label={`find ${col.label}`} />
      </div>
      {options.map((o) => (
        <button key={o.value} className="menu-item" role="menuitemcheckbox" aria-checked={values.includes(o.value)} onClick={() => toggle(o.value)}>
          <span className="check" aria-hidden="true">{values.includes(o.value) ? "✓" : ""}</span>
          {o.label}
          <span className="count">{o.count}</span>
        </button>
      ))}
      {!options.length && <p className="menu-empty">nothing called that</p>}
    </>
  );
}

export function FilterBar({ items, q, onQ, filters, setFilters, columnsMenu, onClear, searchRef }: {
  items: Item[];
  q: string;
  onQ: (q: string) => void;
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
  columnsMenu: ReactNode;
  onClear: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  // The open menu: "add" (picking a column), a column id (picking its values), or null.
  const [open, setOpen] = useState<null | "add" | ColumnId>(null);
  const [chipMenu, setChipMenu] = useState<ColumnId | null>(null);
  const close = () => { setOpen(null); setChipMenu(null); };
  const addRef = useDismiss(open !== null, close);
  const chipRef = useDismiss(chipMenu !== null, close);

  const filterFor = (id: ColumnId) => filters.find((f) => f.column === id);
  const setValues = (id: ColumnId, values: string[]) => {
    const existing = filterFor(id);
    if (existing) setFilters(filters.map((f) => (f.column === id ? { ...f, values } : f)));
    else setFilters([...filters, { column: id, operator: OPERATORS[column(id).type][0], values }]);
  };
  const cycleOperator = (id: ColumnId) => setFilters(filters.map((f) => {
    if (f.column !== id) return f;
    const ops = OPERATORS[column(id).type];
    return { ...f, operator: ops[(ops.indexOf(f.operator) + 1) % ops.length] };
  }));
  const remove = (id: ColumnId) => setFilters(filters.filter((f) => f.column !== id));
  const active = filters.filter((f) => f.values.some(Boolean));

  return (
    <section className="toolbar" aria-label="search and filters">
      <div className="toolbar-row">
        <div className="search">
          <span aria-hidden="true">/</span>
          <input ref={searchRef} type="search" placeholder="search titles, notes, tags…" autoComplete="off" aria-label="search the library" value={q} onChange={(e) => onQ(e.target.value)} />
          <kbd>/</kbd>
        </div>

        <div className="menu-anchor" ref={addRef}>
          <button className="btn" aria-haspopup="menu" aria-expanded={open !== null} onClick={() => setOpen(open ? null : "add")}>
            filter{active.length ? <span className="n">{active.length}</span> : null}
          </button>
          {open === "add" && (
            <div className="menu" role="menu" aria-label="filter by">
              {COLUMNS.map((c) => (
                <button key={c.id} className="menu-item" role="menuitem" onClick={() => setOpen(c.id)}>
                  {c.label}<span className="chev" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}
          {open && open !== "add" && (
            <div className="menu" role="menu" aria-label={`filter ${open}`}>
              <button className="menu-item" onClick={() => setOpen("add")}><span aria-hidden="true">←</span> {column(open).label}</button>
              <ValuePicker items={items} columnId={open} filter={filterFor(open)} onChange={(v) => setValues(open, v)} />
            </div>
          )}
        </div>

        {columnsMenu}
      </div>

      {active.length > 0 && (
        <div className="toolbar-row">
          <div className="chips" ref={chipRef}>
            {active.map((f) => {
              const d = describe(f);
              return (
                <div key={f.column} className="menu-anchor">
                  <span className="chip">
                    <span className="col">{d.column}</span>
                    <button onClick={() => cycleOperator(f.column)} title="change how it matches">{d.operator}</button>
                    <button onClick={() => setChipMenu(chipMenu === f.column ? null : f.column)} title="change the values"><span className="vals">{d.values}</span></button>
                    <button onClick={() => remove(f.column)} aria-label={`remove the ${d.column} filter`}>×</button>
                  </span>
                  {chipMenu === f.column && (
                    <div className="menu" role="menu">
                      <ValuePicker items={items} columnId={f.column} filter={f} onChange={(v) => setValues(f.column, v)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button className="text-btn" onClick={onClear}>clear all</button>
        </div>
      )}
    </section>
  );
}

export function ColumnsMenu({ all, visible, toggle }: { all: { id: string; label: string }[]; visible: Set<string>; toggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="menu-anchor" ref={ref}>
      <button className="btn ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>columns</button>
      {open && (
        <div className="menu right" role="menu" aria-label="columns to show">
          {all.map((c) => (
            <button key={c.id} className="menu-item" role="menuitemcheckbox" aria-checked={visible.has(c.id)} onClick={() => toggle(c.id)}>
              <span className="check" aria-hidden="true">{visible.has(c.id) ? "✓" : ""}</span>{c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
