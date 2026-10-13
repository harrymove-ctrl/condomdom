"use client";
// One column per stage (DESIGN.md §7): its question, its playbook, then its items folded by group, core first.
// Each group shows how many are free / free + pro / paid, so you can pick free ones at a glance.
import { PRICING_LABEL, STATUS_MARK, STATUS_RANK, type Item, type Stage } from "@/lib/types";

const OPEN_LIMIT = 6; // groups this size or smaller start open

export function WorkflowBoard({ items, stages, onOpen }: { items: Item[]; stages: Stage[]; onOpen: (id: string) => void }) {
  return (
    <section className="board" aria-label="workflow">
      {stages.map((s, n) => {
        const inStage = items.filter((i) => i.stage === s.id)
          .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));
        const groups = [...new Set(inStage.map((i) => i.group ?? "other"))].sort((a, b) => (a === "other" ? 1 : b === "other" ? -1 : a.localeCompare(b)));
        return (
          <article key={s.id} className="stage">
            <h3><span className="num">{String(n + 1).padStart(2, "0")}</span> {s.label.toLowerCase()} <span className="count">{inStage.length}</span></h3>
            <p className="q">{s.question}</p>
            <ol>{s.playbook.map((p) => <li key={p}>{p}</li>)}</ol>
            {inStage.length === 0 && <p className="none">nothing here yet</p>}
            {groups.map((g) => {
              const its = inStage.filter((i) => (i.group ?? "other") === g);
              const free = its.filter((i) => i.pricing === "free").length;
              return (
                <details key={g} className="stage-group" open={its.length <= OPEN_LIMIT || its.some((i) => i.status === "core")}>
                  <summary>
                    <span className="g">{g}/</span>
                    <span className="count">{its.length}{free ? ` · ${free} free` : ""}</span>
                  </summary>
                  <ul>
                    {its.map((i) => (
                      <li key={i.id}>
                        <button onClick={() => onOpen(i.id)} title={`${i.title}${i.pricing ? ` · ${PRICING_LABEL[i.pricing]}` : ""}`}>
                          <span className={`mark ${i.status}`} aria-hidden="true">{STATUS_MARK[i.status]}</span>
                          <span className="name">{i.title}</span>
                          {i.pricing && i.pricing !== "unknown" && <span className={`price ${i.pricing}`}>{PRICING_LABEL[i.pricing]}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </article>
        );
      })}
    </section>
  );
}
