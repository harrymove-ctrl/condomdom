// condomdom front end. Plain ES modules + ascii.rest through the import map; no build step.
// Every visual rule here comes from DESIGN.md.
const KINDS = [
  ["component", "components"], ["video", "videos"], ["skill", "skills"],
  ["read", "reads"], ["tool", "tools"], ["inspiration", "inspiration"],
];
const STATUSES = [["core", "core"], ["using", "using"], ["to-try", "to try"]];
const KIND_WORD = { component: "component", video: "video", skill: "skill", read: "read", tool: "tool", inspiration: "inspiration" };
const STATUS_LABEL = Object.fromEntries(STATUSES);
const STATUS_MARK = { core: "●", using: "◐", "to-try": "○" };
const STATUS_RANK = { core: 0, using: 1, "to-try": 2 };
const THEMES = ["system", "light", "dark"];

const $ = (s) => document.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const mark = (status) => `<span class="mark ${status}" aria-hidden="true">${STATUS_MARK[status] || "○"}</span>`;

let items = [];
let stages = [];
let canWrite = false;   // true when served by server.mjs
let loadError = null;
const state = { q: "", kinds: new Set(), stages: new Set(), statuses: new Set(), view: "library" };

// ---------- per-browser memory (never required for the page to work) ----------
const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem("condomdom:" + key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem("condomdom:" + key, JSON.stringify(value)); } catch {} },
};
function loadFilters() {
  const s = store.get("filters", {});
  for (const k of ["kinds", "stages", "statuses"]) if (Array.isArray(s[k])) state[k] = new Set(s[k]);
  if (s.view === "workflow") state.view = "workflow";
}
const saveFilters = () => store.set("filters", { kinds: [...state.kinds], stages: [...state.stages], statuses: [...state.statuses], view: state.view });

// ---------- theme (DESIGN.md §5) ----------
function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
}
function setTheme(t) {
  if (t === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  try { t === "system" ? localStorage.removeItem("condomdom:theme") : localStorage.setItem("condomdom:theme", t); } catch {}
  $("#theme-label").textContent = t;
}
const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(currentTheme()) + 1) % THEMES.length]);

// ---------- ascii.rest (DESIGN.md §9: at most two pieces moving at once) ----------
let ascii = null; // { mount, banner } once loaded
async function loadAscii() {
  try {
    const [{ mount }, { banner }] = await Promise.all([import("ascii.rest"), import("ascii.rest/banner")]);
    ascii = { mount, banner };
  } catch (err) {
    console.warn("ascii.rest did not load; showing plain text instead", err);
  }
}
const piece = (name) => import(`ascii.rest/pieces/${name}.js`);

async function mountHero() {
  if (!ascii) { $("#wordmark-fallback").hidden = false; return; }
  ascii.mount($("#wordmark"), ascii.banner("condomdom", { font: "block", pixel: 1, shadow: "rounded", effect: "glint" }));
  ascii.mount($("#tagline"), await piece("typewriter"), {
    prefix: "i keep ",
    phrases: ["components that feel right.", "videos worth rewatching.", "skills my agents load.", "notes on how i build."],
  });
  if (matchMedia("(min-width: 561px)").matches) ascii.mount($("#hero-art"), await piece("donut"));
}

// One slot for the loading / empty piece, so only one state piece ever runs.
let stopState = null;
let stateToken = 0;
async function showState(kind) {
  const box = $("#state");
  const token = ++stateToken; // a newer call wins if pieces load out of order
  stopState?.(); stopState = null;
  if (!kind) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false;
  box.className = "state" + (kind === "error" ? " error" : "");
  const text = {
    loading: `<p>loading the library…</p>`,
    empty: `<p>nothing matches. <button class="text-btn" id="empty-clear">(clear filters)</button></p>`,
    blank: `<p>the library is empty. press <kbd>n</kbd> to add the first thing.</p>`,
    error: `<p>couldn't load the library: ${esc(loadError)}. check the server is running, then reload.</p>`,
  }[kind];
  box.innerHTML = `<pre class="ascii" aria-hidden="true"></pre>${text}`;
  $("#empty-clear")?.addEventListener("click", clearFilters);
  if (!ascii || kind === "error") return;
  const pre = box.querySelector("pre");
  const p = await piece(kind === "loading" ? "spinners" : "not-found");
  if (token !== stateToken) return;
  stopState = kind === "loading"
    ? ascii.mount(pre, p, { names: ["dots"], labels: false })
    : ascii.mount(pre, p, {
      code: "0", title: kind === "blank" ? "empty library" : "nothing matches", message: kind === "blank" ? "add your first item" : "try fewer filters",
    });
}

// ---------- data ----------
async function load() {
  try {
    const r = await fetch("/api/library");
    if (!r.ok) throw new Error(`server said ${r.status}`);
    items = (await r.json()).items;
    canWrite = true;
  } catch {
    try {
      const r = await fetch("../content/library.json"); // opened without the server: read-only
      if (!r.ok) throw new Error(`content/library.json: ${r.status}`);
      items = (await r.json()).items;
    } catch (err) { loadError = err.message; }
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
const stageLabel = (id) => (stages.find((s) => s.id === id)?.label || id || "").toLowerCase();

// ---------- render ----------
function renderStats() {
  const count = (k) => items.filter((i) => i.kind === k).length;
  $("#stats").innerHTML = [
    ["items", items.length], ["components", count("component")], ["videos", count("video")],
    ["skills", count("skill")], ["core", items.filter((i) => i.status === "core").length],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function pills(el, entries, set, countOf) {
  el.innerHTML = entries.map(([id, label]) =>
    `<button class="pill" data-id="${esc(id)}" aria-pressed="${set.has(id)}">${esc(label)}<span class="n">${countOf(id)}</span></button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest(".pill"); if (!b) return;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    render();
  };
}

function renderFilters() {
  pills($("#kind-filters"), KINDS.filter(([k]) => items.some((i) => i.kind === k)), state.kinds, (k) => items.filter((i) => i.kind === k).length);
  pills($("#stage-filters"), stages.map((s) => [s.id, s.label.toLowerCase()]), state.stages, (s) => items.filter((i) => i.stage === s).length);
  pills($("#status-filters"), STATUSES, state.statuses, (s) => items.filter((i) => i.status === s).length);
}

let lastState = null;
function renderList() {
  const list = sorted(items.filter(matches));
  const next = loadError ? "error" : !items.length ? "blank" : !list.length ? "empty" : null;
  if (next !== lastState) { lastState = next; showState(next); }
  $("#list").innerHTML = list.map((it) => `
    <li class="row" tabindex="0" data-id="${esc(it.id)}">
      <div class="head"><span class="title">${esc(it.title)}</span>${it.summary ? `<span class="summary">— ${esc(it.summary)}</span>` : ""}</div>
      <span class="date">${esc(it.added || "")}</span>
      <div class="meta">
        <span>${mark(it.status)}${STATUS_LABEL[it.status] || ""}</span>
        <span>${esc(KIND_WORD[it.kind] || it.kind)}</span>
        <span>${esc(stageLabel(it.stage))}</span>
        ${(it.tags || []).slice(0, 4).map((t) => `<span>#${esc(t)}</span>`).join("")}
      </div>
    </li>`).join("");
}

function renderBoard() {
  $("#workflow-view").innerHTML = stages.map((s, n) => {
    const inStage = items.filter((i) => i.stage === s.id && matches(i))
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.title.localeCompare(b.title));
    return `<article class="stage">
      <h3><span class="num">${String(n + 1).padStart(2, "0")}</span> ${esc(s.label.toLowerCase())}</h3>
      <p class="q">${esc(s.question)}</p>
      <ol>${s.playbook.map((p) => `<li>${esc(p)}</li>`).join("")}</ol>
      <ul>${inStage.map((i) => `<li><button data-id="${esc(i.id)}" title="${esc(i.title)}">${mark(i.status)}${esc(i.title)}</button></li>`).join("") || `<li class="none">nothing here yet</li>`}</ul>
    </article>`;
  }).join("");
}

function render() {
  renderStats();
  renderFilters();
  $("#library-view").hidden = state.view !== "library";
  $("#workflow-view").hidden = state.view !== "workflow";
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
  if (state.view === "library") renderList();
  else { renderBoard(); if (lastState) { lastState = null; showState(null); } }
  saveFilters();
}

// ---------- drawers ----------
let returnFocus = null;
function openDialog(d) { returnFocus = document.activeElement; d.showModal(); }
function closeDialog(d) { d.close(); }
for (const d of document.querySelectorAll("dialog")) d.addEventListener("close", () => returnFocus?.focus?.());

function openDetail(id) {
  const it = items.find((i) => i.id === id); if (!it) return;
  const d = $("#detail");
  d.innerHTML = `
    <div class="kicker"><span>${mark(it.status)}${STATUS_LABEL[it.status]}</span><span>${esc(KIND_WORD[it.kind] || it.kind)}</span><span>${esc(stageLabel(it.stage))}</span><span>${esc(it.added || "")}</span></div>
    <h2>${esc(it.title)}</h2>
    ${it.summary ? `<p>${esc(it.summary)}</p>` : ""}
    ${it.file ? `<video src="/${esc(it.file)}" controls preload="metadata"></video><p class="hint">no picture? put the file at <code>${esc(it.file)}</code>.</p>` : ""}
    ${it.note ? `<p class="note">${esc(it.note)}</p>` : ""}
    ${it.tags?.length ? `<div class="tags">${it.tags.map((t) => `<span>#${esc(t)}</span>`).join("")}</div>` : ""}
    <div class="links">
      ${it.url ? `<a class="btn primary" href="${esc(it.url)}" target="_blank" rel="noopener">open ↗</a>` : ""}
      ${it.path ? `<span class="hint">local: <code>${esc(it.path)}</code></span>` : ""}
    </div>
    <div class="actions">
      ${canWrite ? `<button class="btn" data-edit="${esc(it.id)}">edit</button>` : `<span class="hint">run <code>node server.mjs</code> to edit</span>`}
      <span class="spacer"></span><button class="btn" data-close>close</button>
    </div>`;
  openDialog(d);
}

function fillSelect(sel, entries, value) {
  sel.innerHTML = entries.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("");
}

let editingId = null;
function openEditor(it = null) {
  if (!canWrite) return toast("read-only: run node server.mjs to add things");
  editingId = it?.id || null;
  const f = $("#editor-form");
  f.reset();
  $("#editor-title").textContent = it ? "edit item" : "add to the library";
  fillSelect(f.kind, KINDS.map(([k]) => [k, KIND_WORD[k]]), it?.kind || [...state.kinds][0] || "component");
  fillSelect(f.stage, stages.map((s) => [s.id, s.label.toLowerCase()]), it?.stage || [...state.stages][0] || "build");
  fillSelect(f.status, STATUSES, it?.status || "to-try");
  for (const k of ["title", "url", "path", "file", "summary", "note"]) f[k].value = it?.[k] || "";
  f.tags.value = (it?.tags || []).join(", ");
  $("#delete-btn").hidden = !it;
  $("#editor-error").hidden = true;
  if ($("#detail").open) $("#detail").close();
  openDialog($("#editor"));
  f.title.focus();
}

async function saveEditor(e) {
  e.preventDefault();
  const btn = $("#save-btn");
  btn.disabled = true; btn.textContent = "saving…";
  try {
    const data = Object.fromEntries(new FormData($("#editor-form")));
    const res = await fetch(editingId ? `/api/items/${encodeURIComponent(editingId)}` : "/api/items", {
      method: editingId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
    });
    const out = await res.json();
    if (!res.ok) { $("#editor-error").textContent = out.error; $("#editor-error").hidden = false; return; }
    if (editingId) items = items.map((i) => (i.id === editingId ? out : i)); else items.unshift(out);
    closeDialog($("#editor"));
    render();
    toast(editingId ? "saved" : `added “${out.title}”`);
  } catch {
    $("#editor-error").textContent = "couldn't reach the server. is node server.mjs still running?";
    $("#editor-error").hidden = false;
  } finally {
    btn.disabled = false; btn.textContent = "save";
  }
}

async function deleteItem() {
  const it = items.find((i) => i.id === editingId);
  if (!it || !confirm(`delete “${it.title}” from the library?`)) return;
  const res = await fetch(`/api/items/${encodeURIComponent(editingId)}`, { method: "DELETE" }).catch(() => null);
  if (!res?.ok) return toast("delete failed. is the server running?");
  items = items.filter((i) => i.id !== editingId);
  closeDialog($("#editor"));
  render();
  toast("deleted");
}

// ---------- misc ----------
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
  $("#random-btn").onclick = randomPick;
  $("#add-btn").onclick = () => openEditor();
  $("#theme-btn").onclick = cycleTheme;
  document.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; render(); }));

  const openFrom = (e) => { const el = e.target.closest("[data-id]"); if (el) openDetail(el.dataset.id); };
  $("#list").onclick = openFrom;
  $("#list").onkeydown = (e) => { if (e.key === "Enter") openFrom(e); };
  $("#workflow-view").onclick = openFrom;

  $("#detail").onclick = (e) => {
    if (e.target === $("#detail") || e.target.closest("[data-close]")) closeDialog($("#detail"));
    const ed = e.target.closest("[data-edit]"); if (ed) openEditor(items.find((i) => i.id === ed.dataset.edit));
  };
  $("#editor").onclick = (e) => { if (e.target === $("#editor") || e.target.closest("[data-close]")) closeDialog($("#editor")); };
  $("#editor-form").onsubmit = saveEditor;
  $("#delete-btn").onclick = deleteItem;

  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector("dialog[open]")) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    if (e.key === "/") { e.preventDefault(); $("#q").focus(); }
    else if (e.key === "r") randomPick();
    else if (e.key === "n") openEditor();
    else if (e.key === "t") cycleTheme();
    else if (e.key === "w") { state.view = state.view === "library" ? "workflow" : "library"; render(); }
  });
}

// ---------- start ----------
$("#theme-label").textContent = currentTheme();
loadFilters();
wire();
await loadAscii();
lastState = "loading";
showState("loading");
mountHero();
await load();
render();
