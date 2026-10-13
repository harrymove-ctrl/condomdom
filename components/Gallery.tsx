"use client";
// The gallery (DESIGN.md §7): every item as a card with its screenshot, like a browse page. Cards without a picture
// show their ascii preview instead. 48 at a time; the rest come with (show more).
import { useState } from "react";
import { KIND_PLURAL, PRICING_LABEL, STATUS_MARK, type Item } from "@/lib/types";
import { Preview } from "./Preview";

const STEP = 48;

export function Gallery({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const [shown, setShown] = useState(STEP);
  if (!items.length) return <div className="state"><p>nothing to show. try fewer filters.</p></div>;
  return (
    <section aria-label="gallery">
      <ul className="gallery">
        {items.slice(0, shown).map((it) => {
          const pic = it.media?.shot ?? it.media?.og;
          return (
            <li key={it.id}>
              <button className="card" onClick={() => onOpen(it.id)}>
                <span className="card-pic">
                  {pic ? <img src={`/api/media/${pic}`} alt="" loading="lazy" /> : <Preview item={it} />}
                </span>
                <span className="card-body">
                  <span className="card-title"><span className={`mark ${it.status}`} aria-hidden="true">{STATUS_MARK[it.status]}</span>{it.title}</span>
                  {it.summary && <span className="card-sum">{it.summary}</span>}
                  <span className="card-meta">
                    <span>{it.group ?? KIND_PLURAL[it.kind]}</span>
                    {it.pricing && it.pricing !== "unknown" && <span className={`price ${it.pricing}`}>{PRICING_LABEL[it.pricing]}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown < items.length && (
        <div className="table-foot"><span>showing {shown} of {items.length}</span><button className="btn" onClick={() => setShown(shown + STEP)}>(show more)</button></div>
      )}
    </section>
  );
}
