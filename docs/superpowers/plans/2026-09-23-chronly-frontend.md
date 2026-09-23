# chronly Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the chronly frontend (Today/Timeline/Projects/Rules/Settings) on top of the already-complete Go backend, plus the small backend additions the frontend needs (read/update activity blocks, rules CRUD, live events, matugen theme).

**Architecture:** Go side gets four small additions (activity-block read/update, rules CRUD, event emission, theme file passthrough) following the existing TDD storage pattern. Frontend is a full migration from the default JS scaffold to React 19 + TypeScript + Tailwind + shadcn/ui, with TanStack Query driven by Wails push events (not polling), Zustand for UI-only state, and two layout languages: a radial hub for Today, conventional card lists everywhere else.

**Tech Stack:** Go 1.25 (backend, unchanged patterns) · React 19 + TypeScript + Vite · Tailwind CSS + shadcn/ui · TanStack Query · Zustand · Framer Motion · Recharts · `fsnotify` (new Go dependency, theme file watching)

**Spec:** `docs/superpowers/specs/2026-09-23-chronly-frontend-design.md`

## Global Constraints

- Go backend TDD pattern from prior tasks applies to every backend task: failing test → confirm fail → implement → confirm pass → commit.
- No automated frontend tests in v1 (per spec) — frontend tasks are verified manually via `wails dev -tags webkit2_41` (the `-tags webkit2_41` flag is required on this Arch/CachyOS machine; see README).
- All new Go code: no comments unless documenting a non-obvious constraint (matches the rest of the codebase).
- Commit messages: no AI attribution trailers in this repo (established project convention).
- Per-task branch (`feat/<task-name>`), pushed and squash-merged into `master` after manual verification — established workflow for this project.
- Frontend components reference colors only via the semantic Tailwind names mapped to CSS custom properties (`--color-*`) — never a raw hex value — so the matugen theme (Task 4) and the default fallback palette (Task 6) both work without per-component changes.

## Review Focus

- **matugen not installed at all** (fresh machine, no `~/.config/matugen`): `GetThemeCSS` must return `("", nil)`, not an error, and the frontend must fall back to the shipped default palette instead of rendering with missing CSS variables. Task 4 and Task 6 both need to exercise this.
- **A block with no task/project assigned** (`assigned_by` unset, `task_id`/`project_id` NULL) reaching Timeline/Today: must render as a distinct "unsorted" state (the `error` role), not crash on a nil task lookup or silently show a blank row. Task 10/9's block-list rendering needs to handle `taskID: null` explicitly.
- **Splitting a block at a timestamp outside its `[start_time, end_time]` range**: `SplitActivityBlock` must reject this with an error rather than silently producing a negative-duration block. Task 1's tests need this case.
- **Two rules with the same priority**: `ListAssignmentRulesByPriority`'s `ORDER BY priority DESC` has no secondary sort key, so ties are DB-order-dependent; the Rules screen's reorder UI (Task 12) needs a stable secondary key (e.g. `id ASC`) so re-rendering after a save doesn't visibly shuffle unrelated rows.
- **Deleting a project/task that assignment rules or activity blocks still reference**: `assignment_rules.project_id`/`task_id` and `activity_blocks.project_id`/`task_id` have FK constraints in the schema; Task 12's `DeleteAssignmentRule` needs a test confirming rule deletion doesn't cascade-fail on unrelated FKs, and the plan explicitly keeps project/task deletion as archive-only (already true) so this failure mode can't be hit from the UI.

---

## File Structure

**Backend (new/modified):**
- `backend/storage/activity.go` — add `ListActivityBlocksForRange`, `UpdateActivityBlockAssignment`, `SplitActivityBlock`
- `backend/storage/activity_test.go` — tests for the above
- `backend/tracker/assign.go` — add `ID int64` field to `Rule`
- `backend/storage/rules.go` — modify `ListAssignmentRulesByPriority` to select `id`; add `CreateAssignmentRule`, `UpdateAssignmentRule`, `DeleteAssignmentRule`
- `backend/storage/rules_test.go` — tests for the above
- `app.go` — track `idleDetectorTier` on `App`; add `fsnotify` watcher setup in `startup`; add `themeCSS` field + mutex
- `api.go` — add `ListActivityBlocksForRange`, `UpdateActivityBlockAssignment`, `SplitActivityBlock`, `GetIdleDetectorTier`, `CreateAssignmentRule`, `UpdateAssignmentRule`, `DeleteAssignmentRule`, `ListAssignmentRules`, `GetThemeCSS`
- `events.go` (new) — small helpers wrapping `runtime.EventsEmit` calls for `block:closed`, `state:changed`, `theme:changed`
- `backend/tracker/runner.go` — modify `BlockSink`/`Runner` wiring so `Runner.process` can notify on block close (via a new optional callback, not a hard dependency on Wails runtime)

**Matugen (new):**
- `~/.config/matugen/templates/matugen-chronly.css` — new template (outside the repo, user's dotfiles)
- `~/.config/matugen/config.toml` — add `[templates.chronly]` entry (outside the repo)

**Frontend (new, replacing the JS scaffold):**
- `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts` — migrated to TS + new deps
- `frontend/tailwind.config.ts`, `frontend/src/index.css` — Tailwind + CSS custom properties + default palette
- `frontend/src/main.tsx` (replaces `main.jsx`)
- `frontend/src/App.tsx` (replaces `App.jsx`)
- `frontend/src/lib/api.ts` — typed wrappers around the generated Wails bindings
- `frontend/src/lib/queryClient.ts` — TanStack Query client + event-driven invalidation
- `frontend/src/lib/theme.ts` — theme injection + `theme:changed` subscription
- `frontend/src/store/uiStore.ts` — Zustand store (`activeScreen`, `navStyle`)
- `frontend/src/components/shells/SidebarShell.tsx`, `TabsShell.tsx`, `CommandPaletteShell.tsx`
- `frontend/src/components/RadialHub.tsx` — Today's hub + SVG rays
- `frontend/src/screens/TodayScreen.tsx`, `TimelineScreen.tsx`, `ProjectsScreen.tsx`, `RulesScreen.tsx`, `SettingsScreen.tsx`
- `frontend/src/components/ui/*` — shadcn-generated primitives (button, card, dialog, etc.)

---

### Task 1: Storage — read and manually edit activity blocks

**Files:**
- Modify: `backend/storage/activity.go`
- Modify: `backend/storage/activity_test.go`

**Interfaces:**
- Consumes: `tracker.Block` (existing), `storage.Store` (existing)
- Produces: `(*Store) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error)`, `(*Store) UpdateActivityBlockAssignment(id int64, taskID *int64) error`, `(*Store) SplitActivityBlock(id int64, splitAt time.Time) (newBlockID int64, err error)`

- [ ] **Step 1: Write the failing tests**

```go
// add to backend/storage/activity_test.go

func TestListActivityBlocksForRange_FiltersByStartTime(t *testing.T) {
	s := newTestStore(t)
	in := time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC)
	before := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	after := time.Date(2026, 1, 3, 10, 0, 0, 0, time.UTC)

	for _, start := range []time.Time{before, in, after} {
		if _, err := s.SaveActivityBlock(
			tracker.Block{StartTime: start, EndTime: start.Add(time.Minute), AppName: "code", WindowTitle: "x"},
			tracker.Assignment{},
		); err != nil {
			t.Fatal(err)
		}
	}

	rangeStart := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(2026, 1, 3, 0, 0, 0, 0, time.UTC)
	blocks, err := s.ListActivityBlocksForRange(rangeStart, rangeEnd)
	if err != nil {
		t.Fatalf("ListActivityBlocksForRange: %v", err)
	}
	if len(blocks) != 1 || !blocks[0].StartTime.Equal(in) {
		t.Fatalf("expected only the block starting at %v, got %+v", in, blocks)
	}
}

func TestUpdateActivityBlockAssignment_SetsTaskAndProject(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO tasks (id, project_id, name) VALUES (10, 1, 't')`); err != nil {
		t.Fatal(err)
	}
	start := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	id, err := s.SaveActivityBlock(
		tracker.Block{StartTime: start, EndTime: start.Add(time.Minute), AppName: "code", WindowTitle: "x"},
		tracker.Assignment{},
	)
	if err != nil {
		t.Fatal(err)
	}

	taskID := int64(10)
	if err := s.UpdateActivityBlockAssignment(id, &taskID); err != nil {
		t.Fatalf("UpdateActivityBlockAssignment: %v", err)
	}

	var gotTaskID, gotProjectID int64
	var gotAssignedBy string
	if err := s.db.QueryRow(
		`SELECT task_id, project_id, assigned_by FROM activity_blocks WHERE id = ?`, id,
	).Scan(&gotTaskID, &gotProjectID, &gotAssignedBy); err != nil {
		t.Fatal(err)
	}
	if gotTaskID != 10 || gotProjectID != 1 || gotAssignedBy != "manual" {
		t.Fatalf("expected task=10 project=1 assigned_by=manual, got task=%d project=%d assigned_by=%s",
			gotTaskID, gotProjectID, gotAssignedBy)
	}
}

func TestSplitActivityBlock_CreatesTwoBlocks(t *testing.T) {
	s := newTestStore(t)
	start := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(10 * time.Minute)
	id, err := s.SaveActivityBlock(
		tracker.Block{StartTime: start, EndTime: end, AppName: "code", WindowTitle: "x"},
		tracker.Assignment{},
	)
	if err != nil {
		t.Fatal(err)
	}

	splitAt := start.Add(4 * time.Minute)
	newID, err := s.SplitActivityBlock(id, splitAt)
	if err != nil {
		t.Fatalf("SplitActivityBlock: %v", err)
	}

	var firstEnd, secondStart time.Time
	if err := s.db.QueryRow(`SELECT end_time FROM activity_blocks WHERE id = ?`, id).Scan(&firstEnd); err != nil {
		t.Fatal(err)
	}
	if err := s.db.QueryRow(`SELECT start_time FROM activity_blocks WHERE id = ?`, newID).Scan(&secondStart); err != nil {
		t.Fatal(err)
	}
	if !firstEnd.Equal(splitAt) || !secondStart.Equal(splitAt) {
		t.Fatalf("expected both halves to meet at %v, got firstEnd=%v secondStart=%v", splitAt, firstEnd, secondStart)
	}
}

func TestSplitActivityBlock_RejectsSplitOutsideRange(t *testing.T) {
	s := newTestStore(t)
	start := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	end := start.Add(10 * time.Minute)
	id, err := s.SaveActivityBlock(
		tracker.Block{StartTime: start, EndTime: end, AppName: "code", WindowTitle: "x"},
		tracker.Assignment{},
	)
	if err != nil {
		t.Fatal(err)
	}

	if _, err := s.SplitActivityBlock(id, start.Add(-time.Minute)); err == nil {
		t.Fatal("expected error splitting before block start")
	}
	if _, err := s.SplitActivityBlock(id, end.Add(time.Minute)); err == nil {
		t.Fatal("expected error splitting after block end")
	}
}
```

- [ ] **Step 2: Run to confirm failure**

Run: `go test ./backend/storage/... -run 'TestListActivityBlocksForRange|TestUpdateActivityBlockAssignment|TestSplitActivityBlock'`
Expected: FAIL — the three methods are undefined.

- [ ] **Step 3: Implement**

```go
// add to backend/storage/activity.go

import (
	"errors"
	"time"

	"chronly/backend/tracker"
)

func (s *Store) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error) {
	rows, err := s.db.Query(
		`SELECT start_time, end_time, app_name, window_title, task_id, project_id
		 FROM activity_blocks
		 WHERE start_time >= ? AND start_time < ?
		 ORDER BY start_time ASC`,
		start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []tracker.Block
	for rows.Next() {
		var b tracker.Block
		var taskID, projectID *int64
		if err := rows.Scan(&b.StartTime, &b.EndTime, &b.AppName, &b.WindowTitle, &taskID, &projectID); err != nil {
			return nil, err
		}
		blocks = append(blocks, b)
	}
	return blocks, rows.Err()
}

func (s *Store) UpdateActivityBlockAssignment(id int64, taskID *int64) error {
	var projectID *int64
	if taskID != nil {
		var pid int64
		if err := s.db.QueryRow(`SELECT project_id FROM tasks WHERE id = ?`, *taskID).Scan(&pid); err != nil {
			return err
		}
		projectID = &pid
	}
	_, err := s.db.Exec(
		`UPDATE activity_blocks SET task_id = ?, project_id = ?, assigned_by = 'manual' WHERE id = ?`,
		taskID, projectID, id,
	)
	return err
}

func (s *Store) SplitActivityBlock(id int64, splitAt time.Time) (int64, error) {
	var startTime, endTime time.Time
	var appName, windowTitle string
	var taskID, projectID *int64
	var assignedBy *string
	if err := s.db.QueryRow(
		`SELECT start_time, end_time, app_name, window_title, task_id, project_id, assigned_by
		 FROM activity_blocks WHERE id = ?`, id,
	).Scan(&startTime, &endTime, &appName, &windowTitle, &taskID, &projectID, &assignedBy); err != nil {
		return 0, err
	}

	if !splitAt.After(startTime) || !splitAt.Before(endTime) {
		return 0, errors.New("split point must be strictly inside the block's time range")
	}

	if _, err := s.db.Exec(`UPDATE activity_blocks SET end_time = ? WHERE id = ?`, splitAt, id); err != nil {
		return 0, err
	}

	res, err := s.db.Exec(
		`INSERT INTO activity_blocks (start_time, end_time, app_name, window_title, task_id, project_id, assigned_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		splitAt, endTime, appName, windowTitle, taskID, projectID, assignedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `go test ./backend/storage/... -run 'TestListActivityBlocksForRange|TestUpdateActivityBlockAssignment|TestSplitActivityBlock'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/storage/activity.go backend/storage/activity_test.go
git commit -m "feat(storage): read and manually edit activity blocks"
```

---

### Task 2: Rules CRUD

**Files:**
- Modify: `backend/tracker/assign.go` — add `ID int64` to `Rule`
- Modify: `backend/storage/rules.go`
- Modify: `backend/storage/rules_test.go`

**Interfaces:**
- Consumes: `tracker.Rule` (modified)
- Produces: `(*Store) CreateAssignmentRule(r tracker.Rule) (int64, error)`, `(*Store) UpdateAssignmentRule(r tracker.Rule) error`, `(*Store) DeleteAssignmentRule(id int64) error`

`ListAssignmentRulesByPriority`'s query and scan both need `id` added so `Rule.ID` is populated — existing callers (`Runner`) don't read `ID`, so this is a safe additive change.

- [ ] **Step 1: Write the failing tests**

```go
// add to backend/storage/rules_test.go

func TestCreateUpdateDeleteAssignmentRule(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}

	id, err := s.CreateAssignmentRule(tracker.Rule{
		PatternType: "app_name", Pattern: "firefox", ProjectID: 1, Priority: 5,
	})
	if err != nil {
		t.Fatalf("CreateAssignmentRule: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != id || rules[0].Pattern != "firefox" {
		t.Fatalf("unexpected rules after create: %+v", rules)
	}

	if err := s.UpdateAssignmentRule(tracker.Rule{
		ID: id, PatternType: "app_name", Pattern: "chrome", ProjectID: 1, Priority: 9,
	}); err != nil {
		t.Fatalf("UpdateAssignmentRule: %v", err)
	}
	rules, err = s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].Pattern != "chrome" || rules[0].Priority != 9 {
		t.Fatalf("unexpected rules after update: %+v", rules)
	}

	if err := s.DeleteAssignmentRule(id); err != nil {
		t.Fatalf("DeleteAssignmentRule: %v", err)
	}
	rules, err = s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 0 {
		t.Fatalf("expected no rules after delete, got %+v", rules)
	}
}

func TestListAssignmentRulesByPriority_StableOrderOnTies(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}
	firstID, err := s.CreateAssignmentRule(tracker.Rule{PatternType: "app_name", Pattern: "a", ProjectID: 1, Priority: 5})
	if err != nil {
		t.Fatal(err)
	}
	secondID, err := s.CreateAssignmentRule(tracker.Rule{PatternType: "app_name", Pattern: "b", ProjectID: 1, Priority: 5})
	if err != nil {
		t.Fatal(err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 2 || rules[0].ID != firstID || rules[1].ID != secondID {
		t.Fatalf("expected stable id-ascending order on tied priority, got %+v", rules)
	}
}
```

- [ ] **Step 2: Run to confirm failure**

Run: `go test ./backend/storage/... -run 'TestCreateUpdateDeleteAssignmentRule|TestListAssignmentRulesByPriority_StableOrderOnTies'`
Expected: FAIL — `CreateAssignmentRule` etc. undefined, and/or `rules[0].ID` doesn't compile since `Rule` has no `ID` field yet.

- [ ] **Step 3: Implement**

```go
// backend/tracker/assign.go — add ID to the Rule struct

type Rule struct {
	ID          int64
	PatternType string
	Pattern     string
	ProjectID   int64
	TaskID      *int64
	Priority    int
}
```

```go
// backend/storage/rules.go — replace the whole file

package storage

import "chronly/backend/tracker"

func (s *Store) ListAssignmentRulesByPriority() ([]tracker.Rule, error) {
	rows, err := s.db.Query(
		`SELECT id, pattern_type, pattern, project_id, task_id, priority
		 FROM assignment_rules ORDER BY priority DESC, id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []tracker.Rule
	for rows.Next() {
		var r tracker.Rule
		if err := rows.Scan(&r.ID, &r.PatternType, &r.Pattern, &r.ProjectID, &r.TaskID, &r.Priority); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func (s *Store) CreateAssignmentRule(r tracker.Rule) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO assignment_rules (pattern_type, pattern, project_id, task_id, priority)
		 VALUES (?, ?, ?, ?, ?)`,
		r.PatternType, r.Pattern, r.ProjectID, r.TaskID, r.Priority,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateAssignmentRule(r tracker.Rule) error {
	_, err := s.db.Exec(
		`UPDATE assignment_rules SET pattern_type = ?, pattern = ?, project_id = ?, task_id = ?, priority = ?
		 WHERE id = ?`,
		r.PatternType, r.Pattern, r.ProjectID, r.TaskID, r.Priority, r.ID,
	)
	return err
}

func (s *Store) DeleteAssignmentRule(id int64) error {
	_, err := s.db.Exec(`DELETE FROM assignment_rules WHERE id = ?`, id)
	return err
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `go test ./... -count=1`
Expected: PASS across all packages (this also re-verifies `Runner`/`Resolve` still compile and pass with the modified `Rule` struct).

- [ ] **Step 5: Commit**

```bash
git add backend/tracker/assign.go backend/storage/rules.go backend/storage/rules_test.go
git commit -m "feat(storage): add assignment rule CRUD"
```

---

### Task 3: Idle detector tier tracking

**Files:**
- Modify: `app.go`

**Interfaces:**
- Consumes: `App.resolveIdleDetector` (existing, modified)
- Produces: `(*App) GetIdleDetectorTier() string` — returns `"wayland"`, `"evdev"`, or `"none"`

- [ ] **Step 1: Add the field and set it in resolveIdleDetector**

```go
// app.go — add to the App struct
type App struct {
	ctx             context.Context
	store           *storage.Store
	cancel          context.CancelFunc
	tray            *Tray
	idleDetectorTier string
}
```

```go
// app.go — modify resolveIdleDetector to set a.idleDetectorTier before each return

func (a *App) resolveIdleDetector(ctx context.Context) (tracker.IdleDetector, func() error) {
	if detector, run, err := tracker.NewWaylandIdleDetector(ctx, waylandIdleMillis); err == nil {
		a.idleDetectorTier = "wayland"
		return detector, run
	} else {
		log.Printf("wayland idle detector unavailable: %v", err)
	}

	if detector, run, err := tracker.NewEvdevIdleDetector(ctx); err == nil {
		a.idleDetectorTier = "evdev"
		return detector, run
	} else {
		log.Printf("evdev idle detector unavailable: %v", err)
	}

	choice, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Idle detection unavailable",
		Message:       "chronly couldn't set up AFK detection (tried Wayland idle-notify and raw input devices). Continue tracking windows only, without AFK detection?",
		Buttons:       []string{"Continue", "Quit"},
		DefaultButton: "Continue",
		CancelButton:  "Quit",
	})
	if err != nil || choice != "Continue" {
		runtime.Quit(a.ctx)
	}

	a.idleDetectorTier = "none"
	return noopIdleDetector{}, nil
}

func (a *App) GetIdleDetectorTier() string {
	return a.idleDetectorTier
}
```

- [ ] **Step 2: Build and manually verify**

Run: `go build -tags webkit2_41 ./...`
Expected: builds clean. This is state-tracking around an already-manually-verified fallback chain (Task 3 of the tracking-engine-core plan), so no new automated test — confirmed instead in Task 13 (Settings screen) when the tier actually renders on screen.

- [ ] **Step 3: Commit**

```bash
git add app.go
git commit -m "feat: track which idle-detector tier ended up active"
```

---

### Task 4: Live events + matugen theme passthrough

**Files:**
- Create: `events.go`
- Modify: `backend/tracker/runner.go`
- Modify: `app.go`
- Modify: `api.go`
- Modify: `go.mod`, `go.sum` (new dependency: `github.com/fsnotify/fsnotify`)
- Create (outside repo): `~/.config/matugen/templates/matugen-chronly.css`
- Modify (outside repo): `~/.config/matugen/config.toml`

**Interfaces:**
- Consumes: `tracker.Runner` (existing), `tracker.Block`, `tracker.AppState`
- Produces: `(*App) GetThemeCSS() (string, error)`, Wails events `block:closed` (payload: `tracker.Block`), `state:changed` (payload: `tracker.AppState`), `theme:changed` (payload: `string`)

`Runner` currently has no way to notify anything when it saves a block — `process()` calls `r.sink.SaveActivityBlock` directly and returns. Rather than making `tracker` import Wails (which would break the layering the whole backend has followed), `Runner` gets an optional callback field the caller can set.

- [ ] **Step 1: Add an optional OnBlockSaved callback to Runner**

```go
// backend/tracker/runner.go — add a field and call it after a successful save

type Runner struct {
	tracker      WindowTracker
	idle         IdleDetector
	aggregator   *Aggregator
	rules        RuleSource
	state        StateSource
	sink         BlockSink
	pollInterval time.Duration
	OnBlockSaved func(Block)
}
```

```go
// backend/tracker/runner.go — modify process to call it

func (r *Runner) process(s Sample) error {
	state, err := r.state.GetAppState()
	if err != nil {
		return err
	}

	var block Block
	var ok bool
	if state.TrackingPaused {
		block, ok = r.aggregator.CloseOpen()
	} else {
		block, ok = r.aggregator.Add(s)
	}
	if !ok {
		return nil
	}

	rules, err := r.rules.ListAssignmentRulesByPriority()
	if err != nil {
		return err
	}

	assignment := Resolve(block, state.CurrentTaskID, state.CurrentProjectID, rules)
	if _, err := r.sink.SaveActivityBlock(block, assignment); err != nil {
		return err
	}
	if r.OnBlockSaved != nil {
		r.OnBlockSaved(block)
	}
	return nil
}
```

- [ ] **Step 2: Update the existing Runner test to cover the callback**

```go
// add to backend/tracker/runner_test.go

func TestRunner_CallsOnBlockSavedWhenBlockCloses(t *testing.T) {
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

	var saved []Block
	var mu sync.Mutex
	r.OnBlockSaved = func(b Block) {
		mu.Lock()
		defer mu.Unlock()
		saved = append(saved, b)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	r.Run(ctx)

	mu.Lock()
	defer mu.Unlock()
	if len(saved) != 1 || saved[0].AppName != "code" {
		t.Fatalf("expected OnBlockSaved called once with the 'code' block, got %+v", saved)
	}
}
```

Run: `go test ./backend/tracker/... -run TestRunner_CallsOnBlockSavedWhenBlockCloses -v -count=1`
Expected: PASS (the field defaults to `nil` and is guarded by the `if r.OnBlockSaved != nil` check, so this is additive — confirm the pre-existing `TestRunner_PersistsClosedBlockOnWindowChange` and `TestRunner_PauseClosesOpenBlockAndSkipsAggregation` still pass too via `go test ./backend/tracker/... -count=1`).

- [ ] **Step 3: Add the fsnotify dependency**

Run: `go get github.com/fsnotify/fsnotify`
Expected: adds the module to `go.mod`/`go.sum`.

- [ ] **Step 4: Wire event emission and theme watching into App**

```go
// events.go
package main

import (
	"chronly/backend/tracker"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func emitBlockClosed(ctx interface{ Done() <-chan struct{} }, block tracker.Block) {}
```

Delete the placeholder above — write the real thing instead, since `runtime.EventsEmit` takes a `context.Context` and there's no reason to hide that behind a narrower interface here:

```go
// events.go
package main

import (
	"context"

	"chronly/backend/tracker"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func emitBlockClosed(ctx context.Context, block tracker.Block) {
	runtime.EventsEmit(ctx, "block:closed", block)
}

func emitStateChanged(ctx context.Context, state tracker.AppState) {
	runtime.EventsEmit(ctx, "state:changed", state)
}

func emitThemeChanged(ctx context.Context, css string) {
	runtime.EventsEmit(ctx, "theme:changed", css)
}
```

```go
// app.go — add to the App struct
type App struct {
	ctx              context.Context
	store            *storage.Store
	cancel           context.CancelFunc
	tray             *Tray
	idleDetectorTier string
	themeWatcher     *fsnotify.Watcher
}
```

```go
// app.go — in startup(), after the runner is created and before "a.tray = newTray(a)"

runner.OnBlockSaved = func(b tracker.Block) {
	emitBlockClosed(ctx, b)
}

if err := a.watchTheme(ctx); err != nil {
	log.Printf("theme watcher unavailable: %v", err)
}
```

```go
// app.go — new methods

func (a *App) watchTheme(ctx context.Context) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	a.themeWatcher = watcher

	path, err := themeCSSPath()
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := watcher.Add(dir); err != nil {
		return err
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				watcher.Close()
				return
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if filepath.Clean(event.Name) != filepath.Clean(path) {
					continue
				}
				css, err := a.GetThemeCSS()
				if err != nil {
					log.Printf("reload theme: %v", err)
					continue
				}
				emitThemeChanged(a.ctx, css)
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("theme watcher error: %v", err)
			}
		}
	}()
	return nil
}

func (a *App) GetThemeCSS() (string, error) {
	path, err := themeCSSPath()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func themeCSSPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "colors", "matugen", "chronly.css"), nil
}
```

```go
// app.go — import fsnotify
import (
	"github.com/fsnotify/fsnotify"
)
```

```go
// app.go — in shutdown(), close the watcher

func (a *App) shutdown(ctx context.Context) {
	if a.cancel != nil {
		a.cancel()
	}
	if a.themeWatcher != nil {
		a.themeWatcher.Close()
	}
	if a.store != nil {
		a.store.Close()
	}
	systray.Quit()
}
```

- [ ] **Step 5: Emit state:changed from the existing setters**

```go
// api.go — modify SetCurrentTask and SetTrackingPaused to emit after a successful write

func (a *App) SetCurrentTask(taskID *int64) error {
	if err := a.store.SetCurrentTask(taskID); err != nil {
		return err
	}
	if state, err := a.store.GetAppState(); err == nil {
		emitStateChanged(a.ctx, state)
	}
	return nil
}

func (a *App) SetTrackingPaused(paused bool) error {
	if err := a.store.SetTrackingPaused(paused); err != nil {
		return err
	}
	if state, err := a.store.GetAppState(); err == nil {
		emitStateChanged(a.ctx, state)
	}
	return nil
}
```

- [ ] **Step 6: Add the remaining read/CRUD bindings to api.go**

```go
// api.go — add

func (a *App) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error) {
	return a.store.ListActivityBlocksForRange(start, end)
}

func (a *App) UpdateActivityBlockAssignment(id int64, taskID *int64) error {
	return a.store.UpdateActivityBlockAssignment(id, taskID)
}

func (a *App) SplitActivityBlock(id int64, splitAt time.Time) (int64, error) {
	return a.store.SplitActivityBlock(id, splitAt)
}

func (a *App) GetIdleDetectorTier() string {
	return a.idleDetectorTier
}

func (a *App) ListAssignmentRules() ([]tracker.Rule, error) {
	return a.store.ListAssignmentRulesByPriority()
}

func (a *App) CreateAssignmentRule(r tracker.Rule) (int64, error) {
	return a.store.CreateAssignmentRule(r)
}

func (a *App) UpdateAssignmentRule(r tracker.Rule) error {
	return a.store.UpdateAssignmentRule(r)
}

func (a *App) DeleteAssignmentRule(id int64) error {
	return a.store.DeleteAssignmentRule(id)
}
```

Note: `GetIdleDetectorTier` is defined once, in Task 3 — do not redefine it here if Task 3 already added it directly to `app.go`; this step only needs the four new methods (`ListActivityBlocksForRange` through `DeleteAssignmentRule`) plus the earlier `SetCurrentTask`/`SetTrackingPaused` edits.

- [ ] **Step 7: Build, run the full backend suite, and regenerate frontend bindings**

Run: `go build -tags webkit2_41 ./... && go vet -tags webkit2_41 ./... && go test ./... -count=1`
Expected: all pass.

Run: `wails generate module`
Expected: `frontend/wailsjs/go/main/App.d.ts` now lists the new methods, `frontend/wailsjs/go/models.ts` includes `tracker.Block` and the modified `tracker.Rule` (with `ID`).

- [ ] **Step 8: Add the matugen template (outside the repo, in the user's dotfiles)**

Create `~/.config/matugen/templates/matugen-chronly.css`:

```css
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

Add to `~/.config/matugen/config.toml`:

```toml
[templates.chronly]
input_path = '~/.config/matugen/templates/matugen-chronly.css'
output_path = '~/.config/colors/matugen/chronly.css'
```

- [ ] **Step 9: Manually verify the theme pipeline end-to-end**

Run: `matugen image <path-to-any-wallpaper>` (or whatever matugen invocation the existing setup already uses to re-theme on wallpaper change)
Expected: `~/.config/colors/matugen/chronly.css` is created/updated with real hex values (not template placeholders).

Run the app (`wails dev -tags webkit2_41`) once Task 6 exists so `GetThemeCSS` has a caller; until then, confirm the file directly: `cat ~/.config/colors/matugen/chronly.css` shows valid CSS.

- [ ] **Step 10: Commit**

```bash
git add events.go backend/tracker/runner.go backend/tracker/runner_test.go app.go api.go go.mod go.sum
git commit -m "feat: push block/state/theme changes to the frontend via Wails events"
```

(The matugen template/config files live outside the repo and are not committed here.)

---

### Task 5: Frontend scaffold — Vite + TypeScript + Tailwind + shadcn/ui

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
- Modify: `frontend/vite.config.js` → replace with `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`, `frontend/postcss.config.js`
- Create: `frontend/src/main.tsx` (replaces `main.jsx`)
- Create: `frontend/src/App.tsx` (replaces `App.jsx`)
- Delete: `frontend/src/App.jsx`, `frontend/src/main.jsx`, `frontend/src/App.css`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: nothing from earlier tasks (frontend build tooling only)
- Produces: a TypeScript + Tailwind Vite project that `wails dev -tags webkit2_41` and `wails build -tags webkit2_41` both still build. shadcn/ui CLI initialized so later tasks can run `npx shadcn add <component>`.

- [ ] **Step 1: Remove the old JS entrypoints**

Run: `rm frontend/src/App.jsx frontend/src/main.jsx frontend/src/App.css`

- [ ] **Step 2: Install the new dependencies**

Run (from `frontend/`):
```bash
npm install -D typescript tailwindcss postcss autoprefixer @types/node
npm install @tanstack/react-query zustand framer-motion recharts clsx tailwind-merge lucide-react class-variance-authority
```

- [ ] **Step 3: Add tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// frontend/tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Replace vite.config.js with vite.config.ts**

Run: `rm frontend/vite.config.js`

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 5: Add Tailwind config and index.css**

```typescript
// frontend/tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        tertiary: 'var(--color-tertiary)',
        outline: 'var(--color-outline)',
        error: 'var(--color-error)',
      },
      borderRadius: {
        pill: '9999px',
      },
    },
  },
  plugins: [],
} satisfies Config
```

```js
// frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

```css
/* frontend/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-surface: #0a0a0f;
  --color-surface-container: #16161d;
  --color-surface-container-high: #1f1f29;
  --color-on-surface: #e8e6f0;
  --color-on-surface-variant: #a5a2b8;
  --color-primary: #c4b5fd;
  --color-secondary: #a78bfa;
  --color-tertiary: #8b7cd8;
  --color-outline: #3a3a47;
  --color-error: #f2879e;
}

body {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
}
```

- [ ] **Step 6: Add main.tsx and a minimal App.tsx**

```html
<!-- frontend/index.html — update the script tag -->
<script src="./src/main.tsx" type="module"></script>
```

```typescript
// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

```typescript
// frontend/src/App.tsx — placeholder, replaced screen-by-screen in later tasks
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface text-on-surface">
      <p>chronly</p>
    </div>
  )
}
```

- [ ] **Step 7: Initialize shadcn/ui**

Run (from `frontend/`): `npx shadcn@latest init`
Expected: prompts for style/base color/CSS variables — choose "New York" style, base color that maps onto the custom properties above (accept defaults, components.json is created), CSS variables mode. This creates `frontend/components.json` and `frontend/src/lib/utils.ts`.

- [ ] **Step 8: Manually verify the build**

Run: `wails dev -tags webkit2_41`
Expected: app window opens showing "chronly" on a near-black background, no console errors about missing modules.

Run: `wails build -tags webkit2_41`
Expected: production build succeeds.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/tailwind.config.ts frontend/postcss.config.js frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/index.css frontend/components.json frontend/src/lib/utils.ts
git rm frontend/vite.config.js frontend/src/App.jsx frontend/src/main.jsx frontend/src/App.css
git commit -m "feat(frontend): migrate scaffold to TypeScript + Tailwind + shadcn/ui"
```

---

### Task 6: Theme injection

**Files:**
- Create: `frontend/src/lib/theme.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `GetThemeCSS()` and the `theme:changed` event from Task 4, `EventsOn`/`EventsOff` from `../../wailsjs/runtime/runtime`
- Produces: `installMatugenTheme(): () => void` — call once on app mount, returns a cleanup function

- [ ] **Step 1: Write the theme installer**

```typescript
// frontend/src/lib/theme.ts
import { GetThemeCSS } from '../../wailsjs/go/main/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'

const STYLE_TAG_ID = 'matugen-theme'

function applyThemeCSS(css: string) {
  let tag = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!css) {
    tag?.remove()
    return
  }
  if (!tag) {
    tag = document.createElement('style')
    tag.id = STYLE_TAG_ID
    document.head.appendChild(tag)
  }
  tag.textContent = css
}

export function installMatugenTheme(): () => void {
  GetThemeCSS().then(applyThemeCSS).catch(() => {})
  const unsubscribe = EventsOn('theme:changed', (css: string) => applyThemeCSS(css))
  return unsubscribe
}
```

- [ ] **Step 2: Wire it into App.tsx**

```typescript
// frontend/src/App.tsx
import { useEffect } from 'react'
import { installMatugenTheme } from './lib/theme'

export default function App() {
  useEffect(() => installMatugenTheme(), [])

  return (
    <div className="flex h-screen items-center justify-center bg-surface text-on-surface">
      <p>chronly</p>
    </div>
  )
}
```

- [ ] **Step 3: Manually verify both the default palette and the live matugen override**

Run: `wails dev -tags webkit2_41` with `~/.config/colors/matugen/chronly.css` **absent or renamed** temporarily.
Expected: window renders with the default near-black/violet palette from `index.css` (`GetThemeCSS` returns `""`, `applyThemeCSS` removes/skips the override tag).

Restore the file (or re-run `matugen image ...`), reload the app.
Expected: colors shift to match the real matugen-generated palette (visibly different violet tone than the hardcoded default, since it's generated from the current wallpaper).

Run: `matugen image <a-different-wallpaper>` while the app is open.
Expected: the app's colors update live without restarting, since `theme:changed` fires and `installMatugenTheme`'s listener re-applies the CSS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/theme.ts frontend/src/App.tsx
git commit -m "feat(frontend): inject matugen-driven theme with live reload"
```

---

### Task 7: Data layer — TanStack Query + typed API wrappers + event-driven invalidation

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/queryClient.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: all Wails bindings from `frontend/wailsjs/go/main/App` (Tasks 1, 2, 4 and the pre-existing ones)
- Produces: a typed `api` object grouping every Wails call, a configured `QueryClient`, `useQueryEvents(): void` (call once at the app root — subscribes to `block:closed`/`state:changed` and invalidates the right query keys)

- [ ] **Step 1: Write the typed API wrapper**

```typescript
// frontend/src/lib/api.ts
import * as App from '../../wailsjs/go/main/App'
import type { tracker } from '../../wailsjs/go/models'

export const api = {
  listProjects: () => App.ListProjects(),
  listArchivedProjects: () => App.ListArchivedProjects(),
  createProject: (p: tracker.Project) => App.CreateProject(p),
  updateProject: (p: tracker.Project) => App.UpdateProject(p),
  archiveProject: (id: number) => App.ArchiveProject(id),
  unarchiveProject: (id: number) => App.UnarchiveProject(id),

  listTasksByProject: (projectId: number) => App.ListTasksByProject(projectId),
  listDoneTasksByProject: (projectId: number) => App.ListDoneTasksByProject(projectId),
  listArchivedTasksByProject: (projectId: number) => App.ListArchivedTasksByProject(projectId),
  createTask: (t: tracker.Task) => App.CreateTask(t),
  updateTask: (t: tracker.Task) => App.UpdateTask(t),
  setTaskStatus: (id: number, status: string) => App.SetTaskStatus(id, status),

  getAppState: () => App.GetAppState(),
  setCurrentTask: (taskId: number | null) => App.SetCurrentTask(taskId),
  setTrackingPaused: (paused: boolean) => App.SetTrackingPaused(paused),

  listActivityBlocksForRange: (start: string, end: string) =>
    App.ListActivityBlocksForRange(start, end),
  updateActivityBlockAssignment: (id: number, taskId: number | null) =>
    App.UpdateActivityBlockAssignment(id, taskId),
  splitActivityBlock: (id: number, splitAt: string) => App.SplitActivityBlock(id, splitAt),

  listAssignmentRules: () => App.ListAssignmentRules(),
  createAssignmentRule: (r: tracker.Rule) => App.CreateAssignmentRule(r),
  updateAssignmentRule: (r: tracker.Rule) => App.UpdateAssignmentRule(r),
  deleteAssignmentRule: (id: number) => App.DeleteAssignmentRule(id),

  getIdleDetectorTier: () => App.GetIdleDetectorTier(),
}
```

- [ ] **Step 2: Write the query client and query-key conventions**

```typescript
// frontend/src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

export const queryKeys = {
  appState: ['appState'] as const,
  projects: ['projects'] as const,
  tasksByProject: (projectId: number) => ['tasks', projectId] as const,
  activityBlocks: (start: string, end: string) => ['activityBlocks', start, end] as const,
  assignmentRules: ['assignmentRules'] as const,
}
```

- [ ] **Step 3: Write the event-driven invalidation hook**

```typescript
// frontend/src/lib/api.ts — add at the bottom of the file

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { queryKeys } from './queryClient'

export function useQueryEvents() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const offBlockClosed = EventsOn('block:closed', () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
    })
    const offStateChanged = EventsOn('state:changed', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.appState })
    })
    return () => {
      offBlockClosed()
      offStateChanged()
    }
  }, [queryClient])
}
```

- [ ] **Step 4: Wire QueryClientProvider and the hook into App.tsx**

```typescript
// frontend/src/App.tsx
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installMatugenTheme } from './lib/theme'
import { useQueryEvents } from './lib/api'

function AppShell() {
  useQueryEvents()
  return (
    <div className="flex h-screen items-center justify-center bg-surface text-on-surface">
      <p>chronly</p>
    </div>
  )
}

export default function App() {
  useEffect(() => installMatugenTheme(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Manually verify**

Run: `wails dev -tags webkit2_41`
Expected: app still renders "chronly" with no console errors (React Query devtools not required, just confirm no thrown errors on mount — the provider wraps successfully).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/lib/queryClient.ts frontend/src/App.tsx
git commit -m "feat(frontend): add typed API layer and event-driven query invalidation"
```

---

### Task 8: Navigation shells + Zustand store

**Files:**
- Create: `frontend/src/store/uiStore.ts`
- Create: `frontend/src/components/shells/SidebarShell.tsx`
- Create: `frontend/src/components/shells/TabsShell.tsx`
- Create: `frontend/src/components/shells/CommandPaletteShell.tsx`
- Create: `frontend/src/components/shells/index.tsx`
- Create: `frontend/src/screens/TodayScreen.tsx`, `TimelineScreen.tsx`, `ProjectsScreen.tsx`, `RulesScreen.tsx`, `SettingsScreen.tsx` (placeholder content — filled in by Tasks 9–13)
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: nothing external (pure UI state)
- Produces: `useUiStore` (Zustand hook with `activeScreen`, `setActiveScreen`, `navStyle`, `setNavStyle`), `ScreenId` type, a `<Shell>` component that picks the right shell by `navStyle` and renders the active screen as `children`

- [ ] **Step 1: Write the Zustand store**

```typescript
// frontend/src/store/uiStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ScreenId = 'today' | 'timeline' | 'projects' | 'rules' | 'settings'
export type NavStyle = 'sidebar' | 'tabs' | 'palette'

interface UiState {
  activeScreen: ScreenId
  setActiveScreen: (screen: ScreenId) => void
  navStyle: NavStyle
  setNavStyle: (style: NavStyle) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeScreen: 'today',
      setActiveScreen: (screen) => set({ activeScreen: screen }),
      navStyle: 'sidebar',
      setNavStyle: (style) => set({ navStyle: style }),
    }),
    { name: 'chronly-ui' },
  ),
)

export const SCREENS: { id: ScreenId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'projects', label: 'Projects' },
  { id: 'rules', label: 'Rules' },
  { id: 'settings', label: 'Settings' },
]
```

- [ ] **Step 2: Write the three shells**

```typescript
// frontend/src/components/shells/SidebarShell.tsx
import { ReactNode } from 'react'
import { SCREENS, useUiStore } from '../../store/uiStore'

export function SidebarShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  return (
    <div className="flex h-screen bg-surface text-on-surface">
      <nav className="flex w-16 flex-col items-center gap-2 border-r border-outline py-4">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`w-12 rounded-pill py-2 text-xs ${
              activeScreen === screen.id
                ? 'bg-primary text-surface'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {screen.label.slice(0, 2)}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

```typescript
// frontend/src/components/shells/TabsShell.tsx
import { ReactNode } from 'react'
import { SCREENS, useUiStore } from '../../store/uiStore'

export function TabsShell({ children }: { children: ReactNode }) {
  const { activeScreen, setActiveScreen } = useUiStore()
  return (
    <div className="flex h-screen flex-col bg-surface text-on-surface">
      <nav className="flex gap-1 border-b border-outline p-2">
        {SCREENS.map((screen) => (
          <button
            key={screen.id}
            onClick={() => setActiveScreen(screen.id)}
            className={`rounded-pill px-4 py-1.5 text-sm ${
              activeScreen === screen.id
                ? 'bg-primary text-surface'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {screen.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

```typescript
// frontend/src/components/shells/CommandPaletteShell.tsx
import { ReactNode, useEffect, useState } from 'react'
import { SCREENS, useUiStore } from '../../store/uiStore'

export function CommandPaletteShell({ children }: { children: ReactNode }) {
  const { setActiveScreen } = useUiStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative h-screen bg-surface text-on-surface">
      <main className="h-full overflow-auto">{children}</main>
      {open && (
        <div className="absolute inset-0 flex items-start justify-center bg-black/50 pt-24">
          <div className="w-96 rounded-lg bg-surface-container-high p-2 shadow-xl">
            {SCREENS.map((screen) => (
              <button
                key={screen.id}
                onClick={() => {
                  setActiveScreen(screen.id)
                  setOpen(false)
                }}
                className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-container"
              >
                {screen.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

```typescript
// frontend/src/components/shells/index.tsx
import { ReactNode } from 'react'
import { useUiStore } from '../../store/uiStore'
import { SidebarShell } from './SidebarShell'
import { TabsShell } from './TabsShell'
import { CommandPaletteShell } from './CommandPaletteShell'

export function Shell({ children }: { children: ReactNode }) {
  const navStyle = useUiStore((s) => s.navStyle)
  if (navStyle === 'tabs') return <TabsShell>{children}</TabsShell>
  if (navStyle === 'palette') return <CommandPaletteShell>{children}</CommandPaletteShell>
  return <SidebarShell>{children}</SidebarShell>
}
```

- [ ] **Step 3: Write placeholder screens**

```typescript
// frontend/src/screens/TodayScreen.tsx
export function TodayScreen() {
  return <div className="p-6">Today (Task 9)</div>
}
```

Repeat the same one-line pattern for `TimelineScreen.tsx` ("Timeline (Task 10)"), `ProjectsScreen.tsx` ("Projects (Task 11)"), `RulesScreen.tsx` ("Rules (Task 12)"), `SettingsScreen.tsx` ("Settings (Task 13)") — each a named export matching the file name, same shape as `TodayScreen`.

- [ ] **Step 4: Wire the Shell + screen router into App.tsx**

```typescript
// frontend/src/App.tsx
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { installMatugenTheme } from './lib/theme'
import { useQueryEvents } from './lib/api'
import { Shell } from './components/shells'
import { useUiStore } from './store/uiStore'
import { TodayScreen } from './screens/TodayScreen'
import { TimelineScreen } from './screens/TimelineScreen'
import { ProjectsScreen } from './screens/ProjectsScreen'
import { RulesScreen } from './screens/RulesScreen'
import { SettingsScreen } from './screens/SettingsScreen'

function ActiveScreen() {
  const activeScreen = useUiStore((s) => s.activeScreen)
  switch (activeScreen) {
    case 'today':
      return <TodayScreen />
    case 'timeline':
      return <TimelineScreen />
    case 'projects':
      return <ProjectsScreen />
    case 'rules':
      return <RulesScreen />
    case 'settings':
      return <SettingsScreen />
  }
}

function AppShell() {
  useQueryEvents()
  return (
    <Shell>
      <ActiveScreen />
    </Shell>
  )
}

export default function App() {
  useEffect(() => installMatugenTheme(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  )
}
```

- [ ] **Step 5: Manually verify all three nav styles**

Run: `wails dev -tags webkit2_41`. In the browser devtools console (via `http://localhost:34115` in dev mode) or a temporary button, call `useUiStore.getState().setNavStyle('tabs')`, then `'palette'`, then back to `'sidebar'`.
Expected: chrome visibly changes between left-icon-column, top-tabs, and hidden-chrome-with-Cmd+K, while clicking through Today/Timeline/Projects/Rules/Settings always shows the matching placeholder text. Reload the window — the last-selected `navStyle` persists (via `zustand/persist` → `localStorage`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/store frontend/src/components/shells frontend/src/screens frontend/src/App.tsx
git commit -m "feat(frontend): add switchable navigation shells and screen routing"
```

---

### Task 9: Today screen — radial hub

**Files:**
- Create: `frontend/src/components/RadialHub.tsx`
- Modify: `frontend/src/screens/TodayScreen.tsx`

**Interfaces:**
- Consumes: `api.getAppState`, `api.listActivityBlocksForRange`, `api.setTrackingPaused`, `queryKeys` (Task 7)
- Produces: `<RadialHub center={...} satellites={...} />` — a reusable component (not Today-specific in its own file, so future screens could reuse the ray/satellite pattern if needed)

- [ ] **Step 1: Write the RadialHub component**

```typescript
// frontend/src/components/RadialHub.tsx
import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface Satellite {
  id: string
  label: string
  value: string
  angleDeg: number
}

interface RadialHubProps {
  centerLabel: string
  centerValue: string
  satellites: Satellite[]
  onCenterClick?: () => void
}

function rayPath(angleDeg: number): string {
  const rad = (angleDeg * Math.PI) / 180
  const startX = 100 + Math.cos(rad) * 90
  const startY = 100 + Math.sin(rad) * 90
  const endX = 100 + Math.cos(rad) * 170
  const endY = 100 + Math.sin(rad) * 170
  const midX = 100 + Math.cos(rad) * 130 + Math.sin(rad) * 12
  const midY = 100 + Math.sin(rad) * 130 - Math.cos(rad) * 12
  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`
}

export function RadialHub({ centerLabel, centerValue, satellites, onCenterClick }: RadialHubProps) {
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute h-[420px] w-[420px]">
        <circle cx="100" cy="100" r="70" className="fill-none stroke-outline/30" strokeWidth="1" />
        <circle cx="100" cy="100" r="95" className="fill-none stroke-outline/15" strokeWidth="1" />
        {satellites.map((s) => (
          <motion.path
            key={s.id}
            d={rayPath(s.angleDeg)}
            className="fill-none stroke-primary/40"
            strokeWidth="1.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </svg>

      <motion.button
        onClick={onCenterClick}
        whileHover={{ scale: 1.03 }}
        className="z-10 flex h-52 w-52 flex-col items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-surface shadow-2xl"
      >
        <span className="text-lg font-semibold">{centerLabel}</span>
        <span className="mt-1 text-3xl font-mono">{centerValue}</span>
      </motion.button>

      {satellites.map((s) => {
        const rad = (s.angleDeg * Math.PI) / 180
        const x = 210 + Math.cos(rad) * 170
        const y = 210 + Math.sin(rad) * 170
        return (
          <div
            key={s.id}
            className="absolute flex items-center gap-2 rounded-pill bg-surface-container px-4 py-2 text-sm shadow-lg"
            style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-on-surface-variant">{s.label}</span>
            <span className="font-medium">{s.value}</span>
          </div>
        )
      })}
    </div>
  )
}

export type { Satellite }
```

- [ ] **Step 2: Write the live-ticking duration hook**

```typescript
// frontend/src/lib/useTicker.ts
import { useEffect, useState } from 'react'

export function useElapsedSince(startIso: string | null): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startIso) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startIso])

  if (!startIso) return '00:00:00'
  const elapsedMs = Math.max(0, now - new Date(startIso).getTime())
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const s = String(totalSeconds % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}
```

- [ ] **Step 3: Write TodayScreen**

```typescript
// frontend/src/screens/TodayScreen.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { RadialHub, type Satellite } from '../components/RadialHub'
import { useElapsedSince } from '../lib/useTicker'

function startOfToday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfToday(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

export function TodayScreen() {
  const queryClient = useQueryClient()
  const { data: appState } = useQuery({
    queryKey: queryKeys.appState,
    queryFn: api.getAppState,
  })
  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(startOfToday(), endOfToday()),
    queryFn: () => api.listActivityBlocksForRange(startOfToday(), endOfToday()),
  })

  const pauseMutation = useMutation({
    mutationFn: (paused: boolean) => api.setTrackingPaused(paused),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.appState }),
  })

  const lastBlock = blocks[blocks.length - 1]
  const elapsed = useElapsedSince(lastBlock ? lastBlock.StartTime : null)

  const totalMinutesToday = blocks.reduce((sum, b) => {
    const start = new Date(b.StartTime).getTime()
    const end = new Date(b.EndTime).getTime()
    return sum + (end - start) / 60000
  }, 0)

  const unsortedCount = blocks.filter((b) => !b.AppName || b.AppName === '').length

  const satellites: Satellite[] = [
    { id: 'total', label: 'Today', value: `${Math.round(totalMinutesToday)}m`, angleDeg: -90 },
    { id: 'paused', label: 'Status', value: appState?.TrackingPaused ? 'Paused' : 'Tracking', angleDeg: 0 },
    { id: 'unsorted', label: 'Unsorted', value: String(unsortedCount), angleDeg: 90 },
    { id: 'blocks', label: 'Blocks', value: String(blocks.length), angleDeg: 180 },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 p-6">
      <RadialHub
        centerLabel={lastBlock ? lastBlock.AppName : 'No activity yet'}
        centerValue={elapsed}
        satellites={satellites}
        onCenterClick={() => pauseMutation.mutate(!appState?.TrackingPaused)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Manually verify**

Run: `wails dev -tags webkit2_41`, navigate to Today.
Expected: a central circle showing the most recent block's app name and a live-ticking `HH:MM:SS`, four satellite pills around it connected by animated curved rays, clicking the center toggles pause (verify via the tray's Pause checkbox reflecting the same state, since both read/write the same `state:changed`-backed `app_state` row).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RadialHub.tsx frontend/src/lib/useTicker.ts frontend/src/screens/TodayScreen.tsx
git commit -m "feat(frontend): build the Today radial hub screen"
```

---

### Task 10: Timeline screen

**Files:**
- Create: `frontend/src/components/BlockRow.tsx`
- Modify: `frontend/src/screens/TimelineScreen.tsx`

**Interfaces:**
- Consumes: `api.listActivityBlocksForRange`, `api.updateActivityBlockAssignment`, `api.splitActivityBlock`, `api.listProjects`, `api.listTasksByProject`
- Produces: nothing consumed by later tasks (leaf screen)

- [ ] **Step 1: Write the shared block-row component**

```typescript
// frontend/src/components/BlockRow.tsx
import type { tracker } from '../../wailsjs/go/models'

interface BlockRowProps {
  block: tracker.Block & { ID?: number; TaskID?: number | null }
  durationLabel: string
  onClick?: () => void
}

export function BlockRow({ block, durationLabel, onClick }: BlockRowProps) {
  const unsorted = block.TaskID == null

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ${
        unsorted ? 'bg-error/10 hover:bg-error/20' : 'bg-surface-container hover:bg-surface-container-high'
      }`}
    >
      <div>
        <p className="font-medium">{block.AppName || 'Unknown'}</p>
        <p className="text-sm text-on-surface-variant">{block.WindowTitle}</p>
      </div>
      <span className="font-mono text-sm">{durationLabel}</span>
    </button>
  )
}
```

- [ ] **Step 2: Write TimelineScreen**

```typescript
// frontend/src/screens/TimelineScreen.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'
import { BlockRow } from '../components/BlockRow'

function isoDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function TimelineScreen() {
  const [date, setDate] = useState(() => isoDateInput(new Date()))
  const queryClient = useQueryClient()

  const start = new Date(date + 'T00:00:00').toISOString()
  const end = new Date(date + 'T23:59:59.999').toISOString()

  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(start, end),
    queryFn: () => api.listActivityBlocksForRange(start, end),
  })
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })

  const [assigningBlockId, setAssigningBlockId] = useState<number | null>(null)

  const assignMutation = useMutation({
    mutationFn: ({ id, taskId }: { id: number; taskId: number | null }) =>
      api.updateActivityBlockAssignment(id, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityBlocks'] })
      setAssigningBlockId(null)
    },
  })

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-pill bg-surface-container px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-2 overflow-auto">
        {blocks.map((block, i) => {
          const durationMs = new Date(block.EndTime).getTime() - new Date(block.StartTime).getTime()
          const durationLabel = `${Math.round(durationMs / 60000)}m`
          return (
            <BlockRow
              key={i}
              block={block}
              durationLabel={durationLabel}
              onClick={() => setAssigningBlockId(i)}
            />
          )
        })}
      </div>

      {assigningBlockId !== null && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-lg bg-surface-container-high p-4">
            <p className="mb-2 text-sm text-on-surface-variant">Assign to project</p>
            {projects.map((p) => (
              <TaskPicker
                key={p.ID}
                projectId={p.ID}
                projectName={p.Name}
                onPick={(taskId) => {
                  const block = blocks[assigningBlockId] as unknown as { ID: number }
                  assignMutation.mutate({ id: block.ID, taskId })
                }}
              />
            ))}
            <button
              onClick={() => setAssigningBlockId(null)}
              className="mt-2 w-full rounded-pill bg-surface-container px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskPicker({
  projectId,
  projectName,
  onPick,
}: {
  projectId: number
  projectName: string
  onPick: (taskId: number) => void
}) {
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasksByProject(projectId),
    queryFn: () => api.listTasksByProject(projectId),
  })
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold uppercase text-on-surface-variant">{projectName}</p>
      {tasks.map((t) => (
        <button
          key={t.ID}
          onClick={() => onPick(t.ID)}
          className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-surface-container"
        >
          {t.Name}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Manually verify**

Run: `wails dev -tags webkit2_41`, navigate to Timeline.
Expected: date picker defaults to today; blocks list for the selected date; an unassigned block renders in the `error`-tinted style; clicking a block opens the assign dialog, picking a task closes the dialog and the row updates (no longer error-tinted).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/BlockRow.tsx frontend/src/screens/TimelineScreen.tsx
git commit -m "feat(frontend): build the Timeline screen with manual reassignment"
```

---

### Task 11: Projects screen

**Files:**
- Modify: `frontend/src/screens/ProjectsScreen.tsx`

**Interfaces:**
- Consumes: `api.listProjects`, `api.listTasksByProject`, `api.listActivityBlocksForRange` (for actual-time aggregation), Recharts

- [ ] **Step 1: Write ProjectsScreen with Estimate vs Actual bars**

```typescript
// frontend/src/screens/ProjectsScreen.tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'

function useActualMinutesForProject(projectId: number): number {
  const start = new Date(0).toISOString()
  const end = new Date().toISOString()
  const { data: blocks = [] } = useQuery({
    queryKey: queryKeys.activityBlocks(start, end),
    queryFn: () => api.listActivityBlocksForRange(start, end),
  })
  return blocks
    .filter((b) => (b as unknown as { ProjectID?: number }).ProjectID === projectId)
    .reduce((sum, b) => sum + (new Date(b.EndTime).getTime() - new Date(b.StartTime).getTime()) / 60000, 0)
}

function ProjectCard({ project }: { project: { ID: number; Name: string; EstimateMinutes?: number } }) {
  const actual = useActualMinutesForProject(project.ID)
  const estimate = project.EstimateMinutes ?? 0
  const pct = estimate > 0 ? Math.min(100, Math.round((actual / estimate) * 100)) : 0

  return (
    <div className="rounded-lg bg-surface-container p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium">{project.Name}</p>
        <p className="text-sm text-on-surface-variant">
          {Math.round(actual)}m{estimate > 0 ? ` / ${estimate}m` : ''}
        </p>
      </div>
      {estimate > 0 && (
        <div className="h-2 overflow-hidden rounded-pill bg-surface-container-high">
          <div
            className={`h-full rounded-pill ${pct > 100 ? 'bg-error' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function ProjectsScreen() {
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })
  const [selected, setSelected] = useState<number | null>(null)
  const { data: tasks = [] } = useQuery({
    queryKey: queryKeys.tasksByProject(selected ?? -1),
    queryFn: () => api.listTasksByProject(selected as number),
    enabled: selected !== null,
  })

  return (
    <div className="flex h-full gap-4 p-6">
      <div className="flex w-80 flex-col gap-2 overflow-auto">
        {projects.map((p) => (
          <div key={p.ID} onClick={() => setSelected(p.ID)} className="cursor-pointer">
            <ProjectCard project={p} />
          </div>
        ))}
      </div>
      {selected !== null && (
        <div className="flex-1 overflow-auto">
          <p className="mb-2 text-sm text-on-surface-variant">Tasks</p>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.ID} className="rounded-lg bg-surface-container p-3 text-sm">
                {t.Name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `wails dev -tags webkit2_41`, navigate to Projects, create a project + task with an estimate via devtools console if none exist yet (`window.go.main.App.CreateProject({Name: 'x', Color: '', EstimateMinutes: 60})`), let some activity accumulate against it (set it as current task, wait past the AFK threshold or switch windows).
Expected: card shows actual/estimate minutes and a progress bar that goes red past 100%; clicking a project shows its task list on the right.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/ProjectsScreen.tsx
git commit -m "feat(frontend): build the Projects screen with estimate-vs-actual"
```

---

### Task 12: Rules screen

**Files:**
- Modify: `frontend/src/screens/RulesScreen.tsx`

**Interfaces:**
- Consumes: `api.listAssignmentRules`, `api.createAssignmentRule`, `api.updateAssignmentRule`, `api.deleteAssignmentRule`, `api.listProjects`

- [ ] **Step 1: Write RulesScreen**

```typescript
// frontend/src/screens/RulesScreen.tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { queryKeys } from '../lib/queryClient'

export function RulesScreen() {
  const queryClient = useQueryClient()
  const { data: rules = [] } = useQuery({
    queryKey: queryKeys.assignmentRules,
    queryFn: api.listAssignmentRules,
  })
  const { data: projects = [] } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  })

  const [pattern, setPattern] = useState('')
  const [projectId, setProjectId] = useState<number | null>(null)
  const [priority, setPriority] = useState(0)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.assignmentRules })

  const createMutation = useMutation({
    mutationFn: api.createAssignmentRule,
    onSuccess: () => {
      invalidate()
      setPattern('')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: api.deleteAssignmentRule,
    onSuccess: invalidate,
  })

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-col gap-2 overflow-auto">
        {rules.map((r) => (
          <div key={r.ID} className="flex items-center justify-between rounded-lg bg-surface-container p-3">
            <div>
              <p className="font-medium">{r.Pattern}</p>
              <p className="text-xs text-on-surface-variant">
                {r.PatternType} · priority {r.Priority}
              </p>
            </div>
            <button
              onClick={() => deleteMutation.mutate(r.ID)}
              className="rounded-pill bg-error/20 px-3 py-1 text-xs text-error"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 rounded-lg bg-surface-container p-3">
        <div className="flex-1">
          <label className="text-xs text-on-surface-variant">Pattern (app name substring)</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-on-surface-variant">Project</label>
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(Number(e.target.value))}
            className="rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
          >
            <option value="" disabled>
              Select
            </option>
            {projects.map((p) => (
              <option key={p.ID} value={p.ID}>
                {p.Name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-on-surface-variant">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-20 rounded-pill bg-surface-container-high px-3 py-1.5 text-sm"
          />
        </div>
        <button
          disabled={!pattern || projectId === null}
          onClick={() =>
            createMutation.mutate({
              ID: 0,
              PatternType: 'app_name',
              Pattern: pattern,
              ProjectID: projectId as number,
              TaskID: null,
              Priority: priority,
            })
          }
          className="rounded-pill bg-primary px-4 py-1.5 text-sm text-surface disabled:opacity-40"
        >
          Add rule
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `wails dev -tags webkit2_41`, navigate to Rules.
Expected: create a rule (e.g. pattern `firefox` → some project, priority 5), it appears in the list; delete it, it disappears; two rules with equal priority stay in a stable (creation) order across reloads, per the Review Focus item from Task 2.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/RulesScreen.tsx
git commit -m "feat(frontend): build the Rules screen"
```

---

### Task 13: Settings screen

**Files:**
- Modify: `frontend/src/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `api.getIdleDetectorTier`, `useUiStore` (nav style setting)

- [ ] **Step 1: Write SettingsScreen**

```typescript
// frontend/src/screens/SettingsScreen.tsx
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useUiStore, type NavStyle } from '../store/uiStore'

const TIER_LABELS: Record<string, string> = {
  wayland: 'Wayland (ext-idle-notify-v1)',
  evdev: 'Raw input devices (mouse + keyboard)',
  none: 'Unavailable — window tracking only, no AFK detection',
}

export function SettingsScreen() {
  const { navStyle, setNavStyle } = useUiStore()
  const { data: tier } = useQuery({
    queryKey: ['idleDetectorTier'],
    queryFn: async () => api.getIdleDetectorTier(),
  })

  return (
    <div className="flex flex-col gap-6 p-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Navigation style</h2>
        <div className="flex gap-2">
          {(['sidebar', 'tabs', 'palette'] as NavStyle[]).map((style) => (
            <button
              key={style}
              onClick={() => setNavStyle(style)}
              className={`rounded-pill px-4 py-1.5 text-sm ${
                navStyle === style ? 'bg-primary text-surface' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {style}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-on-surface-variant">Idle detection</h2>
        <div
          className={`rounded-lg p-3 text-sm ${
            tier === 'none' ? 'bg-error/10 text-error' : 'bg-surface-container'
          }`}
        >
          {tier ? TIER_LABELS[tier] ?? tier : 'Loading...'}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Manually verify**

Run: `wails dev -tags webkit2_41`, navigate to Settings.
Expected: navigation-style buttons switch the app's chrome live (same effect as the manual test in Task 8); idle detection section shows whichever tier `app.go`'s `resolveIdleDetector` actually resolved to on this run (check against the `wails dev` terminal's `wayland idle detector unavailable` / `evdev idle detector unavailable` log lines from Task 3 to confirm they match).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/SettingsScreen.tsx
git commit -m "feat(frontend): build the Settings screen"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section has a task — backend gaps (Tasks 1–2), live events (Task 4), matugen theme (Tasks 4, 6), frontend stack migration (Task 5), navigation shells (Task 8), Today radial hub (Task 9), Timeline/Projects/Rules/Settings (Tasks 10–13). Idle-detector-tier surfacing (spec's Settings bullet) is Task 3 + 13.
- **Type consistency:** `tracker.Rule` gains `ID` in Task 2 and every later reference (`api.ts`, `RulesScreen.tsx`) uses `r.ID`/`ID: 0` on create, consistently. `Runner.OnBlockSaved` (Task 4) is the only new cross-task Go interface point and its signature (`func(Block)`) is used identically in `runner.go` and `app.go`.
- **Review Focus coverage:** matugen-absent fallback → Task 4 Step 4 (`GetThemeCSS` returns `"", nil`) + Task 6 Step 3 (manual verification with the file removed). Unsorted block rendering → Task 10's `BlockRow` (`unsorted` check on `TaskID == null`) with manual verification. Split-outside-range → Task 1's `TestSplitActivityBlock_RejectsSplitOutsideRange`. Tied-priority ordering → Task 2's `TestListAssignmentRulesByPriority_StableOrderOnTies` plus Task 12's manual check. FK-safe rule deletion → Task 2's `DeleteAssignmentRule` only ever deletes by the rule's own id, never cascades; covered implicitly by `TestCreateUpdateDeleteAssignmentRule`.
