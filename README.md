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

Actively building the core engine, no UI yet. Current implementation plan:
`docs/superpowers/plans/2026-09-22-tracking-engine-core.md`.

Done so far:
- SQLite schema + store bootstrap
- Hyprland window tracker (verified live against a real Hyprland session)

In progress:
- Wayland idle detector (`ext-idle-notify-v1`) — connects and binds fine,
  still chasing a broken-pipe bug on the actual idle-notification request
- Aggregator, assignment resolver, activity persistence, runner wiring

## Stack

- Go 1.25 backend, split into `backend/tracker` (pure domain logic, no OS
  deps except two platform-tagged files) and `backend/storage` (SQLite)
- `modernc.org/sqlite` — pure Go driver, no CGO, so cross-compiling for
  Windows/macOS later stays simple
- Hyprland's own IPC socket for window tracking (not the generic
  `wlr-foreign-toplevel-management` protocol) — Linux/Hyprland only for now
- Wails v2 for the eventual desktop shell + tray icon; React frontend comes
  after the engine works end-to-end

## Running

```bash
wails dev    # live dev mode, hot reload
wails build  # production build
```

Backend tests: `go test ./...`
