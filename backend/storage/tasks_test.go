package storage

import (
	"testing"

	"chronly/backend/tracker"
)

func mustCreateProject(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	id, err := s.CreateProject(tracker.Project{Name: name})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	return id
}

func TestCreateAndGetTask(t *testing.T) {
	s := newTestStore(t)
	projectID := mustCreateProject(t, s, "chronly")
	estimate := 45

	id, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "write plan", EstimateMinutes: &estimate})
	if err != nil {
		t.Fatalf("CreateTask: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	got, err := s.GetTask(id)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if got.ProjectID != projectID || got.Name != "write plan" {
		t.Fatalf("unexpected task: %+v", got)
	}
	if got.EstimateMinutes == nil || *got.EstimateMinutes != 45 {
		t.Fatalf("expected estimate 45, got %+v", got.EstimateMinutes)
	}
	if got.Status != tracker.TaskStatusOpen {
		t.Fatalf("expected default status open, got %q", got.Status)
	}
}

func TestListTasksByProject_OnlyOpen(t *testing.T) {
	s := newTestStore(t)
	projectID := mustCreateProject(t, s, "chronly")

	openID, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "open task"})
	if err != nil {
		t.Fatal(err)
	}
	doneID, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "done task"})
	if err != nil {
		t.Fatal(err)
	}
	archivedID, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "archived task"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetTaskStatus(doneID, tracker.TaskStatusDone); err != nil {
		t.Fatalf("SetTaskStatus done: %v", err)
	}
	if err := s.SetTaskStatus(archivedID, tracker.TaskStatusArchived); err != nil {
		t.Fatalf("SetTaskStatus archived: %v", err)
	}

	open, err := s.ListTasksByProject(projectID)
	if err != nil {
		t.Fatalf("ListTasksByProject: %v", err)
	}
	if len(open) != 1 || open[0].ID != openID {
		t.Fatalf("expected only open task, got %+v", open)
	}

	done, err := s.ListDoneTasksByProject(projectID)
	if err != nil {
		t.Fatalf("ListDoneTasksByProject: %v", err)
	}
	if len(done) != 1 || done[0].ID != doneID {
		t.Fatalf("expected only done task, got %+v", done)
	}

	archived, err := s.ListArchivedTasksByProject(projectID)
	if err != nil {
		t.Fatalf("ListArchivedTasksByProject: %v", err)
	}
	if len(archived) != 1 || archived[0].ID != archivedID {
		t.Fatalf("expected only archived task, got %+v", archived)
	}
}

func TestUpdateTask(t *testing.T) {
	s := newTestStore(t)
	projectID := mustCreateProject(t, s, "chronly")
	id, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "old"})
	if err != nil {
		t.Fatal(err)
	}
	estimate := 15

	if err := s.UpdateTask(tracker.Task{ID: id, Name: "new", EstimateMinutes: &estimate}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	got, err := s.GetTask(id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "new" {
		t.Fatalf("unexpected task after update: %+v", got)
	}
	if got.EstimateMinutes == nil || *got.EstimateMinutes != 15 {
		t.Fatalf("expected estimate 15, got %+v", got.EstimateMinutes)
	}
}

func TestUpdateTask_PreservesStatus(t *testing.T) {
	s := newTestStore(t)
	projectID := mustCreateProject(t, s, "chronly")
	id, err := s.CreateTask(tracker.Task{ProjectID: projectID, Name: "task"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.SetTaskStatus(id, tracker.TaskStatusDone); err != nil {
		t.Fatal(err)
	}

	if err := s.UpdateTask(tracker.Task{ID: id, Name: "renamed"}); err != nil {
		t.Fatalf("UpdateTask: %v", err)
	}

	got, err := s.GetTask(id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != tracker.TaskStatusDone {
		t.Fatalf("expected status to stay done, got %q", got.Status)
	}
}
