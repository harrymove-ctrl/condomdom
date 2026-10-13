// The data table's filter model, after Bazza UI / sv-table: each filter is a column, an operator and values.
import { KINDS, KIND_PLURAL, PRICINGS, PRICING_LABEL, STAGES, STATUSES, STATUS_LABEL, type Item } from "./types";

export type ColumnType = "text" | "option" | "multiOption" | "date";
export type ColumnId = "title" | "kind" | "group" | "pricing" | "stage" | "status" | "tags" | "added";

export const OPERATORS: Record<ColumnType, readonly string[]> = {
  text: ["contains", "does not contain"],
  option: ["is any of", "is none of"],
  multiOption: ["include any of", "include all of", "exclude"],
  date: ["is after", "is before", "is on"],
};

export interface FilterColumn {
  id: ColumnId;
  label: string;
  type: ColumnType;
  /** Fixed values for option columns; multiOption values come from the data. */
  options?: { value: string; label: string }[];
  get: (it: Item) => string | string[];
}

export const COLUMNS: FilterColumn[] = [
  { id: "title", label: "title", type: "text", get: (it) => `${it.title} ${it.summary ?? ""} ${it.note ?? ""}` },
  { id: "kind", label: "kind", type: "option", options: KINDS.map((k) => ({ value: k, label: KIND_PLURAL[k] })), get: (it) => it.kind },
  { id: "group", label: "group", type: "option", get: (it) => it.group ?? "no group" },
  { id: "pricing", label: "pricing", type: "option", options: PRICINGS.map((p) => ({ value: p, label: PRICING_LABEL[p] })), get: (it) => it.pricing ?? "unknown" },
  { id: "stage", label: "stage", type: "option", options: STAGES.map((s) => ({ value: s, label: s })), get: (it) => it.stage },
  { id: "status", label: "status", type: "option", options: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })), get: (it) => it.status },
  { id: "tags", label: "tags", type: "multiOption", get: (it) => it.tags },
  { id: "added", label: "added", type: "date", get: (it) => it.added },
];
export const column = (id: ColumnId) => COLUMNS.find((c) => c.id === id)!;

export interface Filter {
  column: ColumnId;
  operator: string;
  values: string[];
}

/** Every value a column holds, with how many items have it: what the filter menu lists. */
export function facet(items: Item[], id: ColumnId): { value: string; label: string; count: number }[] {
  const col = column(id);
  const counts = new Map<string, number>();
  for (const it of items) {
    const v = col.get(it);
    for (const x of Array.isArray(v) ? v : [v]) counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  const base = col.options ?? [...counts.keys()].sort().map((v) => ({ value: v, label: v }));
  return base.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 })).filter((o) => col.options || o.count > 0);
}

function passes(it: Item, f: Filter): boolean {
  if (!f.values.length || f.values.every((v) => !v)) return true;
  const col = column(f.column);
  const raw = col.get(it);
  switch (col.type) {
    case "text": {
      const hit = String(raw).toLowerCase().includes(f.values[0].toLowerCase());
      return f.operator === "does not contain" ? !hit : hit;
    }
    case "option": {
      const hit = f.values.includes(String(raw));
      return f.operator === "is none of" ? !hit : hit;
    }
    case "multiOption": {
      const have = raw as string[];
      if (f.operator === "include all of") return f.values.every((v) => have.includes(v));
      const any = f.values.some((v) => have.includes(v));
      return f.operator === "exclude" ? !any : any;
    }
    case "date": {
      const d = String(raw), v = f.values[0];
      return f.operator === "is before" ? d < v : f.operator === "is on" ? d === v : d > v;
    }
  }
}

export function search(it: Item, q: string) {
  if (!q) return true;
  const hay = [it.title, it.summary, it.note, it.kind, it.stage, it.status, ...it.tags].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

export const applyFilters = (items: Item[], filters: Filter[], q: string) =>
  items.filter((it) => search(it, q) && filters.every((f) => passes(it, f)));

/** The chip text: "status is any of core, using". */
export function describe(f: Filter) {
  const col = column(f.column);
  const label = (v: string) => col.options?.find((o) => o.value === v)?.label ?? v;
  return { column: col.label, operator: f.operator, values: f.values.map(label).join(", ") || "…" };
}
