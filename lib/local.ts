// Server-only: reads your own resources on this Mac: a skill's folder, a video file.
// Only paths inside your home folder or the Dev drive are read, and folders are listed, never changed.
import "server-only";
import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const ALLOWED_ROOTS = [homedir(), "/Volumes/Dev"];
const SKIP = new Set(["node_modules", ".git", ".DS_Store", ".next", "target", "dist", ".turbo", "__pycache__"]);
const MAX_ENTRIES = 80;
const MAX_DEPTH = 3;

/** "~/x" or an absolute path → a real path inside an allowed root, or null. */
export async function resolveLocal(p: string | undefined): Promise<string | null> {
  if (!p) return null;
  const expanded = p.startsWith("~") ? join(homedir(), p.slice(1)) : resolve(process.cwd(), p);
  try {
    const real = await realpath(expanded);
    return ALLOWED_ROOTS.some((r) => real === r || real.startsWith(r + sep)) ? real : null;
  } catch {
    return null;
  }
}

export interface FolderTree {
  /** The tree as ascii.rest's file-tree piece takes it: one entry a line, two spaces a level, folders end in "/". */
  entries: string;
  dirs: number;
  files: number;
  truncated: boolean;
}

export async function readTree(dir: string): Promise<FolderTree> {
  const lines: string[] = [];
  let dirs = 0, files = 0, truncated = false;
  async function walk(d: string, depth: number) {
    let names: string[];
    try { names = (await readdir(d)).filter((n) => !SKIP.has(n) && !n.startsWith(".")); } catch { return; }
    const withKind = await Promise.all(names.map(async (n) => ({ n, dir: (await stat(join(d, n)).catch(() => null))?.isDirectory() ?? false })));
    // Folders first, then files, each A→Z; SKILL.md / README first among files, as you'd open them first.
    const first = (n: string) => (/^(skill|readme)\.md$/i.test(n) ? 0 : 1);
    withKind.sort((a, b) => Number(b.dir) - Number(a.dir) || first(a.n) - first(b.n) || a.n.localeCompare(b.n));
    for (const { n, dir: isDir } of withKind) {
      if (lines.length >= MAX_ENTRIES) { truncated = true; return; }
      lines.push(`${"  ".repeat(depth)}${n}${isDir ? "/" : ""}`);
      if (isDir) { dirs++; if (depth + 1 < MAX_DEPTH) await walk(join(d, n), depth + 1); }
      else files++;
    }
  }
  await walk(dir, 0);
  return { entries: lines.join("\n"), dirs, files, truncated };
}

/** The `description:` from a SKILL.md's front matter (or the first paragraph of a README). */
export async function readDescription(dir: string): Promise<string | null> {
  for (const name of ["SKILL.md", "skill.md", "README.md", "readme.md"]) {
    let text: string;
    try { text = await readFile(join(dir, name), "utf8"); } catch { continue; }
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (fm) {
      const block = fm[1];
      const inline = block.match(/^description:\s*(?!>|\|)(.+)$/m)?.[1];
      const folded = block.match(/^description:\s*[>|]-?\s*\n((?:\s{2,}.+\n?)+)/m)?.[1];
      const d = (inline ?? folded?.replace(/\s+/g, " "))?.trim().replace(/^["']|["']$/g, "");
      if (d) return d;
    }
    const para = text.replace(/^---[\s\S]*?---/, "").split(/\n\s*\n/).map((s) => s.replace(/^#.*$/gm, "").trim()).find(Boolean);
    if (para) return para.slice(0, 400);
  }
  return null;
}
