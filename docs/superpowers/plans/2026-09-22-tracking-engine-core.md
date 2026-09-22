# Tracking Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Collaboration note for this project specifically:** the user writes the
> application code by hand and remembers the reasoning; do not use Edit/Write
> to author the Go files below on their behalf. Walk through each step,
> explain the "why", and let them type it. This overrides the usual
> subagent/inline execution flow — see the Execution Handoff note at the end
> of this plan.

**Goal:** Build the OS-agnostic tracking pipeline — window/idle observation, in-memory aggregation into activity blocks, project/task assignment, and SQLite persistence — as a fully unit-testable Go package, with a concrete Linux/Hyprland backend. No UI, no Wails bindings yet.

**Architecture:** A `tracker` package holds all domain logic (interfaces, aggregation, assignment) with zero OS dependencies except two small platform-tagged files (Hyprland IPC client, Wayland idle client). A separate `storage` package persists closed blocks and reads config (current task, rules) via SQLite, depending on `tracker` for shared types — never the other way around, so `tracker`'s tests never need a database.

**Tech Stack:** Go 1.25, `modernc.org/sqlite` (pure Go SQLite driver, no CGO), `github.com/rajveermalviya/go-wayland` (Wayland client bindings for `ext-idle-notify-v1`), standard `database/sql`.

**Spec:** `docs/superpowers/specs/2026-09-22-chronly-core-design.md`

## Global Constraints

- Module name is `chronly` (see `go.mod`) — internal imports use `chronly/backend/...`.
- Raw per-sample activity is never persisted — only closed `activity_blocks` rows (spec: "Architecture").
- SQLite via `modernc.org/sqlite` (pure Go, no CGO) — chosen over `mattn/go-sqlite3` to keep cross-compilation for Windows/macOS simple later.
- Linux window tracking targets **Hyprland's own IPC** specifically for v1, not the generic `wlr-foreign-toplevel-management` protocol (spec: "Platform backends").
- AFK threshold is a configurable `time.Duration`, default 3 minutes (spec: "AFK").
- Backend domain logic (aggregation, assignment) must be unit-testable with zero real OS/Wayland/Hyprland calls (spec: "Testing").
- The `tracker` package must never import the `storage` package (avoids an import cycle; see Task 6).

---

### Task 1: SQLite schema & Store bootstrap

**Files:**
- Create: `backend/storage/storage.go`
- Test: `backend/storage/storage_test.go`
- Modify: `go.mod`, `go.sum` (via `go get`/`go mod tidy`)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `storage.Store` (opaque struct wrapping `*sql.DB`), `storage.Open(path string) (*Store, error)`, `(*Store) Close() error`

- [ ] **Step 1: Add the SQLite driver dependency**

Run:
```bash
go get modernc.org/sqlite
go mod tidy
```
`modernc.org/sqlite` is already in `go.sum` as an indirect dependency, so this just promotes it to direct and drops whatever pulled in the now-unused `gorm`/`sqlx`/`mattn/go-sqlite3` indirect entries.

- [ ] **Step 2: Write the failing test**

```go
// backend/storage/storage_test.go
package storage

import "testing"

func TestOpenCreatesSchema(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer store.Close()

	tables := []string{
		"projects", "tasks", "activity_blocks",
		"assignment_rules", "manual_entries", "app_state",
	}
	for _, table := range tables {
		var name string
		err := store.db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' AND name=?", table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}
}
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `go test ./backend/storage/...`
Expected: FAIL — `storage.go` doesn't exist yet, so `Open` is undefined.

- [ ] **Step 3: Write the schema and Store**

```go
// backend/storage/storage.go
package storage

import (
	"database/sql"

	_ "modernc.org/sqlite"
)

// Store wraps a SQLite connection holding all of chronly's local data.
type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS projects (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	color TEXT NOT NULL DEFAULT '',
	estimate_minutes INTEGER,
	archived INTEGER NOT NULL DEFAULT 0,
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	project_id INTEGER NOT NULL REFERENCES projects(id),
	name TEXT NOT NULL,
	estimate_minutes INTEGER,
	status TEXT NOT NULL DEFAULT 'open',
	created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_blocks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	start_time DATETIME NOT NULL,
	end_time DATETIME NOT NULL,
	app_name TEXT NOT NULL,
	window_title TEXT NOT NULL,
	task_id INTEGER REFERENCES tasks(id),
	project_id INTEGER REFERENCES projects(id),
	assigned_by TEXT
);

CREATE TABLE IF NOT EXISTS assignment_rules (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	pattern_type TEXT NOT NULL,
	pattern TEXT NOT NULL,
	project_id INTEGER NOT NULL REFERENCES projects(id),
	task_id INTEGER REFERENCES tasks(id),
	priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS manual_entries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	start_time DATETIME NOT NULL,
	end_time DATETIME NOT NULL,
	task_id INTEGER NOT NULL REFERENCES tasks(id),
	note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_state (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	current_task_id INTEGER REFERENCES tasks(id),
	tracking_paused INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO app_state (id, tracking_paused) VALUES (1, 0);
`

// Open creates (or opens) the SQLite database at path and ensures the
// schema exists. Pass ":memory:" for an ephemeral in-process database
// (used by tests).
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// Close releases the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `go test ./backend/storage/...`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add go.mod go.sum backend/storage/storage.go backend/storage/storage_test.go
git commit -m "feat(storage): bootstrap SQLite schema"
```

---

### Task 2: Hyprland window tracker

**Files:**
- Create: `backend/tracker/tracker.go`
- Create: `backend/tracker/hyprland_parse.go`
- Create: `backend/tracker/hyprland_parse_test.go`
- Create: `backend/tracker/hyprland_linux.go`

**Interfaces:**
- Consumes: nothing
- Produces: `tracker.WindowInfo{AppName, WindowTitle string}`, `tracker.WindowTracker` interface (`Watch(ctx context.Context, updates chan<- WindowInfo) error`), `tracker.NewHyprlandTracker() *HyprlandTracker`

- [ ] **Step 1: Define the shared interface and type**

```go
// backend/tracker/tracker.go
package tracker

import "context"

// WindowInfo describes the currently focused window.
type WindowInfo struct {
	AppName     string
	WindowTitle string
}

// WindowTracker reports the currently focused window as it changes.
type WindowTracker interface {
	// Watch streams a WindowInfo every time the focused window changes.
	// It blocks until ctx is cancelled or an unrecoverable error occurs,
	// in which case it returns that error (nil if ctx cancellation is the
	// reason it stopped).
	Watch(ctx context.Context, updates chan<- WindowInfo) error
}
```

- [ ] **Step 2: Write the failing test for the pure parser**

```go
// backend/tracker/hyprland_parse_test.go
package tracker

import "testing"

func TestParseHyprlandEvent(t *testing.T) {
	cases := []struct {
		name string
		line string
		want WindowInfo
		ok   bool
	}{
		{
			name: "normal activewindow event",
			line: "activewindow>>code,main.go - chronly - Visual Studio Code",
			want: WindowInfo{AppName: "code", WindowTitle: "main.go - chronly - Visual Studio Code"},
			ok:   true,
		},
		{
			name: "title containing commas",
			line: "activewindow>>firefox,Issue 12, 13 and 14 - Mozilla Firefox",
			want: WindowInfo{AppName: "firefox", WindowTitle: "Issue 12, 13 and 14 - Mozilla Firefox"},
			ok:   true,
		},
		{
			name: "ignored event type",
			line: "workspace>>3",
			want: WindowInfo{},
			ok:   false,
		},
		{
			name: "malformed data",
			line: "activewindow>>onlyclass",
			want: WindowInfo{},
			ok:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseHyprlandEvent(tc.line)
			if ok != tc.ok || got != tc.want {
				t.Errorf("parseHyprlandEvent(%q) = %+v, %v; want %+v, %v",
					tc.line, got, ok, tc.want, tc.ok)
			}
		})
	}
}
```

- [ ] **Step 2b: Run it to confirm it fails**

Run: `go test ./backend/tracker/...`
Expected: FAIL — `parseHyprlandEvent` is undefined.

- [ ] **Step 3: Write the pure parser**

Hyprland's `.socket2.sock` writes one `EVENT>>DATA` line per event; `activewindow`'s data is `CLASS,TITLE` (confirmed against the [Hyprland IPC wiki](https://wiki.hypr.land/IPC/)). The title itself may contain commas, so only the first comma is a delimiter.

```go
// backend/tracker/hyprland_parse.go
package tracker

import "strings"

// parseHyprlandEvent parses one line from Hyprland's .socket2.sock event
// stream and, if it is an "activewindow" event, returns the WindowInfo it
// carries.
func parseHyprlandEvent(line string) (WindowInfo, bool) {
	event, data, found := strings.Cut(line, ">>")
	if !found || event != "activewindow" {
		return WindowInfo{}, false
	}
	class, title, found := strings.Cut(data, ",")
	if !found {
		return WindowInfo{}, false
	}
	return WindowInfo{AppName: class, WindowTitle: title}, true
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `go test ./backend/tracker/...`
Expected: PASS

- [ ] **Step 5: Write the Hyprland socket client (Linux-only, no unit test)**

This file talks to a real Hyprland socket, so it's not unit-tested — it's verified manually in Step 6. It's built only on Linux via the build tag.

```go
// backend/tracker/hyprland_linux.go
//go:build linux

package tracker

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
)

// HyprlandTracker implements WindowTracker by subscribing to Hyprland's
// live event socket.
type HyprlandTracker struct{}

// NewHyprlandTracker creates a HyprlandTracker. It only works when running
// inside a Hyprland session (it reads HYPRLAND_INSTANCE_SIGNATURE).
func NewHyprlandTracker() *HyprlandTracker {
	return &HyprlandTracker{}
}

func hyprlandSocketPath() (string, error) {
	runtimeDir := os.Getenv("XDG_RUNTIME_DIR")
	signature := os.Getenv("HYPRLAND_INSTANCE_SIGNATURE")
	if runtimeDir == "" || signature == "" {
		return "", fmt.Errorf("not running under Hyprland: XDG_RUNTIME_DIR or HYPRLAND_INSTANCE_SIGNATURE is unset")
	}
	return filepath.Join(runtimeDir, "hypr", signature, ".socket2.sock"), nil
}

func (t *HyprlandTracker) Watch(ctx context.Context, updates chan<- WindowInfo) error {
	path, err := hyprlandSocketPath()
	if err != nil {
		return err
	}
	conn, err := net.Dial("unix", path)
	if err != nil {
		return fmt.Errorf("dial hyprland socket: %w", err)
	}
	defer conn.Close()

	go func() {
		<-ctx.Done()
		conn.Close()
	}()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		info, ok := parseHyprlandEvent(scanner.Text())
		if !ok {
			continue
		}
		select {
		case updates <- info:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return scanner.Err()
}
```

- [ ] **Step 6: Manually verify against real Hyprland**

Write a throwaway `cmd/hyprspike/main.go`:

```go
package main

import (
	"context"
	"fmt"

	"chronly/backend/tracker"
)

func main() {
	t := tracker.NewHyprlandTracker()
	updates := make(chan tracker.WindowInfo)
	go func() {
		for w := range updates {
			fmt.Printf("%+v\n", w)
		}
	}()
	if err := t.Watch(context.Background(), updates); err != nil {
		fmt.Println("error:", err)
	}
}
```

Run `go run ./cmd/hyprspike`, alt-tab between a couple of windows, and confirm each switch prints the right class/title. Then delete `cmd/hyprspike` — it was only for manual verification, it's not part of the shipped code.

- [ ] **Step 7: Commit**

```bash
git add backend/tracker/tracker.go backend/tracker/hyprland_parse.go backend/tracker/hyprland_parse_test.go backend/tracker/hyprland_linux.go
git commit -m "feat(tracker): add Hyprland window tracker"
```

---

### Task 3: Wayland idle detector

**Files:**
- Create: `backend/tracker/idle_state.go`
- Create: `backend/tracker/idle_state_test.go`
- Create: `backend/tracker/idle_linux.go`

**Interfaces:**
- Consumes: nothing
- Produces: `tracker.IdleDetector` interface (`IdleDuration() time.Duration`), `tracker.NewWaylandIdleDetector(ctx context.Context, idleMillis uint32) (IdleDetector, func() error, error)`

**Heads up before you start:** the `go-wayland` API in Step 5 below is reconstructed from that library's published docs, not compiled locally — third-party Wayland client library APIs vary between forks/versions. Before typing the full file, run:
```bash
go get github.com/rajveermalviya/go-wayland
go doc github.com/rajveermalviya/go-wayland/wayland/client Registry
go doc github.com/rajveermalviya/go-wayland/wayland/staging/ext-idle-notify-v1
```
and diff the real method signatures against Step 5's code. If something doesn't match (method renamed, extra parameter, etc.), adjust — the shape of the solution (bind `wl_seat` + `ext_idle_notifier_v1` from the registry, request a notification, wire `idled`/`resumed` to `idleState`) is correct regardless of exact names.

- [ ] **Step 1: Write the failing test for the pure idle state**

```go
// backend/tracker/idle_state_test.go
package tracker

import (
	"testing"
	"time"
)

func TestIdleState(t *testing.T) {
	fakeNow := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s := newIdleState()
	s.now = func() time.Time { return fakeNow }

	if got := s.IdleDuration(); got != 0 {
		t.Fatalf("fresh idleState should report 0 idle, got %v", got)
	}

	s.markIdle()
	fakeNow = fakeNow.Add(5 * time.Minute)
	if got := s.IdleDuration(); got != 5*time.Minute {
		t.Fatalf("expected 5m idle, got %v", got)
	}

	s.markResumed()
	if got := s.IdleDuration(); got != 0 {
		t.Fatalf("after resume, expected 0 idle, got %v", got)
	}
}
```

- [ ] **Step 1b: Run it to confirm it fails**

Run: `go test ./backend/tracker/...`
Expected: FAIL — `newIdleState` is undefined.

- [ ] **Step 2: Write the pure idle state tracker**

This has no OS dependency at all — it just remembers "idle since when" and lets anything (a real Wayland client, a fake in a test, a future Windows/macOS backend) drive it via `markIdle`/`markResumed`.

```go
// backend/tracker/idle_state.go
package tracker

import (
	"sync"
	"time"
)

// IdleDetector reports how long the user has been idle.
type IdleDetector interface {
	IdleDuration() time.Duration
}

// idleState tracks idle time from markIdle/markResumed calls pushed by a
// platform-specific backend. It has no OS dependency, so it's fully
// unit-testable.
type idleState struct {
	mu        sync.Mutex
	idleSince time.Time // zero value means "not idle"
	now       func() time.Time
}

func newIdleState() *idleState {
	return &idleState{now: time.Now}
}

func (s *idleState) markIdle() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idleSince = s.now()
}

func (s *idleState) markResumed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idleSince = time.Time{}
}

// IdleDuration returns how long the user has been idle, or 0 if active.
func (s *idleState) IdleDuration() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.idleSince.IsZero() {
		return 0
	}
	return s.now().Sub(s.idleSince)
}
```

- [ ] **Step 3: Run the test to confirm it passes**

Run: `go test ./backend/tracker/...`
Expected: PASS

- [ ] **Step 4: Add the go-wayland dependency**

```bash
go get github.com/rajveermalviya/go-wayland
```

- [ ] **Step 5: Write the Wayland wiring (Linux-only, no unit test)**

Verify this against `go doc` per the heads-up above before typing it — adjust names/signatures to match what's actually installed.

```go
// backend/tracker/idle_linux.go
//go:build linux

package tracker

import (
	"context"
	"fmt"

	"github.com/rajveermalviya/go-wayland/wayland/client"
	idlenotify "github.com/rajveermalviya/go-wayland/wayland/staging/ext-idle-notify-v1"
)

// NewWaylandIdleDetector connects to the Wayland display and returns an
// IdleDetector backed by ext-idle-notify-v1, which the compositor marks
// idle after idleMillis of no input. Call the returned run function to
// drive the event loop (it blocks); IdleDuration on the returned detector
// is safe to call concurrently while run is executing.
func NewWaylandIdleDetector(ctx context.Context, idleMillis uint32) (IdleDetector, func() error, error) {
	display, err := client.Connect("")
	if err != nil {
		return nil, nil, fmt.Errorf("connect to wayland display: %w", err)
	}

	state := newIdleState()

	var seat *client.Seat
	var notifier *idlenotify.IdleNotifier

	registry, err := display.GetRegistry()
	if err != nil {
		return nil, nil, fmt.Errorf("get registry: %w", err)
	}
	registry.SetGlobalHandler(func(e client.RegistryGlobalEvent) {
		switch e.Iface {
		case "wl_seat":
			seat = client.NewSeat(display.Context())
			registry.Bind(e.Name, e.Iface, e.Version, seat)
		case "ext_idle_notifier_v1":
			notifier = idlenotify.NewIdleNotifier(display.Context())
			registry.Bind(e.Name, e.Iface, e.Version, notifier)
		}
	})

	// Round-trip so the compositor's global list is fully processed before
	// we try to use seat/notifier.
	callback, err := display.Sync()
	if err != nil {
		return nil, nil, fmt.Errorf("sync: %w", err)
	}
	done := make(chan struct{})
	callback.SetDoneHandler(func(client.CallbackDoneEvent) { close(done) })
syncLoop:
	for {
		if _, _, _, _, err := display.Context().ReadMsg(); err != nil {
			return nil, nil, fmt.Errorf("read during sync: %w", err)
		}
		display.Context().Dispatch()
		select {
		case <-done:
			break syncLoop
		default:
		}
	}

	if seat == nil || notifier == nil {
		return nil, nil, fmt.Errorf("compositor does not expose wl_seat + ext_idle_notifier_v1 (idle detection unavailable)")
	}

	notification, err := notifier.GetIdleNotification(idleMillis, seat)
	if err != nil {
		return nil, nil, fmt.Errorf("get idle notification: %w", err)
	}
	notification.SetIdledHandler(func(idlenotify.IdleNotificationIdledEvent) { state.markIdle() })
	notification.SetResumedHandler(func(idlenotify.IdleNotificationResumedEvent) { state.markResumed() })

	run := func() error {
		for {
			select {
			case <-ctx.Done():
				return nil
			default:
			}
			if _, _, _, _, err := display.Context().ReadMsg(); err != nil {
				return err
			}
			display.Context().Dispatch()
		}
	}

	return state, run, nil
}
```

- [ ] **Step 6: Manually verify against real Hyprland**

Write a throwaway `cmd/idlespike/main.go` that calls `NewWaylandIdleDetector(ctx, 3000)`, runs `run()` in a goroutine, and prints `IdleDuration()` every second. Leave the mouse/keyboard untouched for 5+ seconds and confirm it reports idle after ~3s, then confirm it drops back to 0 the moment you move the mouse. Delete `cmd/idlespike` afterward.

- [ ] **Step 7: Commit**

```bash
git add go.mod go.sum backend/tracker/idle_state.go backend/tracker/idle_state_test.go backend/tracker/idle_linux.go
git commit -m "feat(tracker): add Wayland idle detector"
```

---

### Task 4: Aggregator

**Files:**
- Create: `backend/tracker/aggregator.go`
- Create: `backend/tracker/aggregator_test.go`

**Interfaces:**
- Consumes: `tracker.WindowInfo` (Task 2)
- Produces: `tracker.Sample{Window WindowInfo, Idle time.Duration, At time.Time}`, `tracker.Block{StartTime, EndTime time.Time, AppName, WindowTitle string}`, `tracker.NewAggregator(afkThreshold time.Duration) *Aggregator`, `(*Aggregator) Add(s Sample) (closed Block, ok bool)`

- [ ] **Step 1: Write the failing tests**

```go
// backend/tracker/aggregator_test.go
package tracker

import (
	"testing"
	"time"
)

func t0(seconds int) time.Time {
	return time.Date(2026, 1, 1, 12, 0, seconds, 0, time.UTC)
}

func TestAggregator_MergesConsecutiveSameWindow(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	win := WindowInfo{AppName: "code", WindowTitle: "main.go"}

	if _, ok := agg.Add(Sample{Window: win, At: t0(0)}); ok {
		t.Fatal("first sample should not close a block")
	}
	if _, ok := agg.Add(Sample{Window: win, At: t0(30)}); ok {
		t.Fatal("same window should not close a block")
	}
}

func TestAggregator_ClosesOnWindowChange(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	a := WindowInfo{AppName: "code", WindowTitle: "main.go"}
	b := WindowInfo{AppName: "firefox", WindowTitle: "docs"}

	agg.Add(Sample{Window: a, At: t0(0)})
	agg.Add(Sample{Window: a, At: t0(60)})

	closed, ok := agg.Add(Sample{Window: b, At: t0(65)})
	if !ok {
		t.Fatal("window change should close the previous block")
	}
	if closed.AppName != "code" || closed.StartTime != t0(0) || closed.EndTime != t0(60) {
		t.Fatalf("unexpected closed block: %+v", closed)
	}
}

func TestAggregator_ClosesOnAFK(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	win := WindowInfo{AppName: "code", WindowTitle: "main.go"}

	agg.Add(Sample{Window: win, At: t0(0)})
	agg.Add(Sample{Window: win, At: t0(60)})

	closed, ok := agg.Add(Sample{Window: win, Idle: 4 * time.Minute, At: t0(300)})
	if !ok {
		t.Fatal("idle over threshold should close the open block")
	}
	if closed.StartTime != t0(0) || closed.EndTime != t0(60) {
		t.Fatalf("unexpected closed block: %+v", closed)
	}

	// The idle sample itself must not start a new open block — the next
	// active sample after AFK starts fresh instead.
	if _, ok := agg.Add(Sample{Window: win, At: t0(600)}); ok {
		t.Fatal("first sample after AFK should not immediately close anything")
	}
}
```

- [ ] **Step 1b: Run to confirm failure**

Run: `go test ./backend/tracker/...`
Expected: FAIL — `Sample`, `Block`, `NewAggregator` undefined.

- [ ] **Step 2: Write the aggregator**

```go
// backend/tracker/aggregator.go
package tracker

import "time"

// Sample is one observation of the focused window plus the current idle
// duration, taken at time At.
type Sample struct {
	Window WindowInfo
	Idle   time.Duration
	At     time.Time
}

// Block is a closed span of continuous activity on one window.
type Block struct {
	StartTime   time.Time
	EndTime     time.Time
	AppName     string
	WindowTitle string
}

// Aggregator merges a stream of Samples into closed Blocks. It never
// touches the OS or the database — callers feed it Samples and drain
// closed Blocks.
type Aggregator struct {
	afkThreshold time.Duration
	open         *Block
}

// NewAggregator creates an Aggregator that closes the open block once idle
// time reaches afkThreshold.
func NewAggregator(afkThreshold time.Duration) *Aggregator {
	return &Aggregator{afkThreshold: afkThreshold}
}

// Add processes one sample. If it caused a block to close (the window
// changed, or idle time crossed afkThreshold), that block is returned with
// ok=true.
func (a *Aggregator) Add(s Sample) (closed Block, ok bool) {
	if s.Idle >= a.afkThreshold {
		return a.closeOpen()
	}

	if a.open == nil {
		a.open = &Block{
			StartTime:   s.At,
			EndTime:     s.At,
			AppName:     s.Window.AppName,
			WindowTitle: s.Window.WindowTitle,
		}
		return Block{}, false
	}

	if a.open.AppName != s.Window.AppName || a.open.WindowTitle != s.Window.WindowTitle {
		closed, ok = a.closeOpen()
		a.open = &Block{
			StartTime:   s.At,
			EndTime:     s.At,
			AppName:     s.Window.AppName,
			WindowTitle: s.Window.WindowTitle,
		}
		return closed, ok
	}

	a.open.EndTime = s.At
	return Block{}, false
}

func (a *Aggregator) closeOpen() (Block, bool) {
	if a.open == nil {
		return Block{}, false
	}
	b := *a.open
	a.open = nil
	return b, true
}
```

- [ ] **Step 3: Run to confirm pass**

Run: `go test ./backend/tracker/...`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/tracker/aggregator.go backend/tracker/aggregator_test.go
git commit -m "feat(tracker): add sample aggregator"
```

---

### Task 5: Assignment resolver

**Files:**
- Create: `backend/tracker/assign.go`
- Create: `backend/tracker/assign_test.go`

**Interfaces:**
- Consumes: `tracker.Block` (Task 4)
- Produces: `tracker.Rule{PatternType, Pattern string, ProjectID int64, TaskID *int64, Priority int}`, `tracker.Assignment{ProjectID, TaskID *int64, AssignedBy *string}`, `tracker.Resolve(b Block, currentTaskID, currentTaskProjectID *int64, rules []Rule) Assignment`

- [ ] **Step 1: Write the failing tests**

```go
// backend/tracker/assign_test.go
package tracker

import "testing"

func i64(v int64) *int64 { return &v }

func TestResolve_CurrentTaskWins(t *testing.T) {
	b := Block{AppName: "chrome", WindowTitle: "anything"}
	rules := []Rule{{PatternType: "app_name", Pattern: "chrome", ProjectID: 99, Priority: 1}}

	got := Resolve(b, i64(5), i64(1), rules)

	if got.TaskID == nil || *got.TaskID != 5 {
		t.Fatalf("expected current task to win, got %+v", got)
	}
	if got.ProjectID == nil || *got.ProjectID != 1 {
		t.Fatalf("expected project from current task, got %+v", got)
	}
	if got.AssignedBy == nil || *got.AssignedBy != "manual" {
		t.Fatalf("expected assigned_by=manual, got %+v", got.AssignedBy)
	}
}

func TestResolve_FallsBackToHighestPriorityRule(t *testing.T) {
	b := Block{AppName: "code", WindowTitle: "chronly - main.go"}
	rules := []Rule{
		{PatternType: "app_name", Pattern: "firefox", ProjectID: 1, Priority: 10},
		{PatternType: "window_title", Pattern: "chronly", ProjectID: 2, Priority: 5},
	}

	got := Resolve(b, nil, nil, rules)

	if got.ProjectID == nil || *got.ProjectID != 2 {
		t.Fatalf("expected rule match on project 2, got %+v", got)
	}
	if got.AssignedBy == nil || *got.AssignedBy != "rule" {
		t.Fatalf("expected assigned_by=rule, got %+v", got.AssignedBy)
	}
}

func TestResolve_UnassignedWhenNothingMatches(t *testing.T) {
	b := Block{AppName: "code", WindowTitle: "untracked project"}
	got := Resolve(b, nil, nil, nil)

	if got.ProjectID != nil || got.TaskID != nil || got.AssignedBy != nil {
		t.Fatalf("expected fully unassigned, got %+v", got)
	}
}
```

- [ ] **Step 1b: Run to confirm failure**

Run: `go test ./backend/tracker/...`
Expected: FAIL — `Rule`, `Resolve` undefined.

- [ ] **Step 2: Write the resolver**

Note: `Resolve` takes `currentTaskProjectID` as a plain parameter rather than looking it up itself — it stays a pure function with no database access; whoever calls it (Task 7's Runner) is responsible for looking up the task's project first.

```go
// backend/tracker/assign.go
package tracker

import "strings"

// Rule is one row of the assignment_rules table, as the resolver needs it.
type Rule struct {
	PatternType string // "app_name" or "window_title"
	Pattern     string
	ProjectID   int64
	TaskID      *int64
	Priority    int
}

// Assignment is the resolved project/task for a closed Block.
type Assignment struct {
	ProjectID  *int64
	TaskID     *int64
	AssignedBy *string // "rule", "manual", or nil if unassigned
}

// Resolve decides the project/task for a closed Block, in priority order:
//  1. currentTaskID, if set — the "I'm working on X now" override.
//     currentTaskProjectID must be that task's project.
//  2. the highest-priority matching Rule (rules must already be sorted by
//     descending priority; Resolve does not sort them).
//  3. unassigned.
func Resolve(b Block, currentTaskID *int64, currentTaskProjectID *int64, rules []Rule) Assignment {
	if currentTaskID != nil {
		assignedBy := "manual"
		return Assignment{ProjectID: currentTaskProjectID, TaskID: currentTaskID, AssignedBy: &assignedBy}
	}

	for _, r := range rules {
		var subject string
		switch r.PatternType {
		case "app_name":
			subject = b.AppName
		case "window_title":
			subject = b.WindowTitle
		default:
			continue
		}
		if strings.Contains(subject, r.Pattern) {
			assignedBy := "rule"
			projectID := r.ProjectID
			return Assignment{ProjectID: &projectID, TaskID: r.TaskID, AssignedBy: &assignedBy}
		}
	}

	return Assignment{}
}
```

- [ ] **Step 3: Run to confirm pass**

Run: `go test ./backend/tracker/...`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add backend/tracker/assign.go backend/tracker/assign_test.go
git commit -m "feat(tracker): add assignment resolver"
```

---

### Task 6: Storage — activity blocks, app state, rules

**Files:**
- Create: `backend/tracker/state.go`
- Create: `backend/storage/activity.go`
- Create: `backend/storage/activity_test.go`
- Create: `backend/storage/state.go`
- Create: `backend/storage/state_test.go`
- Create: `backend/storage/rules.go`
- Create: `backend/storage/rules_test.go`

**Interfaces:**
- Consumes: `tracker.Block`, `tracker.Assignment`, `tracker.Rule` (Tasks 4-5); `storage.Store`, `storage.Open` (Task 1)
- Produces: `tracker.AppState{CurrentTaskID, CurrentProjectID *int64, TrackingPaused bool}`, `(*storage.Store) SaveActivityBlock(b tracker.Block, a tracker.Assignment) (int64, error)`, `(*storage.Store) GetAppState() (tracker.AppState, error)`, `(*storage.Store) ListAssignmentRulesByPriority() ([]tracker.Rule, error)`

`AppState` lives in the `tracker` package (not `storage`) specifically so `storage` can depend on `tracker` without `tracker` ever needing to import `storage` back — that cycle would break the build.

- [ ] **Step 1: Add the shared AppState type**

```go
// backend/tracker/state.go
package tracker

// AppState is the small piece of global config the assignment pipeline
// reads each time a block closes.
type AppState struct {
	CurrentTaskID    *int64
	CurrentProjectID *int64 // the project of CurrentTaskID, if CurrentTaskID is set
	TrackingPaused   bool
}
```

- [ ] **Step 2: Write the failing test for SaveActivityBlock**

```go
// backend/storage/activity_test.go
package storage

import (
	"testing"
	"time"

	"chronly/backend/tracker"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	s, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestSaveActivityBlock_PersistsFields(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO tasks (id, project_id, name) VALUES (10, 1, 't')`); err != nil {
		t.Fatal(err)
	}

	start := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	block := tracker.Block{
		StartTime:   start,
		EndTime:     start.Add(time.Minute),
		AppName:     "code",
		WindowTitle: "main.go",
	}
	taskID := int64(10)
	projectID := int64(1)
	assignedBy := "rule"
	assignment := tracker.Assignment{TaskID: &taskID, ProjectID: &projectID, AssignedBy: &assignedBy}

	id, err := s.SaveActivityBlock(block, assignment)
	if err != nil {
		t.Fatalf("SaveActivityBlock: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	var gotApp string
	var gotTask int64
	if err := s.db.QueryRow(`SELECT app_name, task_id FROM activity_blocks WHERE id = ?`, id).Scan(&gotApp, &gotTask); err != nil {
		t.Fatalf("query back: %v", err)
	}
	if gotApp != "code" || gotTask != 10 {
		t.Fatalf("unexpected row: app=%s task=%d", gotApp, gotTask)
	}
}
```

- [ ] **Step 2b: Run to confirm failure**

Run: `go test ./backend/storage/...`
Expected: FAIL — `SaveActivityBlock` undefined.

- [ ] **Step 3: Implement SaveActivityBlock**

```go
// backend/storage/activity.go
package storage

import "chronly/backend/tracker"

// SaveActivityBlock persists a closed Block with its resolved Assignment
// and returns the new row's id.
func (s *Store) SaveActivityBlock(b tracker.Block, a tracker.Assignment) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO activity_blocks (start_time, end_time, app_name, window_title, task_id, project_id, assigned_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		b.StartTime, b.EndTime, b.AppName, b.WindowTitle, a.TaskID, a.ProjectID, a.AssignedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `go test ./backend/storage/...`
Expected: PASS

- [ ] **Step 5: Write the failing tests for GetAppState**

```go
// backend/storage/state_test.go
package storage

import "testing"

func TestGetAppState_DefaultsToUnsetAndNotPaused(t *testing.T) {
	s := newTestStore(t)

	st, err := s.GetAppState()
	if err != nil {
		t.Fatalf("GetAppState: %v", err)
	}
	if st.CurrentTaskID != nil || st.TrackingPaused {
		t.Fatalf("expected fresh app_state row, got %+v", st)
	}
}

func TestGetAppState_ReflectsCurrentTask(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'chronly')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO tasks (id, project_id, name) VALUES (10, 1, 'write plan')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`UPDATE app_state SET current_task_id = 10 WHERE id = 1`); err != nil {
		t.Fatal(err)
	}

	st, err := s.GetAppState()
	if err != nil {
		t.Fatalf("GetAppState: %v", err)
	}
	if st.CurrentTaskID == nil || *st.CurrentTaskID != 10 {
		t.Fatalf("expected current task 10, got %+v", st.CurrentTaskID)
	}
	if st.CurrentProjectID == nil || *st.CurrentProjectID != 1 {
		t.Fatalf("expected current project 1, got %+v", st.CurrentProjectID)
	}
}
```

- [ ] **Step 5b: Run to confirm failure**

Run: `go test ./backend/storage/...`
Expected: FAIL — `GetAppState` undefined.

- [ ] **Step 6: Implement GetAppState**

`database/sql` allocates/nils a `*int64` destination automatically for NULL vs. non-NULL columns, so scanning straight into the `*int64` struct fields (as `&st.CurrentTaskID`, a `**int64`) is correct without a separate `sql.NullInt64` step.

```go
// backend/storage/state.go
package storage

import "chronly/backend/tracker"

// GetAppState reads the singleton app_state row, joined with the current
// task's project so callers don't need a second query.
func (s *Store) GetAppState() (tracker.AppState, error) {
	var st tracker.AppState
	var paused int
	row := s.db.QueryRow(
		`SELECT app_state.current_task_id, tasks.project_id, app_state.tracking_paused
		 FROM app_state
		 LEFT JOIN tasks ON tasks.id = app_state.current_task_id
		 WHERE app_state.id = 1`,
	)
	if err := row.Scan(&st.CurrentTaskID, &st.CurrentProjectID, &paused); err != nil {
		return tracker.AppState{}, err
	}
	st.TrackingPaused = paused != 0
	return st, nil
}
```

- [ ] **Step 7: Run to confirm pass**

Run: `go test ./backend/storage/...`
Expected: PASS

- [ ] **Step 8: Write the failing test for ListAssignmentRulesByPriority**

```go
// backend/storage/rules_test.go
package storage

import "testing"

func TestListAssignmentRulesByPriority_OrdersDescending(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a'), (2, 'b')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (pattern_type, pattern, project_id, priority) VALUES ('app_name', 'low', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (pattern_type, pattern, project_id, priority) VALUES ('app_name', 'high', 2, 10)`); err != nil {
		t.Fatal(err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatalf("ListAssignmentRulesByPriority: %v", err)
	}
	if len(rules) != 2 || rules[0].Pattern != "high" || rules[1].Pattern != "low" {
		t.Fatalf("expected [high, low] order, got %+v", rules)
	}
}
```

- [ ] **Step 8b: Run to confirm failure**

Run: `go test ./backend/storage/...`
Expected: FAIL — `ListAssignmentRulesByPriority` undefined.

- [ ] **Step 9: Implement ListAssignmentRulesByPriority**

```go
// backend/storage/rules.go
package storage

import "chronly/backend/tracker"

// ListAssignmentRulesByPriority returns all assignment_rules rows, highest
// priority first, ready to pass straight into tracker.Resolve.
func (s *Store) ListAssignmentRulesByPriority() ([]tracker.Rule, error) {
	rows, err := s.db.Query(
		`SELECT pattern_type, pattern, project_id, task_id, priority
		 FROM assignment_rules ORDER BY priority DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []tracker.Rule
	for rows.Next() {
		var r tracker.Rule
		if err := rows.Scan(&r.PatternType, &r.Pattern, &r.ProjectID, &r.TaskID, &r.Priority); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}
```

- [ ] **Step 10: Run to confirm pass**

Run: `go test ./backend/storage/...`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add backend/tracker/state.go backend/storage/activity.go backend/storage/activity_test.go backend/storage/state.go backend/storage/state_test.go backend/storage/rules.go backend/storage/rules_test.go
git commit -m "feat(storage): persist activity blocks, app state, and rules"
```

---

### Task 7: Runner — wiring it all together

**Files:**
- Create: `backend/tracker/runner.go`
- Create: `backend/tracker/runner_test.go`

**Interfaces:**
- Consumes: everything from Tasks 2-6 (`WindowTracker`, `IdleDetector`, `Aggregator`, `Resolve`, `Rule`, `AppState`)
- Produces: `tracker.RuleSource`, `tracker.StateSource`, `tracker.BlockSink` interfaces, `tracker.NewRunner(t WindowTracker, idle IdleDetector, afkThreshold time.Duration, rules RuleSource, state StateSource, sink BlockSink) *Runner`, `(*Runner) Run(ctx context.Context) error`

The three small interfaces (`RuleSource`, `StateSource`, `BlockSink`) exist so `Runner` depends only on method shapes it needs, not on `*storage.Store` directly — that keeps this file's test free of any real database, and is *why* Task 6 put `AppState` in the `tracker` package instead of `storage` (otherwise `tracker` would have to import `storage` to declare `StateSource`, creating the cycle called out in Global Constraints).

- [ ] **Step 1: Write the failing integration-style test**

```go
// backend/tracker/runner_test.go
package tracker

import (
	"context"
	"testing"
	"time"
)

type fakeTracker struct {
	events []WindowInfo
	delay  time.Duration
}

func (f *fakeTracker) Watch(ctx context.Context, updates chan<- WindowInfo) error {
	for _, e := range f.events {
		select {
		case updates <- e:
		case <-ctx.Done():
			return ctx.Err()
		}
		time.Sleep(f.delay)
	}
	<-ctx.Done()
	return ctx.Err()
}

type fakeIdle struct{ d time.Duration }

func (f *fakeIdle) IdleDuration() time.Duration { return f.d }

type fakeRules struct{ rules []Rule }

func (f *fakeRules) ListAssignmentRulesByPriority() ([]Rule, error) { return f.rules, nil }

type fakeState struct{ state AppState }

func (f *fakeState) GetAppState() (AppState, error) { return f.state, nil }

type fakeSink struct{ saved []Block }

func (f *fakeSink) SaveActivityBlock(b Block, a Assignment) (int64, error) {
	f.saved = append(f.saved, b)
	return int64(len(f.saved)), nil
}

func TestRunner_PersistsClosedBlockOnWindowChange(t *testing.T) {
	tr := &fakeTracker{
		events: []WindowInfo{
			{AppName: "code", WindowTitle: "main.go"},
			{AppName: "firefox", WindowTitle: "docs"},
		},
		delay: 10 * time.Millisecond,
	}
	sink := &fakeSink{}
	r := NewRunner(tr, &fakeIdle{}, 3*time.Minute, &fakeRules{}, &fakeState{}, sink)
	r.pollInterval = 5 * time.Millisecond

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	r.Run(ctx)

	if len(sink.saved) != 1 {
		t.Fatalf("expected 1 saved block, got %d: %+v", len(sink.saved), sink.saved)
	}
	if sink.saved[0].AppName != "code" {
		t.Fatalf("expected first block to be 'code', got %+v", sink.saved[0])
	}
}
```

- [ ] **Step 1b: Run to confirm failure**

Run: `go test ./backend/tracker/...`
Expected: FAIL — `NewRunner`, `Runner` undefined.

- [ ] **Step 2: Write the Runner**

```go
// backend/tracker/runner.go
package tracker

import (
	"context"
	"time"
)

// RuleSource, StateSource, and BlockSink abstract just the storage methods
// Runner needs, so tests can fake them without a real database.
type RuleSource interface {
	ListAssignmentRulesByPriority() ([]Rule, error)
}

type StateSource interface {
	GetAppState() (AppState, error)
}

type BlockSink interface {
	SaveActivityBlock(b Block, a Assignment) (int64, error)
}

// Runner ties a WindowTracker and IdleDetector into the aggregation +
// assignment pipeline, persisting closed blocks via sink.
type Runner struct {
	tracker      WindowTracker
	idle         IdleDetector
	aggregator   *Aggregator
	rules        RuleSource
	state        StateSource
	sink         BlockSink
	pollInterval time.Duration
}

// NewRunner wires the pipeline together. afkThreshold is forwarded to the
// internal Aggregator.
func NewRunner(t WindowTracker, idle IdleDetector, afkThreshold time.Duration, rules RuleSource, state StateSource, sink BlockSink) *Runner {
	return &Runner{
		tracker:      t,
		idle:         idle,
		aggregator:   NewAggregator(afkThreshold),
		rules:        rules,
		state:        state,
		sink:         sink,
		pollInterval: time.Second,
	}
}

// Run consumes window-change events from tracker, blends in the current
// idle duration, feeds the aggregator, and persists any block it closes.
// It blocks until ctx is cancelled or the underlying tracker errors.
func (r *Runner) Run(ctx context.Context) error {
	updates := make(chan WindowInfo)
	trackerErr := make(chan error, 1)
	go func() { trackerErr <- r.tracker.Watch(ctx, updates) }()

	ticker := time.NewTicker(r.pollInterval)
	defer ticker.Stop()

	var last WindowInfo
	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-trackerErr:
			return err
		case last = <-updates:
			if err := r.process(Sample{Window: last, Idle: r.idle.IdleDuration(), At: time.Now()}); err != nil {
				return err
			}
		case <-ticker.C:
			// Re-check idle time even when the window hasn't changed, so a
			// long AFK stretch on the same window still closes the block.
			if err := r.process(Sample{Window: last, Idle: r.idle.IdleDuration(), At: time.Now()}); err != nil {
				return err
			}
		}
	}
}

func (r *Runner) process(s Sample) error {
	block, ok := r.aggregator.Add(s)
	if !ok {
		return nil
	}

	rules, err := r.rules.ListAssignmentRulesByPriority()
	if err != nil {
		return err
	}
	state, err := r.state.GetAppState()
	if err != nil {
		return err
	}

	assignment := Resolve(block, state.CurrentTaskID, state.CurrentProjectID, rules)
	_, err = r.sink.SaveActivityBlock(block, assignment)
	return err
}
```

- [ ] **Step 3: Run to confirm pass**

Run: `go test ./backend/tracker/...`
Expected: PASS. This test is time-based (real sleeps/timeouts, not a fake clock) — if it's ever flaky in CI, that's a sign to revisit it, but it's fine for now given how generous the margins are (100ms window vs. 10ms event spacing).

- [ ] **Step 4: Run the full test suite**

Run: `go test ./...`
Expected: PASS across `backend/storage` and `backend/tracker`.

- [ ] **Step 5: Commit**

```bash
git add backend/tracker/runner.go backend/tracker/runner_test.go
git commit -m "feat(tracker): add Runner wiring tracker+idle+aggregator+assignment+storage"
```

---

## What's next (not in this plan)

Plan 2 will cover: `backend/storage` CRUD for projects/tasks (needed by the UI), the Wails `app.go` API bindings that expose all of this to React, tray integration (current-task quick-switch, pause toggle), `main.go` wiring `Runner` into the app lifecycle, and the frontend (Tailwind/shadcn setup, Today/Timeline, Projects, Rules, Settings screens). It should be brainstormed as its own pass once this engine is working end-to-end, since it depends on decisions (exact API method names, UI component structure) that are easier to make once you've actually used the engine for a day or two.
