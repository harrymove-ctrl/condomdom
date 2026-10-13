// pnpm enrich [--force] [--only <id>]
// For every item with a link: a screenshot of the page as you'd see it, the site's share image, and a longer
// description read from the page after its JavaScript has run (headless Chrome), so sites that are empty without
// JavaScript get a description and a pricing too. Images go to media/ (kept out of git); text goes into the library.
// Resumable: items that already have a screenshot are skipped unless --force.
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { pricingOf } from "./pricing.ts";

const run = promisify(execFile);
const ROOT = process.cwd();
const LIBRARY = join(ROOT, "content", "library.json");
const SHOTS = join(ROOT, "media", "shots");
const OG = join(ROOT, "media", "og");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = process.argv.slice(2);
const force = args.includes("--force");
// --only a,b,c redoes just those items; --wait ms gives slow pages (WebGL, canvas) longer to draw before the shot.
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const WAIT = args.includes("--wait") ? Number(args[args.indexOf("--wait") + 1]) : 7000;
const PRICED = ["component", "tool", "skill"];

type Item = Record<string, unknown> & { id: string; title: string; kind: string; url?: string; summary?: string; about?: string; pricing?: string; media?: { shot?: string; og?: string } };

const exists = (p: string) => stat(p).then(() => true, () => false);
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#39;|&apos;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const meta = (html: string, name: string) => {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase() === name) return decode(tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1] ?? "");
  }
  return "";
};

async function chrome(flags: string[], url: string, ms = 30000 + WAIT) {
  const profile = await mkdtemp(join(tmpdir(), "condomdom-chrome-"));
  try {
    return await run(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, "--window-size=1440,900", `--virtual-time-budget=${WAIT}`, ...flags, url,
    ], { timeout: ms, maxBuffer: 32 * 1024 * 1024, encoding: "utf8" });
  } finally {
    await rm(profile, { recursive: true, force: true });
  }
}

/** A few sentences that say what the thing is: the description, then the page's own opening paragraphs. */
function aboutOf(html: string, summary?: string) {
  const body = html.replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ");
  const paras = [...body.matchAll(/<(p|h2)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => decode(m[2].replace(/<[^>]+>/g, " ")))
    .filter((t) => t.length >= 40 && t.length <= 400 && !/cookie|©|all rights reserved|sign in|log in|subscribe|newsletter/i.test(t));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [meta(html, "description") || meta(html, "og:description"), ...paras]) {
    const k = t.toLowerCase().slice(0, 60);
    if (!t || seen.has(k) || (summary && summary.toLowerCase().startsWith(k.slice(0, 40)))) continue;
    seen.add(k); out.push(t.replace(/\s+([.,!?])/g, "$1"));
    if (out.join(" ").length > 420) break;
  }
  const text = out.join(" ").trim();
  return text.length > 480 ? text.slice(0, 477).replace(/\s\S*$/, "") + "…" : text;
}

async function saveImage(input: Buffer, file: string, width: number) {
  await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(file);
}

async function enrich(it: Item) {
  const u = new URL(it.url!);
  const result: string[] = [];
  const isX = /(^|\.)(x|twitter)\.com$/.test(u.hostname);

  // 1. the rendered page: description, share image, pricing
  let html = "";
  if (!isX) {
    try { html = (await chrome(["--dump-dom"], it.url!)).stdout; } catch (e) { result.push(`page: ${(e as Error).message.split("\n")[0].slice(0, 60)}`); }
  }
  if (html) {
    const about = aboutOf(html, it.summary);
    if (about && about !== it.summary) { it.about = about; result.push("about"); }
    if (!it.summary) { const d = meta(html, "description") || meta(html, "og:description"); if (d) it.summary = d.split(/(?<=[.!?])\s/)[0].slice(0, 160); }
    if (PRICED.includes(it.kind) && (!it.pricing || it.pricing === "unknown")) {
      const p = pricingOf(it.url!, decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")));
      if (p !== "unknown") { it.pricing = p; result.push(`pricing ${p}`); }
    }
    const og = meta(html, "og:image") || meta(html, "twitter:image");
    if (og) {
      try {
        const res = await fetch(new URL(og, it.url).href, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Mozilla/5.0 condomdom" } });
        if (res.ok) {
          await saveImage(Buffer.from(await res.arrayBuffer()), join(OG, `${it.id}.webp`), 1200);
          it.media = { ...it.media, og: `og/${it.id}.webp` }; result.push("share image");
        }
      } catch { /* a share image is a bonus */ }
    }
  }

  // 2. the screenshot (x.com shows a login wall to logged-out browsers, so posts are skipped)
  if (!isX) {
    const png = join(tmpdir(), `condomdom-${it.id}-${Date.now()}.png`);
    try {
      await chrome([`--screenshot=${png}`], it.url!);
      if (await exists(png)) {
        await saveImage(await readFile(png), join(SHOTS, `${it.id}.webp`), 1440);
        it.media = { ...it.media, shot: `shots/${it.id}.webp` }; result.push("screenshot");
      }
    } catch (e) { result.push(`screenshot: ${(e as Error).message.split("\n")[0].slice(0, 50)}`); }
    finally { await rm(png, { force: true }); }
  }
  return result;
}

await mkdir(SHOTS, { recursive: true });
await mkdir(OG, { recursive: true });
const lib: { items: Item[] } = JSON.parse(await readFile(LIBRARY, "utf8"));
const todo: Item[] = [];
for (const it of lib.items) {
  if (!it.url || (only && !only.has(it.id))) continue;
  if (!force && !only && it.media?.shot && (await exists(join(ROOT, "media", it.media.shot)))) continue;
  todo.push(it);
}
console.log(`${todo.length} items to enrich (${lib.items.filter((i) => i.url).length - todo.length} already done).`);

// Saves run one after another, so two workers never write the file at once.
let saving = Promise.resolve();
const save = () => (saving = saving.then(async () => {
  const tmp = LIBRARY + ".tmp";
  await writeFile(tmp, JSON.stringify(lib, null, 2) + "\n");
  await rename(tmp, LIBRARY);
}));
let next = 0, done = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < todo.length) {
    const it = todo[next++];
    const r = await enrich(it).catch((e) => [`failed: ${(e as Error).message.slice(0, 60)}`]);
    console.log(`[${++done}/${todo.length}] ${it.title.slice(0, 40).padEnd(40)} ${r.join(" · ") || "nothing new"}`);
    if (done % 10 === 0) await save(); // progress survives an interruption
  }
}));
await save();
console.log("done. reload the page to see the images.");
