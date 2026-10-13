// pnpm scan: find your own resources on this Mac and add the ones the library doesn't have yet.
//   pnpm scan                          skills in ~/.agents/skills and ~/.claude/skills (dry run)
//   pnpm scan --videos ~/Movies/demos  also every video in that folder
//   … --apply                          write them into content/library.json
// New items come in as "to try" at the "build" stage (videos at "ship"); change them in the page.
import { readdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

type Item = Record<string, unknown> & { id: string; title: string; path?: string; file?: string };

const HOME = homedir();
const LIBRARY = join(process.cwd(), "content", "library.json");
const SKILL_DIRS = [join(HOME, ".agents", "skills"), join(HOME, ".claude", "skills")];
const VIDEO = new Set([".mp4", ".mov", ".m4v", ".webm"]);
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const videoDir = args.includes("--videos") ? args[args.indexOf("--videos") + 1] : null;
const tilde = (p: string) => (p.startsWith(HOME) ? "~" + p.slice(HOME.length) : p);
const expand = (p: string) => (p.startsWith("~") ? join(HOME, p.slice(1)) : p);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "item";
const today = new Date().toISOString().slice(0, 10);

async function description(dir: string) {
  try {
    const text = await readFile(join(dir, "SKILL.md"), "utf8");
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
    const inline = fm.match(/^description:\s*(?!>|\|)(.+)$/m)?.[1];
    const folded = fm.match(/^description:\s*[>|]-?\s*\n((?:\s{2,}.+\n?)+)/m)?.[1];
    const d = (inline ?? folded?.replace(/\s+/g, " "))?.trim().replace(/^["']|["']$/g, "") ?? "";
    const short = (s: string) => { const first = s.split(/(?<=[.!?])\s/)[0]; return first.length > 160 ? first.slice(0, 157) + "…" : first; };
    // A description that is a list of trigger phrases ("…asks to "x", "y"…") says when, not what:
    // then the first paragraph under the SKILL.md's title, which says what the skill does, is the summary.
    if (d && !/", "/.test(d) && !/^This skill should be used/i.test(d)) return short(d);
    const body = text.replace(/^---[\s\S]*?\n---\n/, "").replace(/<!--[\s\S]*?-->/g, "");
    for (const para of body.split(/\n\s*\n/)) {
      const p = para.split("\n").map((l) => l.trim()).filter((l) => l && !/^(#|\||-|\*|>|```)/.test(l)).join(" ");
      if (p.length > 20) return short(p);
    }
    return short(d);
  } catch { return ""; }
}

const lib: { items: Item[] } = JSON.parse(await readFile(LIBRARY, "utf8"));
// Compared by real path: ~/.claude/skills often links to the same folders as ~/.agents/skills.
const real = (p: string) => realpath(p).catch(() => p);
const known = new Set(await Promise.all(lib.items.flatMap((i) => [i.path, i.file].filter(Boolean).map((p) => real(expand(String(p)))))));
const TEST = /(^|-)test(-|$)|^my-skill$/; // scratch skills, not resources
const ids = new Set(lib.items.map((i) => i.id));
const found: Item[] = [];
const uniqueId = (base: string) => { let id = base; for (let n = 2; ids.has(id); n++) id = `${base}-${n}`; ids.add(id); return id; };

for (const root of SKILL_DIRS) {
  let names: string[] = [];
  try { names = await readdir(root); } catch { continue; }
  for (const name of names.sort()) {
    const dir = join(root, name);
    const key = await real(dir);
    if (TEST.test(name) || known.has(key) || !(await stat(join(dir, "SKILL.md")).catch(() => null))) continue;
    known.add(key);
    found.push({
      id: uniqueId(slug(name)), title: name, kind: "skill", stage: "build", status: "to-try",
      path: tilde(dir), summary: await description(dir) || undefined, tags: ["agent-skill"], added: today,
    });
  }
}

if (videoDir) {
  const dir = expand(videoDir);
  for (const name of (await readdir(dir)).sort()) {
    const file = join(dir, name);
    const key = await real(file);
    if (!VIDEO.has(extname(name).toLowerCase()) || known.has(key)) continue;
    known.add(key);
    const title = basename(name, extname(name)).replace(/[-_]+/g, " ").trim();
    found.push({ id: uniqueId(slug("video " + title)), title, kind: "video", stage: "ship", status: "to-try", file: tilde(file), tags: ["video"], added: today });
  }
}

for (const it of found) console.log(`+ ${String(it.kind).padEnd(6)} ${it.title.padEnd(32)} ${it.path ?? it.file}`);
console.log(`\n${found.length} new, ${lib.items.length} already in the library.`);
if (!found.length) process.exit(0);
if (!apply) { console.log("dry run: add --apply to write them into content/library.json"); process.exit(0); }

for (const it of found) for (const k of Object.keys(it)) if (it[k] === undefined) delete it[k];
const tmp = LIBRARY + ".tmp";
await writeFile(tmp, JSON.stringify({ items: [...found, ...lib.items] }, null, 2) + "\n");
await rename(tmp, LIBRARY);
console.log(`added ${found.length}. reload the page to see them.`);
