# condomdom

My personal library of UI components, videos and skills, arranged around how I build.

Drawn in ASCII, under the project name condomdom. Inspired by [desengs.com](https://desengs.com/), but curated for my own workflow, and drawn with [ascii.rest](https://ascii.rest).

## Run

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:4321. Needs Node 20.9+. The dev server only listens on your own machine, because the page can write to `content/library.json`.

## What's on the page

- **Boot screen**: the first time a tab opens it, ascii.rest's `boot-log` runs (a self test counts memory, then the boot log scrolls). Press any key to skip it.
- **Library**: a data table with a preview for every item, sortable columns, a `(columns)` menu and pages of 15.
- **Explorer**: your collections as a tree on the left and the chosen item large on the right. A skill shows its real folder as ascii.rest's `file-tree`, a link shows its logo, and a video shows a frame plus the player.
- **Filters**: `filter` → a column → its values, with counts. Each filter becomes a chip you can change or remove, after [sv-table's filters](https://sv-table.vercel.app/components/filters) / Bazza UI.
- **Search**: the boot log plays while a search settles.
- **Workflow**: one column per stage (inspire → design → build → ship → learn), with its playbook and its items.

## Design

Every screen follows [DESIGN.md](DESIGN.md), the UI/UX contract. It covers:
- **Type:** one monospace face.
- **Colour:** ink on paper in light and dark, greys only from ink opacity, one accent.
- **Layout:** a fixed spacing scale.
- **States:** rules for every state, motion and keyboard shortcut.

## Adding your own resources

Each item points at where the resource lives:

| field | for | preview |
|---|---|---|
| `url` | a website, a repo | the site's logo as ascii |
| `path` | a folder on this Mac: a project (`~/Documents/dev/Prydea`) | its real file tree + README description |
| `file` | a video anywhere in your home folder or on the Dev drive (`~/Downloads/demo.mp4`) | a frame as ascii, plus the player |

Every item also has a **kind** (component, skill pages on the web, read, tool, inspiration, video) and an optional **group**: a category inside the kind, such as `animated-react`, `svelte`, `glass & effects` or `primitives`. Groups are folders in the explorer, a column in the table and a filter. Set or change one in the editor: pick an existing group or type a new one.

Every component, tool and skill also has a **pricing**: `free`, `free + pro` (free to start, with paid parts), `paid`, or `?` when it isn't clear. References, portfolios and articles have none. It's a column in the table, a filter (**filter → pricing**), a badge on every item, and a field in the editor. Pricing found by the importer is a best guess from the site's own words, so correct it in the editor when you know better.

### The inbox: adding many links at once

1. Write your links into `content/inbox/<date>.md`: one `## kind / group` heading per section, one `- link — note` a line, and optionally `stage: design` under a heading. See `content/inbox/2026-10-13.md`.
2. `pnpm inbox content/inbox/<date>.md` fetches every new link and shows what it would add: title, summary, pricing, group. Links already in the library are skipped.
3. `pnpm inbox content/inbox/<date>.md --apply` adds them as "to try".
4. `pnpm inbox --pricing --apply` checks pricing for older items that don't have it.

Other ways to add items:

- **In the page:** press **n** (or click *(add)*).
- **By hand:** edit `content/library.json`.

Opening an item shows it as a panel: **side**, **center** (a card over the blurred page) or **full**. Switch in the panel's header or with `m`.

Shortcuts: `/` search · `r` random pick · `n` add · `e` explorer · `w` next view · `m` panel mode · `t` theme (system → light → dark) · `esc` close.

## How previews are made

`GET /api/preview/<id>` makes each item's preview:
- **Link:** fetch the page, pick its logo (or share image), decode it with `sharp` and draw it with `drawing()` from `ascii.rest/kit`. This is the same drawing ascii.rest's [image to ascii](https://ascii.rest/docs/images/) makes.
- **Folder:** read the folder's tree and its SKILL.md / README.
- **Video:** grab a frame with `ffmpeg` and draw it the same way.

Drawings are cached in `content/thumbs/<id>.json`. Add `?refresh=1` to redraw one. Videos stream from `/api/video/<id>`.

## Files

```
app/
  layout.tsx, page.tsx, globals.css   the page; globals.css implements DESIGN.md
  api/items/                          add / edit / delete (writes content/library.json)
  api/preview/[id]/                   link → logo, folder → tree, video → frame
  api/video/[id]/                     streams an item's video, with seeking
components/                           Library, Preloader, Explorer, FilterBar, DataTable, Preview, WorkflowBoard, Drawers
lib/                                  types, library storage, filter model, previews, local files
content/library.json                  all items
content/workflow.json                 stages + playbooks
content/thumbs/                       cached ascii previews
DESIGN.md                             the UI/UX contract
```
