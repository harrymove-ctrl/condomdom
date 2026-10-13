// Server-only: reads and writes content/library.json. The app is meant to run on localhost.
import "server-only";
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { KINDS, STAGES, STATUSES, type Item, type Stage } from "./types";

const ROOT = process.cwd();
const LIBRARY = join(ROOT, "content", "library.json");
const WORKFLOW = join(ROOT, "content", "workflow.json");

export async function readItems(): Promise<Item[]> {
  return JSON.parse(await readFile(LIBRARY, "utf8")).items;
}

export async function readStages(): Promise<Stage[]> {
  return JSON.parse(await readFile(WORKFLOW, "utf8")).stages;
}

async function writeItems(items: Item[]) {
  const tmp = LIBRARY + ".tmp";
  await writeFile(tmp, JSON.stringify({ items }, null, 2) + "\n");
  await rename(tmp, LIBRARY); // atomic swap: a crash never leaves half a file
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";

export class InputError extends Error {}

function clean(input: Record<string, unknown>, existing?: Item): Item {
  const merged = { ...existing, ...input } as Record<string, unknown>;
  const title = typeof merged.title === "string" ? merged.title.trim() : "";
  if (!title) throw new InputError("title is required");
  if (!KINDS.includes(merged.kind as never)) throw new InputError(`kind must be one of ${KINDS.join(", ")}`);
  if (!STAGES.includes(merged.stage as never)) throw new InputError(`stage must be one of ${STAGES.join(", ")}`);
  const status = STATUSES.includes(merged.status as never) ? merged.status : "to-try";
  const tags = Array.isArray(merged.tags)
    ? merged.tags.map(String)
    : String(merged.tags ?? "").split(",");
  const url = typeof merged.url === "string" ? merged.url.trim() : "";
  if (url && !/^https?:\/\//i.test(url)) throw new InputError("link must start with http:// or https://");
  const opt = (k: string) => (typeof merged[k] === "string" && (merged[k] as string).trim() ? (merged[k] as string).trim() : undefined);
  const item: Item = {
    id: existing?.id ?? "",
    title,
    kind: merged.kind as Item["kind"],
    stage: merged.stage as Item["stage"],
    status: status as Item["status"],
    url: url || undefined,
    path: opt("path"),
    file: opt("file"),
    summary: opt("summary"),
    note: opt("note"),
    group: opt("group")?.toLowerCase(),
    tags: tags.map((t) => t.trim()).filter(Boolean),
    added: existing?.added ?? new Date().toISOString().slice(0, 10),
  };
  for (const k of Object.keys(item) as (keyof Item)[]) if (item[k] === undefined) delete item[k];
  return item;
}

export async function addItem(input: Record<string, unknown>): Promise<Item> {
  const items = await readItems();
  const item = clean(input);
  const taken = new Set(items.map((i) => i.id));
  let id = slug(item.title);
  for (let n = 2; taken.has(id); n++) id = `${slug(item.title)}-${n}`;
  item.id = id;
  await writeItems([item, ...items]);
  return item;
}

export async function updateItem(id: string, input: Record<string, unknown>): Promise<Item | null> {
  const items = await readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  items[idx] = clean(input, items[idx]);
  await writeItems(items);
  return items[idx];
}

export async function deleteItem(id: string): Promise<Item | null> {
  const items = await readItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const [removed] = items.splice(idx, 1);
  await writeItems(items);
  return removed;
}

export async function findItem(id: string) {
  return (await readItems()).find((i) => i.id === id) ?? null;
}
