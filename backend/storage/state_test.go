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

func TestSetCurrentTask(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'chronly')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO tasks (id, project_id, name) VALUES (10, 1, 'write plan')`); err != nil {
		t.Fatal(err)
	}
	taskID := int64(10)

	if err := s.SetCurrentTask(&taskID); err != nil {
		t.Fatalf("SetCurrentTask: %v", err)
	}
	st, err := s.GetAppState()
	if err != nil {
		t.Fatal(err)
	}
	if st.CurrentTaskID == nil || *st.CurrentTaskID != 10 {
		t.Fatalf("expected current task 10, got %+v", st.CurrentTaskID)
	}

	if err := s.SetCurrentTask(nil); err != nil {
		t.Fatalf("SetCurrentTask(nil): %v", err)
	}
	st, err = s.GetAppState()
	if err != nil {
		t.Fatal(err)
	}
	if st.CurrentTaskID != nil {
		t.Fatalf("expected current task to be cleared, got %+v", st.CurrentTaskID)
	}
}

func TestSetTrackingPaused(t *testing.T) {
	s := newTestStore(t)

	if err := s.SetTrackingPaused(true); err != nil {
		t.Fatalf("SetTrackingPaused(true): %v", err)
	}
	st, err := s.GetAppState()
	if err != nil {
		t.Fatal(err)
	}
	if !st.TrackingPaused {
		t.Fatal("expected tracking to be paused")
	}

	if err := s.SetTrackingPaused(false); err != nil {
		t.Fatalf("SetTrackingPaused(false): %v", err)
	}
	st, err = s.GetAppState()
	if err != nil {
		t.Fatal(err)
	}
	if st.TrackingPaused {
		t.Fatal("expected tracking to be unpaused")
	}
}
