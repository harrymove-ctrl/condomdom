# condomdom

My personal library of UI components, videos and skills, arranged around how I build.
It's inspired by [desengs.com](https://desengs.com/), but curated for my own workflow, and drawn in ascii with [ascii.rest](https://ascii.rest).

## Run

```bash
pnpm install
pnpm dev
```

Open http://127.0.0.1:4321. Needs Node 20.9+. The dev server only listens on your own machine, because the page can write to `content/library.json`.

## What's on the page

- **Boot screen**: the first time a tab opens it, ascii.rest's `boot-log` runs (a self test counts memory, then the boot log scrolls). Press any key to skip it.
- **Sidebar**: the library's structure as ascii.rest's `file-tree`, with a clickable tree under it. A folder filters the table, and a file opens the item.
- **Library**: a data table with an ascii preview of every link, sortable columns, a `(columns)` menu and pages of 15.
- **Filters**: `filter` → a column → its values, with counts. Each filter becomes a chip you can change or remove, after [sv-table's filters](https://sv-table.vercel.app/components/filters) / Bazza UI.
- **Search**: the boot log plays while a search settles.
- **Workflow**: one column per stage (inspire → design → build → ship → learn), with its playbook and its items.

## Design

Every screen follows [DESIGN.md](DESIGN.md), the UI/UX contract. It covers:
- **Type:** one monospace face.
- **Colour:** ink on paper in light and dark, greys only from ink opacity, one accent.
- **Layout:** a fixed spacing scale.
- **States:** rules for every state, motion and keyboard shortcut.

## Adding things

- In the page: press **n** (or click *(add)*), fill it in and save. It's written to `content/library.json`.
- By hand: edit `content/library.json`.
- Videos: copy the file into `media/videos/` and set `file` to `media/videos/<name>`.

Shortcuts: `/` search · `r` random pick · `n` add · `w` switch view · `t` theme (system → light → dark) · `esc` close.

## How the ascii previews are made

`GET /api/thumb/<id>` fetches the item's page on the server and picks its logo (falling back to its share image). It then decodes the image with `sharp` and draws it with `drawing()` from `ascii.rest/kit`, the same drawing ascii.rest's [image to ascii](https://ascii.rest/docs/images/) makes. The drawing is cached in `content/thumbs/<id>.json`, and the browser plays it with `fromDrawing()`. Add `?refresh=1` to redraw one. Delete the file to retry a link that failed.

## Files

```
app/
  layout.tsx, page.tsx, globals.css   the page; globals.css implements DESIGN.md
  api/items/                          add / edit / delete (writes content/library.json)
  api/thumb/[id]/                     a link → an ascii drawing, cached
  media/[...path]/                    streams media/ (videos, with seeking)
components/                           Library, Preloader, Sidebar, FilterBar, DataTable, Thumb, WorkflowBoard, Drawers
lib/                                  types, library storage, filter model, thumbnail maker
content/library.json                  all items
content/workflow.json                 stages + playbooks
content/thumbs/                       cached ascii previews
media/videos/                         local video files (ignored by git)
DESIGN.md                             the UI/UX contract
```
