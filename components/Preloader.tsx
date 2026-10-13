"use client";
// The first-visit screen (DESIGN.md §7): ascii.rest's typewriter types what condomdom holds, then the page opens.
// Shown once per tab; any key or click skips it. Server-rendered, so it covers the page from the first paint.
import { useEffect } from "react";
import { Ascii } from "ascii.rest/react";

const BOOT_MS = 3400;

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
      <Ascii
        piece="typewriter" className="ascii" label="condomdom is opening"
        options={{ prefix: "condomdom › ", phrases: ["opening components…", "opening skill packs…", "opening reads…", "ready."] }}
      />
      <p>press any key to skip</p>
    </div>
  );
}
