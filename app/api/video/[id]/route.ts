// GET /api/video/<id>: streams an item's video from wherever it lives on this Mac (inside home or the Dev drive),
// with range requests so the player can seek. Only files named by an item can be streamed.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { Readable } from "node:stream";
import { findItem } from "@/lib/library";
import { resolveLocal } from "@/lib/local";

const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const item = await findItem((await params).id);
  const file = await resolveLocal(item?.file);
  if (!file) return new Response("not found", { status: 404 });
  const size = (await stat(file)).size;
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    const body = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(body, { status: 206, headers: { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": String(end - start + 1) } });
  }
  const body = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(body, { headers: { "content-type": type, "accept-ranges": "bytes", "content-length": String(size) } });
}
