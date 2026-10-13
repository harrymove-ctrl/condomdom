// Server-only: turns an item's link into an ascii drawing, the way ascii.rest/make does it in a browser.
// The page's og:image (or its icon) is fetched here, on the server, because browsers block other sites' images (CORS).
// Results, including failures, are cached in content/thumbs/<id>.json so each link is fetched once.
import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { drawing, type Drawing } from "ascii.rest/kit";
import type { Item } from "./types";

const CACHE = join(process.cwd(), "content", "thumbs");
const MAX_HTML = 512 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const TIMEOUT = 8000;

export type Thumb = { id: string; source: string | null; drawing: Drawing | null; error?: string; made: string };

async function fetchCapped(url: string, limit: number, accept: string) {
  const res = await fetch(url, {
    headers: { "user-agent": "condomdom/0.2 (+thumbnail)", accept },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT),
  });
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

// The best picture for 40 columns of ascii: the site's logo first (an icon draws as a clean "logo" piece, as
// ascii.rest's own logos are made), then its share image (usually a busy banner of text, which shades into noise).
function findImage(html: string, base: string): string | null {
  const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const icons = links
    .filter((l) => /(^|\s)(apple-touch-icon|icon)(\s|$)/i.test(attr(l, "rel") ?? ""))
    .map((l) => ({ href: attr(l, "href"), size: Number(attr(l, "sizes")?.match(/(\d+)x/)?.[1] ?? 0), svg: /svg/i.test(attr(l, "type") ?? attr(l, "href") ?? "") }))
    .filter((i): i is { href: string; size: number; svg: boolean } => !!i.href && !/\.ico(\?|$)/i.test(i.href)) // sharp can't read .ico
    .sort((a, b) => Number(b.svg) - Number(a.svg) || b.size - a.size);
  if (icons.length && (icons[0].svg || icons[0].size >= 64 || icons[0].size === 0)) return new URL(icons[0].href, base).href;
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of ["og:image", "og:image:url", "twitter:image", "twitter:image:src"]) {
    for (const m of metas) {
      if ((attr(m, "property") ?? attr(m, "name"))?.toLowerCase() === key) {
        const c = attr(m, "content");
        if (c) return new URL(c, base).href;
      }
    }
  }
  return icons[0] ? new URL(icons[0].href, base).href : null;
}

async function makeDrawing(imageUrl: string): Promise<Drawing> {
  const { buf } = await fetchCapped(imageUrl, MAX_IMAGE, "image/*");
  const { data, info } = await sharp(buf, { animated: false, limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // 40 x 16 cells, margin included: small enough for a table row, sharp enough for the drawer.
  return drawing(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), info.width, info.height, { width: 40, height: 16 });
}

export async function readThumb(id: string): Promise<Thumb | null> {
  try { return JSON.parse(await readFile(join(CACHE, `${id}.json`), "utf8")); } catch { return null; }
}

export async function makeThumb(item: Item): Promise<Thumb> {
  const made = new Date().toISOString();
  let thumb: Thumb;
  if (!item.url) {
    thumb = { id: item.id, source: null, drawing: null, error: "no link to take a picture from", made };
  } else {
    try {
      const page = await fetchCapped(item.url, MAX_HTML, "text/html,*/*");
      // A link straight to an image is its own picture.
      const imageUrl = page.type.startsWith("image/") ? page.finalUrl : findImage(page.buf.toString("utf8"), page.finalUrl);
      if (!imageUrl) throw new Error("the page has no share image or icon");
      thumb = { id: item.id, source: imageUrl, drawing: await makeDrawing(imageUrl), made };
    } catch (err) {
      thumb = { id: item.id, source: null, drawing: null, error: (err as Error).message.slice(0, 160), made };
    }
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(join(CACHE, `${item.id}.json`), JSON.stringify(thumb) + "\n");
  return thumb;
}
