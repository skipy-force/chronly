package storage

import (
	"testing"
	"time"

	"chronly/backend/tracker"
)

func TestGetAppState_DefaultsToUnsetAndNotPaused(t *testing.T) {
	s := newTestStore(t)

	st, err := s.GetAppState()
	if err != nil {
		t.Fatalf("GetAppState: %v", err)
	}
	if st.CurrentTaskID != nil || st.TrackingPaused {
		t.Fatalf("expected fresh app_state row, got %+v", st)
	}
	if st.AFKThresholdMinutes != 3 {
		t.Fatalf("expected default AFK threshold of 3 minutes, got %d", st.AFKThresholdMinutes)
	}
}

func TestSetAFKThresholdMinutes(t *testing.T) {
	s := newTestStore(t)

	if err := s.SetAFKThresholdMinutes(10); err != nil {
		t.Fatalf("SetAFKThresholdMinutes: %v", err)
	}
	st, err := s.GetAppState()
	if err != nil {
		t.Fatal(err)
	}
	if st.AFKThresholdMinutes != 10 {
		t.Fatalf("expected AFK threshold 10, got %d", st.AFKThresholdMinutes)
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

func TestGetLiveStatus_DefaultsToEmptyBeforeAnyUpdate(t *testing.T) {
	s := newTestStore(t)

	status, err := s.GetLiveStatus()
	if err != nil {
		t.Fatalf("GetLiveStatus: %v", err)
	}
	if status.AppName != "" || !status.BlockStart.IsZero() || !status.UpdatedAt.IsZero() {
		t.Fatalf("expected a fresh empty live status, got %+v", status)
	}
}

func TestUpdateLiveStatus_RoundTripsThroughGetLiveStatus(t *testing.T) {
	s := newTestStore(t)
	blockStart := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	updatedAt := time.Date(2026, 1, 1, 12, 5, 0, 0, time.UTC)

	if err := s.UpdateLiveStatus(tracker.LiveStatus{
		AppName: "kitty", WindowTitle: "~/chronly", BlockStart: blockStart, UpdatedAt: updatedAt,
	}); err != nil {
		t.Fatalf("UpdateLiveStatus: %v", err)
	}

	status, err := s.GetLiveStatus()
	if err != nil {
		t.Fatalf("GetLiveStatus: %v", err)
	}
	if status.AppName != "kitty" || status.WindowTitle != "~/chronly" {
		t.Fatalf("unexpected app/title: %+v", status)
	}
	if !status.BlockStart.Equal(blockStart) || !status.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("unexpected timestamps: %+v", status)
	}
}

func TestUpdateLiveStatus_ReflectsCurrentPausedFlag(t *testing.T) {
	s := newTestStore(t)
	if err := s.SetTrackingPaused(true); err != nil {
		t.Fatal(err)
	}
	if err := s.UpdateLiveStatus(tracker.LiveStatus{AppName: "code", UpdatedAt: time.Now()}); err != nil {
		t.Fatalf("UpdateLiveStatus: %v", err)
	}

	status, err := s.GetLiveStatus()
	if err != nil {
		t.Fatalf("GetLiveStatus: %v", err)
	}
	if !status.Paused {
		t.Fatal("expected live status to reflect that tracking is paused")
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
