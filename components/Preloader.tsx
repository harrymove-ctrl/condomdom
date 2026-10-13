"use client";
// The boot screen (DESIGN.md §7): ascii.rest's boot-log, where a self test counts memory and then the log scrolls.
// Shown once per tab; any key or click skips it. Server-rendered, so it covers the page from the first paint.
import { useEffect } from "react";
import { Ascii } from "ascii.rest/react";

const BOOT_MS = 3200;

export function Preloader() {
  useEffect(() => {
    const root = document.documentElement;
    if ("booted" in root.dataset) return;
    const unlisten = () => {
      window.removeEventListener("keydown", done);
      window.removeEventListener("pointerdown", done);
    };
    function done() {
      root.dataset.booted = "";
      try { sessionStorage.setItem("condomdom:booted", "1"); } catch {}
      unlisten();
    }
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(done, reduced ? 500 : BOOT_MS);
    window.addEventListener("keydown", done);
    window.addEventListener("pointerdown", done);
    return () => { clearTimeout(timer); unlisten(); };
  }, []);

  return (
    <div className="preloader" role="status" aria-label="loading condomdom">
      <Ascii piece="boot-log" className="ascii" label="condomdom starting up" />
      <p>booting condomdom… <span aria-hidden="true">press any key to skip</span></p>
    </div>
  );
}
