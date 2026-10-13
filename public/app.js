// condomdom front end. Plain ES module, no build step.
const KINDS = [
  ["component", "Components"], ["video", "Videos"], ["skill", "Skills"],
  ["read", "Reads"], ["tool", "Tools"], ["inspiration", "Inspiration"],
];
const STATUSES = [["core", "Core"], ["using", "Using"], ["to-try", "To try"]];
const KIND_LABEL = Object.fromEntries(KINDS);
const STATUS_LABEL = Object.fromEntries(STATUSES);
const STATUS_RANK = { core: 0, using: 1, "to-try": 2 };

const $ = (s) => document.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (d) => {
  const t = new Date(d + "T00:00:00");
  return isNaN(t) ? "" : t.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" }).toUpperCase().replace(",", "");
};

let items = [];
let stages = [];
let canWrite = false; // true when served by server.mjs
const state = { q: "", kinds: new Set(), stages: new Set(), statuses: new Set(), view: "library" };

// remember filters per browser; never required for the page to work
const store = {
  load() {
    try {
      const s = JSON.parse(localStorage.getItem("condomdom:filters") || "{}");
      for (const k of ["kinds", "stages", "statuses"]) if (Array.isArray(s[k])) state[k] = new Set(s[k]);
      if (s.view === "workflow") state.view = "workflow";
    } catch {}
  },
  save() {
    try {
      localStorage.setItem("condomdom:filters", JSON.stringify({
        kinds: [...state.kinds], stages: [...state.stages], statuses: [...state.statuses], view: state.view,
      }));
    } catch {}
  },
};

async function load() {
  try {
    const r = await fetch("/api/library");
    if (!r.ok) throw new Error();
    items = (await r.json()).items;
    canWrite = true;
  } catch {
    items = (await (await fetch("../content/library.json")).json()).items; // static, read-only mode
  }
  try { stages = (await (await fetch(canWrite ? "/content/workflow.json" : "../content/workflow.json")).json()).stages; } catch { stages = []; }
}

function matches(it) {
  if (state.kinds.size && !state.kinds.has(it.kind)) return false;
  if (state.stages.size && !state.stages.has(it.stage)) return false;
  if (state.statuses.size && !state.statuses.has(it.status)) return false;
  if (!state.q) return true;
  const hay = [it.title, it.summary, it.note, it.kind, it.stage, ...(it.tags || [])].join(" ").toLowerCase();
  return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

const sorted = (list) => [...list].sort((a, b) =>
  (b.added || "").localeCompare(a.added || "") || STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));

function renderStats() {
  const count = (k) => items.filter((i) => i.kind === k).length;
  const core = items.filter((i) => i.status === "core").length;
  $("#stats").innerHTML = [
    ["items", items.length], ["components", count("component")], ["videos", count("video")],
    ["skills", count("skill")], ["core", core],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function pills(el, entries, set, countOf) {
  el.innerHTML = entries.map(([id, label]) =>
    `<button class="pill" data-id="${id}" aria-pressed="${set.has(id)}">${esc(label)}<span class="n">${countOf(id)}</span></button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest(".pill"); if (!b) return;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    render();
  };
}

function renderFilters() {
  pills($("#kind-filters"), KINDS.filter(([k]) => items.some((i) => i.kind === k)), state.kinds, (k) => items.filter((i) => i.kind === k).length);
  pills($("#stage-filters"), stages.map((s) => [s.id, s.label]), state.stages, (s) => items.filter((i) => i.stage === s).length);
  pills($("#status-filters"), STATUSES, state.statuses, (s) => items.filter((i) => i.status === s).length);
}

function renderList() {
  const list = sorted(items.filter(matches));
  $("#empty").hidden = list.length > 0;
  $("#list").innerHTML = list.map((it) => `
    <li class="row" tabindex="0" data-id="${esc(it.id)}">
      <div class="head"><span class="title">${esc(it.title)}</span>${it.summary ? `<span class="summary">• ${esc(it.summary)}</span>` : ""}</div>
      <span class="date">${fmtDate(it.added)}</span>
      <div class="meta">
        <span><span class="dot ${it.status}"></span>${STATUS_LABEL[it.status] || ""}</span>
        <span class="kind">${esc(KIND_LABEL[it.kind] || it.kind)}</span>
        <span>${esc(stages.find((s) => s.id === it.stage)?.label || it.stage)}</span>
        ${(it.tags || []).slice(0, 4).map((t) => `<span>#${esc(t)}</span>`).join("")}
      </div>
    </li>`).join("");
}

function renderBoard() {
  $("#workflow-view").innerHTML = stages.map((s) => {
    const inStage = items.filter((i) => i.stage === s.id && matches(i))
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));
    return `<article class="stage">
      <h3>${esc(s.label)}</h3>
      <p class="q">${esc(s.question)}</p>
      <ol>${s.playbook.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      <ul>${inStage.map((i) => `<li><button data-id="${esc(i.id)}" title="${esc(i.title)}"><span class="dot ${i.status}"></span>${esc(i.title)}</button></li>`).join("") || `<li class="hint">Nothing here yet</li>`}</ul>
    </article>`;
  }).join("");
}

function render() {
  renderStats();
  renderFilters();
  $("#library-view").hidden = state.view !== "library";
  $("#workflow-view").hidden = state.view !== "workflow";
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  state.view === "library" ? renderList() : renderBoard();
  store.save();
}

function openDetail(id) {
  const it = items.find((i) => i.id === id); if (!it) return;
  const stage = stages.find((s) => s.id === it.stage);
  const d = $("#detail");
  d.innerHTML = `
    <div class="kicker"><span><span class="dot ${it.status}"></span>${STATUS_LABEL[it.status]}</span><span class="kind">${esc(KIND_LABEL[it.kind] || it.kind)}</span><span>${esc(stage?.label || it.stage)}</span><span>${fmtDate(it.added)}</span></div>
    <h2>${esc(it.title)}</h2>
    ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
    ${it.file ? `<video src="/${esc(it.file)}" controls preload="metadata"></video><p class="hint">If the video doesn't play, put the file at <code>${esc(it.file)}</code>.</p>` : ""}
    ${it.note ? `<p class="note">${esc(it.note)}</p>` : ""}
    ${it.tags?.length ? `<div class="tags">${it.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="links">
      ${it.url ? `<a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener">Open ↗</a>` : ""}
      ${it.path ? `<span class="hint">Local: <code>${esc(it.path)}</code></span>` : ""}
    </div>
    <div class="actions">
      ${canWrite ? `<button data-edit="${esc(it.id)}">Edit</button>` : `<span class="hint">Run <code>node server.mjs</code> to edit</span>`}
      <span class="spacer"></span><button data-close>Close</button>
    </div>`;
  d.showModal();
}

function fillSelect(sel, entries, value) {
  sel.innerHTML = entries.map(([v, l]) => `<option value="${v}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
}

let editingId = null;
function openEditor(it = null) {
  if (!canWrite) return toast("Read-only: start the server with  node server.mjs");
  editingId = it?.id || null;
  const f = $("#editor-form");
  f.reset();
  $("#editor-title").textContent = it ? "Edit item" : "Add to the library";
  fillSelect(f.kind, KINDS, it?.kind || [...state.kinds][0] || "component");
  fillSelect(f.stage, stages.map((s) => [s.id, s.label]), it?.stage || [...state.stages][0] || "build");
  fillSelect(f.status, STATUSES, it?.status || "to-try");
  for (const k of ["title", "url", "path", "file", "summary", "note"]) f[k].value = it?.[k] || "";
  f.tags.value = (it?.tags || []).join(", ");
  $("#delete-btn").hidden = !it;
  $("#editor-error").hidden = true;
  $("#detail").close();
  $("#editor").showModal();
  f.title.focus();
}

async function saveEditor(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData($("#editor-form")));
  const res = await fetch(editingId ? `/api/items/${encodeURIComponent(editingId)}` : "/api/items", {
    method: editingId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
  });
  const out = await res.json();
  if (!res.ok) { $("#editor-error").textContent = out.error; $("#editor-error").hidden = false; return; }
  if (editingId) items = items.map((i) => (i.id === editingId ? out : i)); else items.unshift(out);
  $("#editor").close();
  render();
  toast(editingId ? "Saved" : `Added “${out.title}”`);
}

async function deleteItem() {
  const it = items.find((i) => i.id === editingId);
  if (!it || !confirm(`Delete “${it.title}” from the library?`)) return;
  const res = await fetch(`/api/items/${encodeURIComponent(editingId)}`, { method: "DELETE" });
  if (!res.ok) return toast("Delete failed");
  items = items.filter((i) => i.id !== editingId);
  $("#editor").close();
  render();
  toast("Deleted");
}

function randomPick() {
  const pool = items.filter(matches);
  if (pool.length) openDetail(pool[Math.floor(Math.random() * pool.length)].id);
}

let toastTimer;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400);
}

function clearFilters() {
  state.q = ""; $("#q").value = "";
  state.kinds.clear(); state.stages.clear(); state.statuses.clear();
  render();
}

function wire() {
  $("#q").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("#clear").onclick = clearFilters;
  $("#empty-clear").onclick = clearFilters;
  $("#random-btn").onclick = randomPick;
  $("#add-btn").onclick = () => openEditor();
  document.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; render(); }));

  const openFrom = (e) => { const el = e.target.closest("[data-id]"); if (el) openDetail(el.dataset.id); };
  $("#list").onclick = openFrom;
  $("#list").onkeydown = (e) => { if (e.key === "Enter") openFrom(e); };
  $("#workflow-view").onclick = openFrom;

  $("#detail").onclick = (e) => {
    if (e.target === $("#detail") || e.target.closest("[data-close]")) $("#detail").close();
    const ed = e.target.closest("[data-edit]"); if (ed) openEditor(items.find((i) => i.id === ed.dataset.edit));
  };
  $("#editor").onclick = (e) => { if (e.target === $("#editor") || e.target.closest("[data-close]")) $("#editor").close(); };
  $("#editor-form").onsubmit = saveEditor;
  $("#delete-btn").onclick = deleteItem;

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (e.key === "/") { e.preventDefault(); $("#q").focus(); }
    else if (e.key === "r") randomPick();
    else if (e.key === "n") openEditor();
    else if (e.key === "w") { state.view = state.view === "library" ? "workflow" : "library"; render(); }
  });
}

store.load();
await load();
wire();
render();
