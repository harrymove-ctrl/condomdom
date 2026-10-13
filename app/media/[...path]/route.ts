// Streams files from media/ (videos) with range requests, so the <video> player can seek.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";

const MEDIA = join(process.cwd(), "media");
const TYPES: Record<string, string> = { ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const file = join(MEDIA, normalize((await params).path.join("/")));
  if (!file.startsWith(MEDIA + "/")) return new Response("forbidden", { status: 403 });
  let size: number;
  try { size = (await stat(file)).size; } catch { return new Response("not found", { status: 404 }); }
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
