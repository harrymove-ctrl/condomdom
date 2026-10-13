# condomdom — UI/UX contract

Every screen in condomdom follows this contract. If a change breaks a rule here, change the rule here first, on purpose.

The look comes from [ascii.rest](https://ascii.rest): plain text, one monospace face, ink on paper, and nothing that moves without a reason.

---

## 1. Typography

| Rule | Value |
|---|---|
| Family | **one face**: `JetBrains Mono`, falling back to `ui-monospace, SFMono-Regular, Menlo, monospace`. No serif, no sans. Loaded **whole** from Google Fonts, never through `next/font`: the ascii art needs its block and box-drawing glyphs (`▓ ╭ │`), which no `next/font` subset includes. |
| Weights | `400` for everything, `500` for titles and the active state. Nothing else. |
| Scale (px) | `12` meta · `13` labels, pills, buttons · `15` body · `18` lede · `28` panel title |
| Line height | `1.6` body · `1.25` titles · `1` for ascii art (set by the piece) |
| Measure | max `72ch` per line |
| Numbers | `font-variant-numeric: tabular-nums` wherever numbers line up (stats, dates) |

Token names: `--text-xs` 12, `--text-sm` 13, `--text-md` 15, `--text-lg` 18, `--text-xl` 28.

## 2. Text and voice

- **Interface labels are lowercase**: `library`, `workflow`, `add`, `clear all`. Content keeps its own case: titles exactly as the maker writes them.
- Nav and actions are wrapped in parentheses: `(library)` `(workflow)` `(random)` `(add)`. The active one is underlined.
- Dates are `YYYY-MM-DD` in tabular figures.
- Write labels as verbs or nouns, never both in one place. Buttons are verbs (`save`, `delete`, `open ↗`); filters are nouns (`components`, `core`).
- Empty, loading and error states always say what happened and what to do next, in one line.
- Use no emoji in the UI. Glyphs come from the font: `●` `○` `◐` `↗` `→` `·` `—`.

## 3. Color

There is **one ink, one paper, one accent**. Every grey is the ink at a set opacity (§4), never a separate hex.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#f7f6f2` | `#0d0d0c` | page background |
| `--paper-raised` | `#ffffff` | `#151513` | drawers, cards, inputs |
| `--ink` | `#1b1a17` | `#e9e6df` | text, borders (via opacity) |
| `--accent` | `#e8590c` | `#ff8a3d` | core status, focus ring, active underline, ascii highlight |
| `--danger` | `#c92a2a` | `#ff6b6b` | delete only |

The accent is rationed: it marks **core** items, the focused element and the active view. If more than ~5% of the screen is accent, something is wrong.

## 4. Opacity

The fixed scale that every grey is made from: `color-mix(in srgb, var(--ink) N%, transparent)`.

| Token | Ink at | Use |
|---|---|---|
| `--ink-100` | 100% | titles, active text |
| `--ink-80` | 80% | body text |
| `--ink-60` | 60% | secondary text, summaries |
| `--ink-40` | 40% | meta, labels, placeholders |
| `--ink-16` | 16% | borders, rules |
| `--ink-08` | 8% | subtle fills, hover rows |
| `--ink-04` | 4% | pressed and selected backgrounds |

Disabled = `--ink-40` text on no fill. Never use opacity on a whole element that contains text; use the token on the color.

## 5. Light and dark mode

- Three modes: **light**, **dark** and **auto** (follow the Mac; the default). The `☀ light · ☾ dark · auto` toggle sits top right; `t` flips between light and dark. The choice is remembered per browser.
- `<html data-theme="light|dark">` overrides; with no attribute, `prefers-color-scheme` decides.
- The theme is applied before first paint (inline script in `<head>`), so there's no flash.
- Ascii pieces read the text color, so they redraw correctly in either mode with no extra code.
- Both modes must pass WCAG AA: `--ink-60` on `--paper` ≥ 4.5:1 for body-size text.

## 6. Layout

| Rule | Value |
|---|---|
| Shell | one column, `min(1920px, 100% - 64px)`: the full width of the screen, under a top bar (name left, theme toggle right). No sidebar: structure lives in the **explorer** view, at a size you can read. |
| Spacing scale | `4 8 12 16 24 32 48 72` px only (`--s-1` … `--s-8`) |
| Radius | `6px` controls, `10px` panels; pills are fully rounded |
| Borders | `1px solid var(--ink-16)`; section breaks are `1px dashed var(--ink-16)` |
| Breakpoints | `960px` (explorer tree stacks above its pane, workflow columns stack) · `700px` (table keeps preview, title, status) · `560px` (table keeps title, status; form rows stack) |
| Scroll | never horizontal at any width ≥ 320px |

Page order is always: boot screen (first visit) → hero → toolbar → view → footer.

## 7. Views and states

| View | What it is | Required states |
|---|---|---|
| **boot screen** | ascii.rest `typewriter` over the whole page: `condomdom › opening components… skill packs… reads… ready.` First visit in a tab only (3.4s); any key or click skips it. | reduced motion: 0.5s, still |
| **explorer** | a 320px tree of your collections (folders = kinds, then groups inside them, e.g. `components/animated-react/`; core first, each file says where it lives: `link` · `folder` · `video`), and the chosen item large on the right. ↑/↓ move through the tree. With nothing chosen (or `condomdom/` clicked) the right side is the **whole library as ascii.rest's `file-tree`**, each collection with its first three files, plus every file as a `├──` tree | nothing yet |
| **library** | a data table: preview, title, kind, stage, status, tags, added. Sortable headers, a `(columns)` menu, pages of 15 | searching · empty (filters) · empty (no items) |
| **workflow** | one column per stage: question, playbook, items (core first) | loading · empty stage (`nothing here yet`) |
| **detail** (and **editor**) | an item panel in one of three modes, chosen with `side · center · full` in its header or `m`, remembered per browser: **side** a 560px right-hand drawer · **center** a 760px card in the middle · **full** the whole page with content in an 880px reading column. Every mode sits over the page **blurred** (8px, paper at 45%). Contents: kicker, title, summary, preview, note, tags, links | broken preview says why |
| **editor** | right-hand drawer form for add/edit/delete | validation error inline · saving · delete confirm |

- **Searching**: while a search settles (650ms), the table area plays `boot-log` with `searching for “…”…`. Clearing the search is instant.
- **Filters** follow Bazza UI / sv-table: `filter` → a column → its values with counts. Each filter is a chip, `column · operator · values · ×`; click the operator to cycle it (`is any of` / `is none of`, `contains` / `does not contain`, `include any of` / `include all of` / `exclude`, `is after` / `is before` / `is on`), click the values to edit them.
- **Previews** are made from where the resource lives, never a dead end:
  - **link** → the site's logo (falling back to its share image), drawn with ascii.rest's `drawing()` like `/make/` does, cached in `content/thumbs/`.
  - **folder** (a skill, a project) → its **real file tree**, read fresh from disk. Row: the top level with counts (`references/ 6 · SKILL.md`). Large: ascii.rest's `file-tree` piece (or a full `├──` tree when longer than 21 lines) and the SKILL.md/README description.
  - **video** → a frame a second in (ffmpeg), drawn as ascii; large views add the player, streamed from the file where it is.
  - Only paths inside your home folder or `/Volumes/Dev` are read. Previews are in one ink (`mono`); row previews are stills. A broken source says why (`no preview: can't open …`).
- **Empty after filters** shows the ascii `not-found` piece with `nothing matches` and a `(clear filters)` action.
- **Error** is one line in `--danger` saying what failed and how to retry.
- **Read-only** (opened without the server): editing is hidden and the detail drawer says `run node server.mjs to edit`.

## 8. Status, kind and stage

| Status | Mark | Meaning |
|---|---|---|
| core | `●` in accent | always reach for it |
| using | `◐` in ink | in rotation now |
| to-try | `○` at `--ink-40` | saved, not tried |

- Kinds are written as words (`component`, `video`, `skill`, `read`, `tool`, `inspiration`), never icons.
- Stages are always in workflow order: inspire → design → build → ship → learn.

## 9. Motion

- Motion comes **only** from ascii.rest pieces and ≤150ms colour/underline transitions. Nothing slides, scales or bounces.
- With `prefers-reduced-motion: reduce`, pieces hold still on their resting frame (ascii.rest does this itself) and transitions are off.
- The **background** is ascii.rest's `earthrise`, fixed behind everything: in its own colours in both modes. Dark: 60%. Light: the same scene inverted and hue-rotated (black sky → paper, the earth stays blue), multiplied into the page. A veil fades to paper towards the bottom, and text that sits straight on it (stats, nav, brand) gets a soft paper halo.
- The **heading** is ascii.rest's `marquee`: `condomdom · components · skill packs · reads · tools · inspiration` on a bulb-framed sign, sized to the full width of the column (`100cqw / 36.8`).
- The pieces that may move at once: the background, the heading, and **one** of: the boot screen, the searching state, the empty state, the drawer or explorer preview. Table previews never move.

## 10. Interaction and accessibility

- Every action works by keyboard: `/` search, `r` random, `n` add, `e` explorer, `w` next view, `m` panel mode, `t` theme, `esc` close.
- Focus is always visible: a 2px accent ring offset by 2px.
- Hit targets are at least 32px tall on touch.
- Ascii art is decorative (`aria-hidden="true"`); its meaning is repeated in real text next to it.
- Item panels use `<dialog>` in every mode: focus moves in, `esc` closes, focus returns to the row that opened it. With `prefers-reduced-transparency`, the backdrop is a flat 85% paper instead of a blur.

## Checklist for any change

- [ ] Only the mono face, only weights 400/500, only sizes from §1.
- [ ] No new hex colours; greys come from the §4 opacity tokens.
- [ ] Works in light, dark and system modes, with no flash.
- [ ] Spacing from the §6 scale; no horizontal scroll at 320px.
- [ ] Loading, empty and error states exist and say what to do.
- [ ] Keyboard and reduced-motion both work.
