# chronly

My own time tracker. I got tired of manually starting/stopping timers and
never trusting the numbers, so I'm building something that just runs in the
background on my machine, watches which window I'm actually in, and figures
out on its own what project/task that time belongs to.

## Why

I need three things at once: where my time actually goes day to day, an
estimate-vs-actual view per project/task for freelance work, and a signal for
how much of my "work" time is actually AFK/context-switching. Everything
stays local — SQLite on disk, no cloud sync, no account.

Full reasoning and data model are in
`docs/superpowers/specs/2026-09-22-chronly-core-design.md`.

## Status

Core tracking engine, storage API, and tray are done. No real frontend yet —
still the default Wails scaffold screen. Current implementation plan:
`docs/superpowers/plans/2026-09-22-tracking-engine-core.md`.

Done so far:
- SQLite schema + store bootstrap, CRUD for projects/tasks
- Hyprland window tracker (verified live)
- Idle detection with fallback chain: Wayland `ext-idle-notify-v1` → raw
  `/dev/input/event*` polling (mouse+keyboard) → user prompt to continue
  window-only or quit
- Aggregator, assignment resolver, activity persistence, Runner wiring
  (Runner also respects the tracking-paused flag)
- Wails API bindings exposing all of the above to the frontend
- System tray: pause toggle, quick task switch, hide-on-close

In progress:
- Frontend (Tailwind/shadcn, Today/Timeline/Projects/Rules/Settings)

## Stack

- Go 1.25 backend, split into `backend/tracker` (pure domain logic, OS deps
  isolated to platform-tagged files) and `backend/storage` (SQLite)
- `modernc.org/sqlite` — pure Go driver, no CGO, so cross-compiling for
  Windows/macOS later stays simple. The one exception is the tray
  (`github.com/getlantern/systray`), which needs CGO + GTK3/appindicator on
  Linux — that's a build-time/runtime dependency of the desktop shell, not
  of the engine itself.
- Hyprland's own IPC socket for window tracking (not the generic
  `wlr-foreign-toplevel-management` protocol) — Linux/Hyprland only for now
- Wails v2 for the desktop shell; React frontend still pending

## Running

```bash
wails dev    # live dev mode, hot reload
wails build  # production build
```

On Arch/CachyOS (and other distros that only ship `webkit2gtk-4.1`, not the
older `4.0`), add `-tags webkit2_41` to both commands — Wails v2 looks for
`webkit2gtk-4.0` by default and fails at the pkg-config step otherwise.

Backend tests: `go test ./...`
