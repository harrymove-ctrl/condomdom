"use client";
// The page's backdrop (DESIGN.md §9): ascii.rest's earthrise, the earth rising over a lunar horizon, fixed behind
// everything. Dark mode plays it in its own colours on a canvas; light mode draws it in one faint ink, since a black
// sky would muddy a paper page. A veil keeps text readable, and reduced motion holds it on one frame (ascii.rest does).
import { useEffect, useState } from "react";
import { Ascii } from "ascii.rest/react";

function useDark() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      const t = document.documentElement.dataset.theme;
      setDark(t === "dark" ? true : t === "light" ? false : mq.matches);
    };
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", read);
    return () => { mo.disconnect(); mq.removeEventListener("change", read); };
  }, []);
  return dark;
}

export function Background() {
  const dark = useDark();
  if (dark === null) return <div className="backdrop" aria-hidden="true" />; // first paint: just the paper
  return (
    <div className="backdrop" aria-hidden="true">
      <div className={`backdrop-art ${dark ? "colour" : "ink"}`}>
        <Ascii key={dark ? "colour" : "ink"} piece="earthrise" mono={!dark} className="ascii" label="" />
      </div>
      <div className="backdrop-veil" />
    </div>
  );
}
