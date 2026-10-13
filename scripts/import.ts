// pnpm inbox content/inbox/<file>.md         read an inbox list, fetch each new link, show what would be added
// pnpm inbox content/inbox/<file>.md --apply  …and add them to content/library.json
// pnpm inbox --pricing [--apply]              check pricing for library items that don't have it yet
//
// Inbox format: "## kind / group" headings, "stage: x" under a heading, "- link — your note" lines.
// For each new link: title and summary come from the page; pricing is read from the page's text
// (free / free + pro / paid / unknown). GitHub and GitLab repos count as free. Links already in the library are skipped.
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Pricing = "free" | "freemium" | "paid" | "unknown";
type Item = { id: string; title: string; kind: string; group?: string; stage: string; status: string; pricing?: Pricing; url?: string; summary?: string; note?: string; tags: string[]; added: string };

const LIBRARY = join(process.cwd(), "content", "library.json");
const KINDS = ["component", "video", "skill", "read", "tool", "inspiration"];
const STAGES = ["inspire", "design", "build", "ship", "learn"];
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const pricingOnly = args.includes("--pricing");
const inbox = args.find((a) => !a.startsWith("--"));
const today = new Date().toISOString().slice(0, 10);
/** Only things you'd install or sign up for have a price; references, portfolios and writing don't. */
const PRICED = ["component", "tool", "skill"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
/** The same link however it was pasted: no www, no #hash, no trailing slash, host in lower case. */
export function normal(u: string) {
  try {
    const x = new URL(u);
    return (x.hostname.replace(/^www\./, "").toLowerCase() + x.pathname.replace(/\/+$/, "") + (x.search && !/^\?(ref|utm_)/.test(x.search) ? x.search : "")).toLowerCase();
  } catch { return u.toLowerCase(); }
}

// ---------- reading the inbox ----------
type Entry = { url: string; note?: string; kind: string; group: string; stage: string };
function parse(md: string): Entry[] {
  const out: Entry[] = [];
  let kind = "component", group = "", stage = "build";
  for (const raw of md.replace(/<!--[\s\S]*?-->/g, "").split("\n")) {
    const line = raw.trim();
    const h = line.match(/^##\s+([a-z]+)\s*\/\s*(.+)$/i);
    if (h) {
      if (!KINDS.includes(h[1].toLowerCase())) throw new Error(`unknown kind "${h[1]}" in: ${line}`);
      kind = h[1].toLowerCase(); group = h[2].trim().toLowerCase(); stage = "build"; continue;
    }
    const s = line.match(/^stage:\s*([a-z]+)/i);
    if (s && STAGES.includes(s[1].toLowerCase())) { stage = s[1].toLowerCase(); continue; }
    const m = line.match(/^[-*\d.)\s]*(https?:\/\/\S+)(?:\s+[—–-]\s+(.*))?$/);
    if (m) out.push({ url: m[1], note: m[2]?.trim() || undefined, kind, group, stage });
  }
  return out;
}

// ---------- reading a page ----------
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const meta = (html: string, name: string) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (key === name) return decode(tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "");
  }
  return "";
};

const PAID = /\b(buy now|buy|purchase|get (?:all[- ]access|pro|lifetime|access)|lifetime (?:access|deal|license)|all[- ]access|upgrade to pro|go pro|pro plan|one[- ]time (?:payment|purchase)|per month|\/mo\b|\/month|commercial license|unlock (?:all|pro))\b|[$€£]\s?\d{1,4}\b/i;
const FREE = /\b(open[- ]source|mit licen[cs]e|100% free|free forever|completely free|free to use|free and open|copy (?:and|&) paste|copy[- ]paste|free components?)\b/i;

/** Pricing from what the page says about itself. Repos are free; a ".pro" site or a "-pro" page is paid. */
export function pricingOf(url: string, text: string): Pricing {
  const host = new URL(url).hostname;
  if (/(^|\.)(github|gitlab)\.com$/.test(host) || host.endsWith("github.io")) return "free";
  const proHint = /\.pro$/.test(host) || /[-/]pro(\b|$)/.test(new URL(url).pathname);
  const paid = proHint || PAID.test(text), free = FREE.test(text);
  return paid && free ? "freemium" : paid ? "paid" : free ? "free" : "unknown";
}

const cleanTitle = (t: string, host: string) => {
  const parts = t.split(/\s+[|·–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  const name = host.replace(/^www\./, "").split(".")[0].toLowerCase();
  // "Thing — tagline" or "tagline | Thing": prefer the part that names the site, else the first.
  return (parts.find((p) => p.toLowerCase().replace(/[^a-z0-9]/g, "").includes(name.replace(/[^a-z0-9]/g, ""))) ?? parts[0] ?? t).slice(0, 80);
};

async function look(url: string): Promise<{ title?: string; summary?: string; pricing: Pricing; error?: string }> {
  const u = new URL(url);
  if (/(^|\.)(x|twitter)\.com$/.test(u.hostname)) {
    return { title: `post by @${u.pathname.split("/")[1]}`, pricing: "free" }; // x.com blocks fetching; the note is the summary
  }
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh) condomdom/0.4", accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(12000) });
    const html = (await res.text()).slice(0, 1_500_000);
    if (!res.ok) return { pricing: pricingOf(url, ""), error: `answered ${res.status}` };
    const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const desc = meta(html, "description") || meta(html, "og:description") || meta(html, "twitter:description");
    const short = (s: string) => { const f = s.split(/(?<=[.!?])\s/)[0]; return f.length > 160 ? f.slice(0, 157) + "…" : f; };
    return {
      title: title ? cleanTitle(title, u.hostname) : undefined,
      summary: desc ? short(desc) : undefined,
      pricing: pricingOf(url, `${title} ${desc} ${text}`),
    };
  } catch (err) {
    return { pricing: pricingOf(url, ""), error: (err as Error).message.slice(0, 80) };
  }
}

/** When a page says nothing readable about money (often a JavaScript-only page), a /pricing page means there's a paid tier. */
async function probePricing(url: string): Promise<Pricing> {
  const u = new URL(url);
  if (/(^|\.)(github|gitlab)\.com$/.test(u.hostname) || /(^|\.)(x|twitter)\.com$/.test(u.hostname)) return "unknown";
  try {
    const res = await fetch(`${u.origin}/pricing`, { headers: { "user-agent": "Mozilla/5.0 (Macintosh) condomdom/0.4" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
    if (!res.ok || new URL(res.url).pathname.replace(/\/$/, "") !== "/pricing") return "unknown"; // a redirect home isn't a pricing page
    const text = (await res.text()).replace(/<[^>]+>/g, " ");
    return /[$€£]\s?\d|per month|\/mo\b|lifetime/i.test(text) ? (/\bfree\b/i.test(text) ? "freemium" : "paid") : "unknown";
  } catch { return "unknown"; }
}

async function pool<T, R>(xs: T[], n: number, fn: (x: T, i: number) => Promise<R>) {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < xs.length) { const i = next++; out[i] = await fn(xs[i], i); } }));
  return out;
}

// ---------- main ----------
const lib: { items: Item[] } = JSON.parse(await readFile(LIBRARY, "utf8"));
const save = async () => {
  const tmp = LIBRARY + ".tmp";
  await writeFile(tmp, JSON.stringify(lib, null, 2) + "\n");
  await rename(tmp, LIBRARY);
};

if (pricingOnly) {
  const todo = lib.items.filter((i) => i.url && !i.pricing);
  const found = await pool(todo, 8, (i) => look(i.url!));
  todo.forEach((it, k) => { console.log(`${found[k].pricing.padEnd(8)} ${it.title}`); if (apply) it.pricing = found[k].pricing; });
  if (apply) await save();
  console.log(`\n${todo.length} checked.${apply ? " saved." : " dry run: add --apply to save."}`);
  process.exit(0);
}

if (!inbox) { console.error("usage: pnpm inbox content/inbox/<file>.md [--apply]"); process.exit(1); }
const entries = parse(await readFile(inbox, "utf8"));
const known = new Set(lib.items.filter((i) => i.url).map((i) => normal(i.url!)));
const fresh: Entry[] = [];
for (const e of entries) { const k = normal(e.url); if (!known.has(k)) { known.add(k); fresh.push(e); } }
console.log(`${entries.length} links in ${inbox}: ${fresh.length} new, ${entries.length - fresh.length} already in the library.\n`);

const ids = new Set(lib.items.map((i) => i.id));
const uniqueId = (base: string) => { let id = base; for (let n = 2; ids.has(id); n++) id = `${base}-${n}`; ids.add(id); return id; };
let done = 0;
const looked = await pool(fresh, 8, async (e) => {
  const r = await look(e.url);
  if (r.pricing === "unknown" && PRICED.includes(e.kind)) r.pricing = await probePricing(e.url);
  process.stdout.write(`\r  fetched ${++done}/${fresh.length}`);
  return r;
});
console.log("\n");

const added: Item[] = fresh.map((e, k) => {
  const r = looked[k];
  const u = new URL(e.url);
  const fallback = u.hostname.endsWith("github.com") ? u.pathname.split("/").filter(Boolean).slice(0, 2).join("/") : u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname.replace(/\/$/, "") : "");
  const repo = /(^|\.)(github|gitlab)\.com$/.test(u.hostname);
  // The site's own name: "butter" for app.butter.video, "open-slide" for demo.open-slide.dev, "jizura" hosts on *.github.io.
  const parts = u.hostname.replace(/^www\./, "").split(".");
  const shared = /\.(vercel\.app|github\.io|pages\.dev|netlify\.app|workers\.dev)$/.test(u.hostname);
  const site = shared ? parts[0] : parts[Math.max(0, parts.length - 2)];
  let title = repo ? fallback : r.title && r.title.length > 1 ? r.title : fallback;
  // A short title that doesn't name the site ("components", "Transitions") gets the site in front of it.
  if (!repo && !/(^|\.)(x|twitter)\.com$/.test(u.hostname) && title !== fallback && title.length <= 24 && !title.toLowerCase().replace(/[^a-z0-9]/g, "").includes(site.replace(/[^a-z0-9]/g, ""))) title = `${site} · ${title}`;
  const it: Item = {
    id: uniqueId(slug(title)), title, kind: e.kind, group: e.group || undefined, stage: e.stage, status: "to-try",
    pricing: PRICED.includes(e.kind) ? r.pricing : undefined, url: e.url, summary: r.summary, note: e.note, tags: [], added: today,
  };
  for (const key of Object.keys(it) as (keyof Item)[]) if (it[key] === undefined) delete it[key];
  console.log(`+ ${(it.pricing ?? "—").padEnd(8)} ${`${e.kind}/${e.group}`.padEnd(28)} ${title}${r.error ? `   (${r.error})` : ""}`);
  return it;
});

const counts = added.reduce<Record<string, number>>((a, i) => ((a[i.pricing ?? "no price"] = (a[i.pricing ?? "no price"] ?? 0) + 1), a), {});
console.log(`\n${added.length} new · ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
if (!apply) { console.log("dry run: add --apply to write them into content/library.json"); process.exit(0); }
lib.items = [...added, ...lib.items];
await save();
console.log("added. reload the page to see them.");
