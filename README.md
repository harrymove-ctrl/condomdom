# condomdom

My personal library of UI components, videos and skills, arranged around how I build.
It's inspired by [desengs.com](https://desengs.com/), but curated for my own workflow.

## Run

```bash
node server.mjs
```

Open http://localhost:4321. Node 20+; no dependencies, no build step.

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

Shortcuts: `/` search · `r` random pick · `n` add · `w` switch between Library and Workflow.

## Files

```
server.mjs              local server + save API (localhost only)
public/                 the site (index.html, styles.css, app.js)
content/library.json    all items
content/workflow.json   stages + playbooks
media/videos/           local video files (ignored by git)
```
