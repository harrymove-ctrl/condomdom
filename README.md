# condomdom

My personal library of UI components, videos and skills, arranged around how I build.
It's inspired by [desengs.com](https://desengs.com/), but curated for my own workflow.

## Run

```bash
pnpm install
node server.mjs
```

Open http://localhost:4321. Needs Node 20+. There's no build step: the page loads [ascii.rest](https://ascii.rest) straight from `node_modules` through an import map.

## Design

Every screen follows [DESIGN.md](DESIGN.md), the UI/UX contract: one monospace face, ink on paper in light and dark, greys made only from ink opacity, one accent, and ascii.rest pieces for the motion (banner wordmark, typewriter tagline, donut, loading spinner, "nothing matches" state).

## How it's organised

Every item has:

| Field | Values |
|---|---|
| `kind` | component · video · skill · read · tool · inspiration |
| `stage` | inspire · design · build · ship · learn (my workflow) |
| `status` | **core** (always reach for it) · **using** · **to-try** |
| `url` / `path` / `file` | a website, a local folder (skills), or a video in `media/videos/` |
| `note` | why I keep it / how I use it |

- **Library** view: the searchable, filterable list.
- **Workflow** view: one column per stage, with the playbook from `content/workflow.json` and the items for that stage.

## Adding things

- In the page: press **n** (or click *(Add)*), fill it in, save. It's written to `content/library.json`.
- By hand: edit `content/library.json`.
- Videos: copy the file into `media/videos/` and set `file` to `media/videos/<name>`.

Shortcuts: `/` search · `r` random pick · `n` add · `w` switch between library and workflow · `t` theme (system → light → dark).

## Files

```
server.mjs              local server + save API (localhost only)
public/                 the site (index.html, styles.css, app.js)
DESIGN.md               the UI/UX contract
content/library.json    all items
content/workflow.json   stages + playbooks
media/videos/           local video files (ignored by git)
```
