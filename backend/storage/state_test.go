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
