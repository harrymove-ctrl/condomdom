"use client";
// An item's preview, drawn from where it lives (DESIGN.md §7):
//   link → its logo as ascii · folder → its real file tree · video → a frame as ascii (+ the player when large)
// Small previews (table rows) are stills and load when scrolled into view; large ones (drawer, explorer) move.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ascii } from "ascii.rest/react";
import type { Drawing } from "ascii.rest/kit";
import type { Item } from "@/lib/types";

export interface PreviewData {
  source: "link" | "folder" | "video" | "none";
  drawing?: Drawing | null;
  tree?: { entries: string; dirs: number; files: number; truncated: boolean };
  description?: string | null;
  error?: string;
}

const cache = new Map<string, Promise<PreviewData | null>>(); // one request per item per page view
export function loadPreview(id: string) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/api/preview/${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(id)!;
}

/** The tree's top level with how much each folder holds: what fits in a table row. */
function topLevel(entries: string) {
  const lines = entries.split("\n");
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (l.startsWith(" ")) return;
    if (l.endsWith("/")) {
      let n = 0;
      for (let j = i + 1; j < lines.length && lines[j].startsWith("  "); j++) if (!lines[j].startsWith("    ")) n++;
      out.push(`${l} ${n}`);
    } else out.push(l);
  });
  return out;
}

/** A complete tree drawn with ├── └──, for folders too long for the animated piece. */
export function drawTree(root: string, entries: string) {
  const rows = entries.split("\n").map((l) => ({ depth: (l.match(/^ */)?.[0].length ?? 0) / 2, name: l.trim() }));
  // Whether another entry at `depth` follows row i before its parent's level ends.
  const continues = (i: number, depth: number) => rows.slice(i + 1).find((x) => x.depth <= depth)?.depth === depth;
  const out = [root];
  rows.forEach((r, i) => {
    let prefix = "";
    for (let d = 0; d < r.depth; d++) prefix += continues(i, d) ? "│   " : "    ";
    out.push(`${prefix}${continues(i, r.depth) ? "├── " : "└── "}${r.name}`);
  });
  return out.join("\n");
}

const PIECE_ROWS = 21; // ascii.rest's file-tree is 23 rows: the root and its summary take two

export function Preview({ item, size = "small" }: { item: Item; size?: "small" | "large" }) {
  const box = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PreviewData | null | undefined>(undefined);
  const [fromDrawing, setFromDrawing] = useState<typeof import("ascii.rest/kit").fromDrawing | null>(null);
  const large = size === "large";

  useEffect(() => {
    let alive = true;
    setData(undefined);
    const start = async () => {
      const d = await loadPreview(item.id);
      if (d?.drawing) { const kit = await import("ascii.rest/kit"); if (alive) setFromDrawing(() => kit.fromDrawing); }
      if (alive) setData(d);
    };
    if (large) { start(); return () => { alive = false; }; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "200px" });
    if (box.current) io.observe(box.current);
    return () => { alive = false; io.disconnect(); };
  }, [item.id, large]);

  const piece = useMemo(
    () => (data?.drawing && fromDrawing ? fromDrawing(data.drawing, { name: item.title, glint: large && data.source === "link" }) : null),
    [data, fromDrawing, item.title, large],
  );

  const cls = `preview ${size}`;
  if (data === undefined) return <div ref={box} className={`${cls} empty`} aria-hidden="true">· · ·</div>;
  if (!data || data.error) {
    return <div ref={box} className={`${cls} empty`} title={data?.error}>{large ? <p className="hint">no preview: {data?.error ?? "the server didn't answer"}</p> : "no preview"}</div>;
  }

  if (data.source === "folder" && data.tree) {
    const root = (item.path?.split("/").filter(Boolean).pop() ?? item.id) + "/";
    if (!large) {
      return (
        <div ref={box} className={`${cls} tree`} title={`${data.tree.dirs} folders, ${data.tree.files} files`}>
          <pre>{topLevel(data.tree.entries).slice(0, 4).join("\n")}</pre>
        </div>
      );
    }
    const lines = data.tree.entries.split("\n").length;
    return (
      <div ref={box} className={`${cls} tree`}>
        {lines <= PIECE_ROWS
          ? <Ascii piece="file-tree" options={{ root, entries: data.tree.entries }} className="ascii" label={`files in ${root}`} />
          : <pre className="static-tree">{drawTree(root, data.tree.entries)}{data.tree.truncated ? "\n…" : ""}</pre>}
        {lines > PIECE_ROWS && <p className="hint">{data.tree.dirs} folders · {data.tree.files} files</p>}
        {data.description && <p className="description">{data.description}</p>}
      </div>
    );
  }

  return (
    <div ref={box} className={cls}>
      {piece ? <Ascii piece={piece} mono className="ascii" label={`${item.title}, drawn in ascii`} /> : null}
      {large && data.source === "video" && (
        <video src={`/api/video/${encodeURIComponent(item.id)}`} controls preload="metadata" />
      )}
    </div>
  );
}
