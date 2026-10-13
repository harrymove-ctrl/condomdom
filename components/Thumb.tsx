"use client";
// An item's link as ascii (DESIGN.md §7): the server turns the page's share image into a drawing
// (/api/thumb/<id>, the same drawing ascii.rest/make does), and here it plays as a piece in one ink.
// Fetched only when the row scrolls into view. Table thumbs are stills; the drawer's one glints.
import { useEffect, useMemo, useRef, useState } from "react";
import { Ascii } from "ascii.rest/react";
import type { Drawing } from "ascii.rest/kit";
import type { Item } from "@/lib/types";

type State = { status: "idle" | "loading" | "done"; drawing: Drawing | null; fromDrawing?: typeof import("ascii.rest/kit").fromDrawing };

const cache = new Map<string, Promise<Drawing | null>>(); // one request per item per page view

function load(id: string) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`/api/thumb/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => t?.drawing ?? null)
      .catch(() => null));
  }
  return cache.get(id)!;
}

export function Thumb({ item, big = false }: { item: Item; big?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>({ status: "idle", drawing: null });

  useEffect(() => {
    if (!item.url) return;
    let alive = true;
    const start = async () => {
      setState((s) => ({ ...s, status: "loading" }));
      const [drawing, kit] = await Promise.all([load(item.id), import("ascii.rest/kit")]);
      if (alive) setState({ status: "done", drawing, fromDrawing: kit.fromDrawing });
    };
    if (big) { start(); return () => { alive = false; }; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); start(); }
    }, { rootMargin: "200px" });
    if (box.current) io.observe(box.current);
    return () => { alive = false; io.disconnect(); };
  }, [item.id, item.url, big]);

  const piece = useMemo(
    () => (state.drawing && state.fromDrawing ? state.fromDrawing(state.drawing, { name: item.title, glint: big }) : null),
    [state.drawing, state.fromDrawing, item.title, big],
  );

  const cls = `thumb${big ? " big" : ""}`;
  if (piece) return <div ref={box} className={cls}><Ascii piece={piece} mono className="ascii" label={`${item.title}, drawn in ascii`} /></div>;
  const text = !item.url ? "no link" : state.status === "done" ? "no image" : "· · ·";
  return <div ref={box} className={`${cls} empty`} aria-hidden="true">{text}</div>;
}
