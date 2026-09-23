# chronly Frontend — Design

Date: 2026-09-23
Status: Draft, awaiting review

## Scope

This spec covers the React frontend for chronly's Wails desktop app: the
five screens (Today, Timeline, Projects, Rules, Settings), the data/live-update
layer connecting them to the already-complete Go backend, and the visual
design system. It supersedes the brief "UI" section of
`docs/superpowers/specs/2026-09-22-chronly-core-design.md`, which was a
placeholder written before the backend existed.

Out of scope (deferred, separate future sub-project): a Quickshell/QML
widget for Hyprland's bar, showing current task/timer outside the main app
window. That needs its own small read-only status endpoint from the Go
backend and its own design pass.

## Current state

- Backend is fully built: SQLite storage, tracking engine (Hyprland window
  tracker, Wayland/evdev idle detection fallback chain), Wails API bindings
  in `api.go` (CRUD for projects/tasks, `GetAppState`/`SetCurrentTask`/
  `SetTrackingPaused`), system tray (`tray.go`).
- Frontend is still the default Wails/Vite/React scaffold: plain JS,
  `frontend/src/App.jsx` with a demo `Greet` button, no Tailwind, no
  component library, no router or state layer.

## Backend gaps this frontend surfaces

The current API can write activity blocks (`SaveActivityBlock`, used
internally by `Runner`) but has no way to **read** them back, and no way to
manually fix an assignment after the fact. Three additions to
`backend/storage` + `api.go`, following the existing TDD pattern:

- `ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error)`
  — powers both Today (today's range) and Timeline (arbitrary range).
- `UpdateActivityBlockAssignment(id int64, taskID *int64) error` — manual
  reassignment of a block from the Timeline (sets `assigned_by = 'manual'`).
- `SplitActivityBlock(id int64, splitAt time.Time) (newBlockID int64, err error)`
  — splits one block into two at a timestamp, for the Timeline's
  click/drag-to-split interaction described in the original core design doc.

These are implemented as their own small task before screen work starts,
since Today and Timeline both depend on them.

## Live updates

Rather than polling, the Go backend pushes state changes to the frontend via
Wails' `runtime.EventsEmit`:

- `block:closed` — emitted wherever `SaveActivityBlock` is called from
  `Runner.process` (today's list/timeline should reflect it immediately).
- `state:changed` — emitted from `SetCurrentTask` and `SetTrackingPaused`
  (keeps the window and any other listener in sync with tray actions, and
  vice versa).

The frontend subscribes via `runtime.EventsOn` and invalidates the
corresponding TanStack Query cache keys — no manual refetch timers. The
live-ticking duration on Today's current block is computed client-side from
a known `start_time` with `setInterval`, not by re-querying the backend
every second.

## Frontend stack

- **React 19 + TypeScript** — the generated Wails bindings
  (`frontend/wailsjs/go/models.ts`) are already fully typed; TypeScript lets
  the whole app benefit from that instead of discarding it at the JS
  boundary.
- **Tailwind + shadcn/ui** — utility CSS + accessible unstyled primitives as
  the base for custom components.
- **TanStack Query** — cache/loading/error state for all Wails API calls;
  pairs naturally with the event-push model (event → `invalidateQueries`).
- **Zustand** — small cross-cutting UI state that isn't domain data: which
  screen is active, which navigation shell style is selected. Persisted to
  `localStorage` (it's a per-machine UI preference, not SQLite data).
- **Framer Motion** — screen/element transitions.
- **Recharts** — Estimate-vs-Actual bars/progress on Projects.

## Navigation

Per explicit requirement, the navigation chrome itself is a user-facing
choice (Settings → "Navigation style"), not a fixed decision. Three shell
components share one Zustand-backed `activeScreen` value and simply render
it differently:

- `SidebarShell` — default. Left icon column, in the visual language below.
- `TabsShell` — top tab bar.
- `CommandPaletteShell` — minimal chrome, Cmd+K to switch screens.

Screens themselves are plain components with no shell-specific logic; a
shell is purely "how do you get to `activeScreen`," never "what does the
screen render."

## Visual design system

### Color: matugen-driven, not hardcoded

The user's whole desktop (waybar, kitty, rofi, GTK, Hyprland borders) is
themed dynamically from the current wallpaper via `matugen`
(`~/.config/matugen/config.toml`), which renders a Material You tonal
palette into per-app templates. chronly follows the same pattern instead of
shipping a fixed color scheme:

1. Add a `[templates.chronly]` entry to the user's existing matugen config,
   rendering a template that emits plain CSS custom properties (not GTK's
   `@define-color` dialect):

   ```
   :root {
     --color-primary: #{{colors.primary.default.hex_stripped}};
     --color-secondary: #{{colors.secondary.default.hex_stripped}};
     --color-tertiary: #{{colors.tertiary.default.hex_stripped}};
     --color-surface: #{{colors.surface.default.hex_stripped}};
     --color-surface-container: #{{colors.surface_container.default.hex_stripped}};
     --color-surface-container-high: #{{colors.surface_container_high.default.hex_stripped}};
     --color-on-surface: #{{colors.on_surface.default.hex_stripped}};
     --color-on-surface-variant: #{{colors.on_surface_variant.default.hex_stripped}};
     --color-outline: #{{colors.outline.default.hex_stripped}};
     --color-error: #{{colors.error.default.hex_stripped}};
   }
   ```

   output to `~/.config/colors/matugen/chronly.css`, matching the existing
   convention of the user's other templates.

2. Go backend: `App.GetThemeCSS() (string, error)` reads that file's raw
   text and returns it as-is — no color parsing in Go, it's a pass-through.
   If the file doesn't exist, it returns an empty string and no error (not
   a failure condition — see fallback below). A small `fsnotify` watcher on
   the same path re-reads the file and emits `theme:changed` with the new
   CSS text whenever matugen re-renders it (i.e., whenever the user changes
   wallpaper).
3. Frontend injects the returned CSS text into a `<style id="matugen-theme">`
   tag on load and on every `theme:changed` event, but only when it's
   non-empty. Tailwind's theme config maps semantic color names to these
   same custom properties, so components never reference a hex value
   directly.
4. **Fallback**: a static near-black + violet palette ships as the app's
   own default `:root` values (in the regular stylesheet, not injected).
   When `GetThemeCSS` returns a non-empty string, the injected
   `<style id="matugen-theme">` tag — later in the cascade — overrides it.
   When it returns empty (matugen not installed/configured, e.g. on a
   future non-dev machine), the shipped default simply stands.

### Role mapping

| Semantic use | M3 role |
|---|---|
| Page background | `surface` |
| Card / pill background | `surface-container` |
| Elevated/hover card | `surface-container-high` |
| Primary text | `on-surface` |
| Secondary/muted text | `on-surface-variant` |
| Accent (active nav item, hub, primary buttons) | `primary` |
| Secondary accent (rays, secondary badges) | `secondary` |
| Tertiary accent (chart highlights) | `tertiary` |
| Borders/dividers | `outline` |
| Unsorted/error states | `error` |

### Layout language

Two layout modes, sharing the same color system and component materials
(dark rounded cards, pill-shaped controls, soft glow), split by what each
screen actually needs to show:

- **Today (radial hub)**: the one screen with a single obvious focal
  object — the current task. A large circular hub (current task name,
  live-ticking duration, optionally a ring showing estimate-vs-elapsed)
  sits center, with satellite pill-cards (today's total, focus %, AFK time,
  pause toggle) connected to it by animated wavy SVG paths — the reference
  pattern is a Hyprland/Astal-style network/audio control panel (hub +
  curved "ray" connectors + pill info cards), not a generic dashboard
  widget. This is custom SVG + CSS/Framer Motion work, not an off-the-shelf
  component.
- **Timeline / Projects / Rules / Settings (list/card layouts)**: a radial
  metaphor doesn't work once there are many comparable items (10 projects,
  a day's worth of blocks) — these use conventional card-list rows (icon +
  label + inline progress bar, the same pill/card materials as the second
  reference screenshot's audio-output list) and forms, styled in the same
  color system.

## Screens

1. **Today** — radial hub (see above). Satellites: today's total tracked
   time, focus % (tracked vs AFK), current task's estimate-vs-elapsed if
   set, pause toggle. Below/around: today's blocks as a compact list,
   "unsorted" ones visually flagged (`error` role) and clickable to assign.
2. **Timeline** — same block list as Today but for an arbitrary date range
   (date picker), click-to-assign and click/drag-to-split on unsorted or
   misassigned blocks.
3. **Projects** — card list, Estimate vs Actual (Recharts bar/progress per
   card). Click a project → its tasks, same comparison.
4. **Rules** — CRUD list for `assignment_rules` (pattern_type, pattern,
   target project/task, priority), reorderable by priority.
5. **Settings** — AFK threshold, navigation style picker, tray behavior,
   and a status banner reflecting which idle-detection tier is active
   (Wayland / evdev / none). This needs one more small backend addition:
   `resolveIdleDetector` in `app.go` currently decides the active tier at
   startup but doesn't store it anywhere; it needs to set a field on `App`
   (e.g. `idleDetectorTier string`) and expose it via a new
   `App.GetIdleDetectorTier() string` binding for Settings to read.

## Testing

No automated frontend tests in v1 (per the original core design doc) —
verified manually via `wails dev -tags webkit2_41`, consistent with how the
tray and backend fallback chains were verified.

## What's next (not in this spec)

The Quickshell/QML companion widget (out of scope above) — its own design
pass once this frontend is done and has been used for a while, following
the same "brainstorm, don't guess" process.
