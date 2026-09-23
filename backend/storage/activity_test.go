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

func TestListActivityBlocksForRange_NonUTCSaveMatchesUTCQuery(t *testing.T) {
	s := newTestStore(t)
	moscow := time.FixedZone("MSK", 3*60*60)
	// 00:30 MSK on Jan 2 is 21:30 UTC on Jan 1 — a different calendar day in
	// each zone. A query for the UTC day "Jan 1" must still find it, even
	// though its local-zone wall-clock date is "Jan 2".
	localStart := time.Date(2026, 1, 2, 0, 30, 0, 0, moscow)

	if _, err := s.SaveActivityBlock(
		tracker.Block{StartTime: localStart, EndTime: localStart.Add(time.Minute), AppName: "code", WindowTitle: "x"},
		tracker.Assignment{},
	); err != nil {
		t.Fatal(err)
	}

	rangeStart := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	rangeEnd := time.Date(2026, 1, 2, 0, 0, 0, 0, time.UTC)
	blocks, err := s.ListActivityBlocksForRange(rangeStart, rangeEnd)
	if err != nil {
		t.Fatalf("ListActivityBlocksForRange: %v", err)
	}
	if len(blocks) != 1 {
		t.Fatalf("expected the MSK-saved block (21:30 UTC Jan 1) to be found by a Jan-1-UTC query, got %d blocks: %+v", len(blocks), blocks)
	}
}

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

func TestListActivityBlocksForRange_IncludesIDAndAssignment(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO tasks (id, project_id, name) VALUES (10, 1, 't')`); err != nil {
		t.Fatal(err)
	}

	start := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	unassignedID, err := s.SaveActivityBlock(
		tracker.Block{StartTime: start, EndTime: start.Add(time.Minute), AppName: "code", WindowTitle: "x"},
		tracker.Assignment{},
	)
	if err != nil {
		t.Fatal(err)
	}
	taskID := int64(10)
	projectID := int64(1)
	assignedBy := "manual"
	assignedID, err := s.SaveActivityBlock(
		tracker.Block{StartTime: start.Add(time.Hour), EndTime: start.Add(time.Hour + time.Minute), AppName: "firefox", WindowTitle: "y"},
		tracker.Assignment{TaskID: &taskID, ProjectID: &projectID, AssignedBy: &assignedBy},
	)
	if err != nil {
		t.Fatal(err)
	}

	blocks, err := s.ListActivityBlocksForRange(start, start.Add(2*time.Hour))
	if err != nil {
		t.Fatalf("ListActivityBlocksForRange: %v", err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 blocks, got %+v", blocks)
	}
	if blocks[0].ID != unassignedID || blocks[0].TaskID != nil {
		t.Fatalf("expected first block id=%d with no task, got id=%d taskID=%v", unassignedID, blocks[0].ID, blocks[0].TaskID)
	}
	if blocks[1].ID != assignedID || blocks[1].TaskID == nil || *blocks[1].TaskID != 10 || blocks[1].ProjectID == nil || *blocks[1].ProjectID != 1 {
		t.Fatalf("expected second block id=%d with task=10 project=1, got %+v", assignedID, blocks[1])
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
