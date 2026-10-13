"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ascii, Banner } from "ascii.rest/react";
import { applyFilters, type Filter } from "@/lib/filters";
import type { Item, Kind, Stage } from "@/lib/types";
import { DataTable, PAGE_SIZE, sortItems, TABLE_COLUMNS, type Sort } from "./DataTable";
import { DetailDrawer, EditorDrawer, type Saved } from "./Drawers";
import { ColumnsMenu, FilterBar } from "./FilterBar";
import { Preloader } from "./Preloader";
import { Explorer } from "./Explorer";
import { WorkflowBoard } from "./WorkflowBoard";

const THEMES = ["system", "light", "dark"] as const;
const VIEWS = ["library", "explorer", "workflow"] as const;
type View = (typeof VIEWS)[number];
type Theme = (typeof THEMES)[number];
const SEARCH_MS = 650; // the boot log runs this long while a search settles (DESIGN.md §7)

// Per-browser memory; the page works without it (private windows, blocked storage).
const store = {
  get<T>(k: string, fallback: T): T { try { return JSON.parse(localStorage.getItem("condomdom:" + k) ?? "null") ?? fallback; } catch { return fallback; } },
  set(k: string, v: unknown) { try { localStorage.setItem("condomdom:" + k, JSON.stringify(v)); } catch {} },
};

export function Library({ initialItems, stages }: { initialItems: Item[]; stages: Stage[] }) {
  const [items, setItems] = useState(initialItems);
  const [view, setView] = useState<View>("library");
  const [explored, setExplored] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>({ column: "added", dir: "desc" });
  const [visible, setVisible] = useState<Set<string>>(() => new Set(TABLE_COLUMNS.map((c) => c.id)));
  const [page, setPage] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; item: Item | null }>({ open: false, item: null });
  const [theme, setTheme] = useState<Theme>("system");
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Restore what this browser remembered, after hydration so server and client render the same first.
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setTheme(t === "light" || t === "dark" ? t : "system");
    const v = store.get<string>("view", "library");
    if ((VIEWS as readonly string[]).includes(v)) setView(v as View);
    setFilters(store.get("filters", []));
    const cols = store.get<string[] | null>("columns", null);
    if (cols) setVisible(new Set(cols));
  }, []);
  useEffect(() => store.set("view", view), [view]);
  useEffect(() => store.set("filters", filters), [filters]);
  useEffect(() => store.set("columns", [...visible]), [visible]);

  // Typing shows the boot log until the search settles, then the results.
  useEffect(() => {
    if (q.trim() === appliedQ) { setSearching(false); return; }
    if (!q.trim()) { setAppliedQ(""); setSearching(false); setPage(0); return; } // clearing is instant
    setSearching(true);
    const t = setTimeout(() => { setAppliedQ(q.trim()); setSearching(false); setPage(0); }, SEARCH_MS);
    return () => clearTimeout(t);
  }, [q, appliedQ]);

  const filtered = useMemo(() => sortItems(applyFilters(items, filters, appliedQ), sort), [items, filters, appliedQ, sort]);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  useEffect(() => { if (page * PAGE_SIZE >= filtered.length && page > 0) setPage(0); }, [filtered.length, page]);

  // New items default to the kind you're filtered to, if it's just one.
  const kindFilter = filters.find((f) => f.column === "kind" && f.operator === "is any of" && f.values.length === 1);
  const activeKind = (kindFilter?.values[0] as Kind | undefined) ?? null;

  const clearAll = useCallback(() => { setQ(""); setAppliedQ(""); setFilters([]); setPage(0); }, []);
  const cycleTheme = useCallback(() => {
    setTheme((cur) => {
      const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
      if (next === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = next;
      try { next === "system" ? localStorage.removeItem("condomdom:theme") : localStorage.setItem("condomdom:theme", next); } catch {}
      return next;
    });
  }, []);
  const say = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2400); };
  const openAdd = useCallback(() => setEditor({ open: true, item: null }), []);
  const randomPick = useCallback(() => {
    const pool = filtered.length ? filtered : items;
    if (pool.length) setDetailId(pool[Math.floor(Math.random() * pool.length)].id);
  }, [filtered, items]);

  function onSaved(s: Saved) {
    if ("deleted" in s) {
      setItems((all) => all.filter((i) => i.id !== s.deleted.id));
      say("deleted");
    } else {
      setItems((all) => (s.created ? [s.item, ...all] : all.map((i) => (i.id === s.item.id ? s.item : i))));
      say(s.created ? `added “${s.item.title}”` : "saved");
    }
    setEditor({ open: false, item: null });
    setDetailId(null);
  }

  // DESIGN.md §10 shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement as HTMLElement | null)?.tagName ?? "")) return;
      if (!("booted" in document.documentElement.dataset)) return; // the boot screen takes the first key
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "r") randomPick();
      else if (e.key === "n") openAdd();
      else if (e.key === "t") cycleTheme();
      else if (e.key === "w") setView((v) => VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length]);
      else if (e.key === "e") setView("explorer");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [randomPick, openAdd, cycleTheme]);

  const count = (k: Kind) => items.filter((i) => i.kind === k).length;
  const detail = items.find((i) => i.id === detailId) ?? null;
  const defaults: Partial<Item> = { kind: activeKind ?? "component", stage: "build", status: "to-try" };

  let results: React.ReactNode;
  if (searching) {
    results = (
      <div className="state" role="status">
        <Ascii piece="boot-log" className="ascii" label="searching" />
        <p>searching for “{q.trim()}”…</p>
      </div>
    );
  } else if (!items.length) {
    results = <div className="state"><p>the library is empty. press <kbd>n</kbd> to add the first thing.</p></div>;
  } else if (!filtered.length) {
    results = (
      <div className="state">
        <Ascii piece="not-found" options={{ code: "0", title: "nothing matches", message: "try fewer filters" }} className="ascii" label="nothing matches" />
        <p>nothing matches. <button className="text-btn" onClick={clearAll}>(clear filters)</button></p>
      </div>
    );
  } else {
    results = (
      <DataTable
        rows={pageRows} total={filtered.length} visible={visible}
        sort={sort} onSort={(s) => { setSort(s); setPage(0); }}
        page={page} onPage={setPage} onOpen={setDetailId}
      />
    );
  }

  return (
    <>
      <Preloader />
      <div className="shell">
        <main>
          <header className="hero">
            <h1 className="sr-only">condomdom</h1>
            <p className="sr-only">a personal library of components, videos and skills, arranged around how i build.</p>
            <div className="wordmark" aria-hidden="true">
              <Banner text="condomdom" font="block" pixel={1} shadow="rounded" effect="glint" className="ascii" />
            </div>
            <div className="tagline" aria-hidden="true">
              <Ascii
                piece="typewriter" className="ascii"
                options={{ prefix: "i keep ", phrases: ["components that feel right.", "videos worth rewatching.", "skills my agents load.", "notes on how i build."] }}
              />
            </div>
            <dl className="stats">
              {([["items", items.length], ["components", count("component")], ["videos", count("video")], ["skills", count("skill")], ["core", items.filter((i) => i.status === "core").length]] as const)
                .map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <nav className="paren-nav" aria-label="views">
              <button aria-label="library" aria-current={view === "library"} onClick={() => setView("library")}>(<span>library</span>)</button>
              <button aria-label="explorer" aria-current={view === "explorer"} onClick={() => setView("explorer")}>(<span>explorer</span>)</button>
              <button aria-label="workflow" aria-current={view === "workflow"} onClick={() => setView("workflow")}>(<span>workflow</span>)</button>
              <button aria-label="random item" onClick={randomPick}>(<span>random</span>)</button>
              <button aria-label="add an item" onClick={openAdd}>(<span>add</span>)</button>
            </nav>
          </header>

          <FilterBar
            items={items} q={q} onQ={setQ} filters={filters} setFilters={(f) => { setFilters(f); setPage(0); }}
            onClear={clearAll} searchRef={searchRef}
            columnsMenu={view === "library" ? (
              <ColumnsMenu
                all={TABLE_COLUMNS.filter((c) => c.id !== "title").map((c) => ({ id: c.id, label: c.label }))}
                visible={visible}
                toggle={(id) => setVisible((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n; })}
              />
            ) : null}
          />

          {view === "library" && <section aria-live="polite" aria-busy={searching}>{results}</section>}
          {view === "explorer" && (
            <Explorer
              items={applyFilters(items, filters, appliedQ)} stages={stages} selected={explored} onSelect={setExplored}
              onEdit={(it) => setEditor({ open: true, item: it })}
            />
          )}
          {view === "workflow" && <WorkflowBoard items={applyFilters(items, filters, appliedQ)} stages={stages} onOpen={setDetailId} />}

          <footer className="foot">
            <span>condomdom · on the dev drive</span>
            <button aria-label={`theme: ${theme}`} onClick={cycleTheme}>(theme: <span>{theme}</span>)</button>
            <span><kbd>/</kbd> search · <kbd>r</kbd> random · <kbd>n</kbd> add · <kbd>e</kbd> explorer · <kbd>w</kbd> next view · <kbd>t</kbd> theme</span>
          </footer>
        </main>
      </div>

      <DetailDrawer item={detail} stage={stages.find((s) => s.id === detail?.stage)} onClose={() => setDetailId(null)} onEdit={(it) => { setDetailId(null); setEditor({ open: true, item: it }); }} />
      <EditorDrawer open={editor.open} item={editor.item} stages={stages} defaults={defaults} onClose={() => setEditor({ open: false, item: null })} onSaved={onSaved} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
