# Time Tracker — Core Design

Date: 2026-09-22
Status: Approved for implementation planning

## Scope

This spec covers the **core desktop application** only: automatic activity
tracking, AFK detection, local storage, project/task Estimate-vs-Actual, and
the dashboard UI. IDE plugins (VS Code/JetBrains) and git hooks are an
explicitly separate, later sub-project and are out of scope here.

## Goals

The tracker serves one user (the developer/freelancer running it) and must
satisfy three needs at once:

1. Personal time tracking — see where time actually goes, without manual
   command-line logging.
2. Estimate vs Actual per project and per task — for freelance/project work.
3. Focus/productivity signal — surface AFK time and context-switching, not
   just totals.

## Non-goals (core phase)

- No cloud sync / multi-device — SQLite, local-only, matches the
  privacy-first reasoning from the original stack discussion.
- No IDE/editor integration, no git hook integration.
- No traditional manual start/stop timer (tracking always runs); see
  "Current task" and "Manual entries" below for how manual input still fits.
- No automated frontend tests in v1.

## Architecture

Wails v2 app; a Go backend runs continuously in the system tray (closing the
window hides it, it does not quit the process). The backend:

1. Polls/subscribes to the active window (app name + window title) and to
   idle time via two small interfaces:

   ```go
   type WindowInfo struct {
       AppName     string
       WindowTitle string
   }

   type WindowTracker interface {
       Current() (WindowInfo, error)
       // or an event-driven Watch(ctx) <-chan WindowInfo, where the
       // platform backend supports push (see Hyprland below)
   }

   type IdleDetector interface {
       IdleDuration() (time.Duration, error)
   }
   ```

   Platform-specific implementations live in `backend/tracker` behind Go
   build tags (`_linux.go`, `_windows.go`, `_darwin.go`).

2. An in-memory aggregator merges consecutive same-`(AppName, WindowTitle)`
   samples into an open "activity block". A block closes (and is persisted)
   when the app/title changes or idle time exceeds the configured AFK
   threshold. **Raw per-second samples are never persisted** — only closed
   blocks — to keep the database small (tens/hundreds of rows per day, not
   tens of thousands).

3. When a block closes, it is assigned a project/task (see "Assignment
   priority" below) and written to SQLite.

4. React frontend calls Go methods via Wails `invoke()` purely to read
   aggregated data and to edit projects/tasks/rules/manual assignments. It
   never collects activity data itself.

## Data model (SQLite)

```
projects
  id, name, color, estimate_minutes NULL, archived, created_at

tasks
  id, project_id FK, name, estimate_minutes NULL, status, created_at

activity_blocks
  id, start_time, end_time, app_name, window_title,
  task_id FK NULL, project_id FK NULL,
  assigned_by ENUM('rule', 'manual', NULL)

assignment_rules
  id, pattern_type ENUM('app_name', 'window_title'),
  pattern TEXT,           -- substring or regex
  project_id, task_id NULL,
  priority INTEGER

manual_entries
  id, start_time, end_time, task_id, note
  -- for offline work (calls, meetings) the window tracker can't see

app_state
  id = 1 (singleton row)
  current_task_id NULL,   -- "I'm working on X now" override
  tracking_paused BOOLEAN
```

AFK time is not stored as its own row type — it is simply the gap between
one block's `end_time` and the next block's `start_time`.

## Assignment priority

When a block closes, project/task is resolved in this order:

1. `app_state.current_task_id` is set → use it, `assigned_by = 'manual'`.
   This is the "I'm working on X now" quick-switch, meant to avoid having to
   sort the timeline after the fact.
2. Else, match `assignment_rules` in priority order against `app_name` /
   `window_title` → `assigned_by = 'rule'`.
3. Else, leave `project_id`/`task_id` NULL → the block shows as "unsorted"
   in the timeline for manual triage.

Manual timeline assignment (dragging/selecting a block and picking a
project/task) always overrides and sets `assigned_by = 'manual'`.

## AFK

Idle threshold is configurable (default 3 minutes). When idle time exceeds
the threshold, the currently open block is closed; nothing is recorded for
the idle gap itself. Global tray toggle to fully pause tracking (privacy:
calls, personal time) is in scope for v1 — cheap to add now.

## Platform backends (WindowTracker / IdleDetector)

Interfaces are defined for Linux, Windows and macOS from day one. Concrete
implementations are built as hardware/environment allows:

- **Linux (Hyprland — the dev machine's actual compositor):** built now.
  Active window via Hyprland's own IPC (`hyprctl activewindow -j`, or
  better, subscribing to the `.socket2.sock` event stream for `activewindow`
  events — push-based, no polling lag). Idle via the standard
  `ext-idle-notify-v1` Wayland protocol, which Hyprland supports. Other
  Linux DEs (GNOME, KDE, X11) are a documented future addition behind the
  same interface — GNOME in particular needs a Shell extension (e.g.
  "Window Calls") since it exposes no window-title protocol by design.

- **Windows:** built now, no dedicated hardware needed to write it, but
  needs a Windows machine/VM to verify. `GetForegroundWindow` +
  `GetWindowText` + `QueryFullProcessImageName` for the active window
  (optionally event-driven via `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)`),
  `GetLastInputInfo` for idle. Pure `golang.org/x/sys/windows`, no CGO, no
  permission prompts.

- **macOS:** documented as a TODO, not implemented until real Mac hardware
  is available (CGO + Objective-C bridge can't be meaningfully tested from
  Linux). Idle via `CGEventSourceSecondsSinceLastEventType` (no permission
  needed). Active app via `NSWorkspace.frontmostApplication`. Window
  **title** additionally requires the user to grant Accessibility
  permission in System Settings — needs a first-run detection + guided
  prompt flow, same pattern as RescueTime/Timing.

## Error handling

If a platform backend can't get data (missing permission, unsupported
Wayland protocol, etc.), the daemon must not crash: log the error, keep
running, and surface a banner in Settings explaining what's missing (e.g.
"AFK detection unavailable on this environment"). Blocks may be written
with `app_name = "unknown"` rather than blocking aggregation entirely.

## UI

Frontend stack: React 19 (already scaffolded) + Tailwind + shadcn/ui +
Recharts, added on top of the current Wails/Vite boilerplate.

Screens:

1. **Today/Timeline** (default view) — today's `activity_blocks` +
   `manual_entries` on a timeline; unsorted blocks are visually flagged;
   click to assign/split. Header has the current-task quick-switcher and
   the tracking pause toggle.
2. **Projects** — list with Estimate vs Actual progress bars; drill into a
   project to see its tasks with the same comparison.
3. **Rules** — CRUD for `assignment_rules` (pattern, target, priority).
4. **Settings** — AFK threshold, launch-on-boot, tray behavior, permission
   status banners.

Estimated memory footprint (Wails, not Electron-level, but not the
marketing "30-50MB" figure either): ~40-80MB resident in the tray, up to
~150MB with the dashboard open and charts rendered — WebKitGTK on Linux
runs heavier than WebView2/WKWebView on Windows/macOS.

## Testing

Backend-focused, since that's where the domain logic and risk live:

- Aggregator: given a sequence of fake `WindowInfo`/idle samples (via the
  interfaces, no real OS calls), assert the resulting `activity_blocks`.
- `assignment_rules` matching: priority ordering, substring/regex matching.
- Estimate-vs-Actual and focus-metric calculations: pure functions, easy to
  unit test.

No automated frontend tests in v1; verified manually via `wails dev`.

## Collaboration note

Implementation is paired: the user writes the application code by hand.
Claude's role during implementation is to specify the next
function/file/data flow and explain the reasoning, not to author the code
directly.
