"use client";
// One column per stage: its question, its playbook, and the items used there, core first (DESIGN.md §7).
import { STATUS_MARK, STATUS_RANK, type Item, type Stage } from "@/lib/types";

export function WorkflowBoard({ items, stages, onOpen }: { items: Item[]; stages: Stage[]; onOpen: (id: string) => void }) {
  return (
    <section className="board" aria-label="workflow">
      {stages.map((s, n) => {
        const inStage = items.filter((i) => i.stage === s.id)
          .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));
        return (
          <article key={s.id} className="stage">
            <h3><span className="num">{String(n + 1).padStart(2, "0")}</span> {s.label.toLowerCase()}</h3>
            <p className="q">{s.question}</p>
            <ol>{s.playbook.map((p) => <li key={p}>{p}</li>)}</ol>
            <ul>
              {inStage.length ? inStage.map((i) => (
                <li key={i.id}>
                  <button onClick={() => onOpen(i.id)} title={i.title}>
                    <span className={`mark ${i.status}`} aria-hidden="true">{STATUS_MARK[i.status]}</span>{i.title}
                  </button>
                </li>
              )) : <li className="none">nothing here yet</li>}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
