// Server-only: one preview for every item, made from where the resource actually lives (DESIGN.md §7):
//   link   → the site's logo (or share image) drawn as ascii, as ascii.rest/make draws an image
//   folder → the folder's real file tree, plus its SKILL.md / README description
//   video  → a frame from the video (ffmpeg) drawn as ascii
// Drawings are cached in content/thumbs/<id>.json; folder trees are read fresh each time, so they stay true.
import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { drawing, type Drawing } from "ascii.rest/kit";
import { readDescription, readTree, resolveLocal, type FolderTree } from "./local";
import type { Item } from "./types";

const run = promisify(execFile);
const CACHE = join(process.cwd(), "content", "thumbs");
const MAX_HTML = 512 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const TIMEOUT = 8000;

export type Source = "link" | "folder" | "video" | "none";
export interface Preview {
  id: string;
  source: Source;
  drawing?: Drawing | null;
  tree?: FolderTree;
  description?: string | null;
  from?: string | null;   // the image URL or file the drawing came from
  error?: string;
  made: string;
}

export function sourceOf(item: Item): Source {
  if (item.file) return "video";
  if (item.path) return "folder";
  if (item.url) return "link";
  return "none";
}

// ---------- links ----------
async function fetchCapped(url: string, limit: number, accept: string) {
  const res = await fetch(url, { headers: { "user-agent": "condomdom/0.3 (+preview)", accept }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok || !res.body) throw new Error(`${new URL(url).host} answered ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); break; }
    chunks.push(value);
  }
  return { buf: Buffer.concat(chunks), type: res.headers.get("content-type") ?? "", finalUrl: res.url || url };
}

// The site's logo first (it draws as a clean "logo" piece, like ascii.rest's own logos),
// then its share image (usually a busy banner of text, which shades into noise at 40 columns).
function findImage(html: string, base: string): string | null {
  const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  const icons = (html.match(/<link\b[^>]*>/gi) ?? [])
    .filter((l) => /(^|\s)(apple-touch-icon|icon)(\s|$)/i.test(attr(l, "rel") ?? ""))
    .map((l) => ({ href: attr(l, "href"), size: Number(attr(l, "sizes")?.match(/(\d+)x/)?.[1] ?? 0), svg: /svg/i.test(attr(l, "type") ?? attr(l, "href") ?? "") }))
    .filter((i): i is { href: string; size: number; svg: boolean } => !!i.href && !/\.ico(\?|$)/i.test(i.href)) // sharp can't read .ico
    .sort((a, b) => Number(b.svg) - Number(a.svg) || b.size - a.size);
  if (icons.length && (icons[0].svg || icons[0].size >= 64 || icons[0].size === 0)) return new URL(icons[0].href, base).href;
  for (const key of ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) {
    for (const m of html.match(/<meta\b[^>]*>/gi) ?? []) {
      if ((attr(m, "property") ?? attr(m, "name"))?.toLowerCase() === key) {
        const c = attr(m, "content");
        if (c) return new URL(c, base).href;
      }
    }
  }
  return icons[0] ? new URL(icons[0].href, base).href : null;
}

async function draw(buf: Buffer): Promise<Drawing> {
  const { data, info } = await sharp(buf, { animated: false, limitInputPixels: 40_000_000 })
    .rotate().resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return drawing(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { width: 40, height: 16 });
}

async function linkPreview(item: Item): Promise<Pick<Preview, "drawing" | "from">> {
  const page = await fetchCapped(item.url!, MAX_HTML, "text/html,*/*");
  const imageUrl = page.type.startsWith("image/") ? page.finalUrl : findImage(page.buf.toString("utf8"), page.finalUrl);
  if (!imageUrl) throw new Error("the page has no logo or share image");
  return { drawing: await draw((await fetchCapped(imageUrl, MAX_IMAGE, "image/*")).buf), from: imageUrl };
}

// ---------- videos ----------
async function videoPreview(file: string): Promise<Pick<Preview, "drawing" | "from">> {
  // A frame a second in (past any fade from black), as a PNG on stdout.
  const { stdout } = await run("ffmpeg", ["-v", "error", "-ss", "1", "-i", file, "-frames:v", "1", "-vf", "scale=480:-2", "-f", "image2pipe", "-vcodec", "png", "-"], {
    encoding: "buffer", timeout: 15000, maxBuffer: 16 * 1024 * 1024,
  });
  if (!stdout.length) throw new Error("ffmpeg returned no frame");
  return { drawing: await draw(stdout), from: file };
}

// ---------- cache + entry point ----------
async function readCache(id: string): Promise<Preview | null> {
  try { return JSON.parse(await readFile(join(CACHE, `${id}.json`), "utf8")); } catch { return null; }
}
async function writeCache(p: Preview) {
  await mkdir(CACHE, { recursive: true });
  await writeFile(join(CACHE, `${p.id}.json`), JSON.stringify(p) + "\n");
}

export async function previewOf(item: Item, refresh = false): Promise<Preview> {
  const made = new Date().toISOString();
  const source = sourceOf(item);

  if (source === "folder") {
    const dir = await resolveLocal(item.path);
    if (!dir || !(await stat(dir)).isDirectory()) return { id: item.id, source, error: `can't open ${item.path}`, made };
    const [tree, description] = await Promise.all([readTree(dir), readDescription(dir)]);
    return { id: item.id, source, tree, description, made };
  }
  if (source === "none") return { id: item.id, source, error: "no link, folder or file", made };

  if (!refresh) {
    const cached = await readCache(item.id);
    if (cached && cached.source === source) return cached;
  }
  let p: Preview;
  try {
    if (source === "video") {
      const file = await resolveLocal(item.file);
      if (!file) throw new Error(`can't find ${item.file}`);
      p = { id: item.id, source, ...(await videoPreview(file)), made };
    } else {
      p = { id: item.id, source, ...(await linkPreview(item)), made };
    }
  } catch (err) {
    p = { id: item.id, source, drawing: null, error: (err as Error).message.slice(0, 160), made };
  }
  await writeCache(p);
  return p;
}
