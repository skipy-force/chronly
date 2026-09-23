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
