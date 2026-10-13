// condomdom local server: serves the site and saves edits back into content/library.json.
// No dependencies. Run: node server.mjs   (PORT=4321 by default, localhost only)
import { createServer } from "node:http";
import { readFile, writeFile, rename, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(ROOT, "public");
const LIBRARY = join(ROOT, "content", "library.json");
const PORT = Number(process.env.PORT) || 4321;

const KINDS = ["component", "video", "skill", "read", "tool", "inspiration"];
const STAGES = ["inspire", "design", "build", "ship", "learn"];
const STATUSES = ["core", "using", "to-try"];

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/quicktime",
  ".webm": "video/webm",
};

const readLibrary = async () => JSON.parse(await readFile(LIBRARY, "utf8"));
async function writeLibrary(lib) {
  const tmp = LIBRARY + ".tmp";
  await writeFile(tmp, JSON.stringify(lib, null, 2) + "\n");
  await rename(tmp, LIBRARY); // atomic swap so a crash never leaves half a file
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";

function clean(input, existing = {}) {
  const item = { ...existing, ...input };
  if (!item.title || typeof item.title !== "string") throw new Error("title is required");
  if (!KINDS.includes(item.kind)) throw new Error(`kind must be one of ${KINDS.join(", ")}`);
  if (!STAGES.includes(item.stage)) throw new Error(`stage must be one of ${STAGES.join(", ")}`);
  if (!STATUSES.includes(item.status)) item.status = "to-try";
  item.tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : String(item.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  for (const k of ["url", "path", "file", "summary", "note"]) if (item[k] == null || item[k] === "") delete item[k];
  item.added ||= new Date().toISOString().slice(0, 10);
  return item;
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > 1e6) throw new Error("body too large"); }
  return raw ? JSON.parse(raw) : {};
}

const send = (res, code, data) => {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
};

async function api(req, res, path) {
  const lib = await readLibrary();
  if (req.method === "GET" && path === "/api/library") return send(res, 200, lib);

  if (req.method === "POST" && path === "/api/items") {
    const item = clean(await body(req));
    let id = item.id ? slug(item.id) : slug(item.title);
    const taken = new Set(lib.items.map((i) => i.id));
    for (let n = 2; taken.has(id); n++) id = `${slug(item.title)}-${n}`;
    item.id = id;
    lib.items.unshift(item);
    await writeLibrary(lib);
    return send(res, 201, item);
  }

  const m = path.match(/^\/api\/items\/([^/]+)$/);
  if (m) {
    const idx = lib.items.findIndex((i) => i.id === decodeURIComponent(m[1]));
    if (idx < 0) return send(res, 404, { error: "not found" });
    if (req.method === "PUT") {
      lib.items[idx] = clean({ ...(await body(req)), id: lib.items[idx].id }, lib.items[idx]);
      await writeLibrary(lib);
      return send(res, 200, lib.items[idx]);
    }
    if (req.method === "DELETE") {
      const [removed] = lib.items.splice(idx, 1);
      await writeLibrary(lib);
      return send(res, 200, removed);
    }
  }
  return send(res, 404, { error: "unknown endpoint" });
}

async function serveFile(req, res, file) {
  const info = await stat(file);
  const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/); // video seeking
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : info.size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${info.size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": info.size, "accept-ranges": "bytes", "cache-control": "no-cache" });
  createReadStream(file).pipe(res);
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  try {
    if (path.startsWith("/api/")) return await api(req, res, path);
    // /content/*, /media/* and the ascii.rest package come from the project root, everything else from public/
    const clean = normalize(path === "/" ? "/index.html" : path); // collapse ../ before checking the prefix
    const fromRoot = ["/content/", "/media/", "/node_modules/ascii.rest/dist/"].some((p) => clean.startsWith(p));
    const base = fromRoot ? ROOT : PUBLIC;
    const file = resolve(base, "." + clean);
    if (!file.startsWith(base)) return send(res, 403, { error: "forbidden" });
    await serveFile(req, res, file);
  } catch (err) {
    if (err.code === "ENOENT") return send(res, 404, { error: "not found" });
    send(res, 400, { error: err.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`condomdom running at http://localhost:${PORT}`));
