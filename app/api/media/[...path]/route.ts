// GET /api/media/shots/<id>.webp · /api/media/og/<id>.webp: screenshots and share images made by pnpm enrich.
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

const MEDIA = join(process.cwd(), "media");

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = normalize((await params).path.join("/"));
  if (!/^(shots|og)\/[a-z0-9-]+\.webp$/.test(rel.split(sep).join("/"))) return new Response("not found", { status: 404 });
  try {
    const body = await readFile(join(MEDIA, rel));
    return new Response(body, { headers: { "content-type": "image/webp", "cache-control": "public, max-age=3600" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
