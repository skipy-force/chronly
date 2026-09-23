package storage

import (
	"testing"

	"chronly/backend/tracker"
)

func TestCreateAndGetProject(t *testing.T) {
	s := newTestStore(t)
	estimate := 120

	id, err := s.CreateProject(tracker.Project{Name: "chronly", Color: "#ff0000", EstimateMinutes: &estimate})
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	got, err := s.GetProject(id)
	if err != nil {
		t.Fatalf("GetProject: %v", err)
	}
	if got.Name != "chronly" || got.Color != "#ff0000" {
		t.Fatalf("unexpected project: %+v", got)
	}
	if got.EstimateMinutes == nil || *got.EstimateMinutes != 120 {
		t.Fatalf("expected estimate 120, got %+v", got.EstimateMinutes)
	}
	if got.Archived {
		t.Fatalf("expected new project to not be archived")
	}
}

func TestListProjects_ExcludesArchived(t *testing.T) {
	s := newTestStore(t)
	activeID, err := s.CreateProject(tracker.Project{Name: "active"})
	if err != nil {
		t.Fatal(err)
	}
	archivedID, err := s.CreateProject(tracker.Project{Name: "archived"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ArchiveProject(archivedID); err != nil {
		t.Fatalf("ArchiveProject: %v", err)
	}

	projects, err := s.ListProjects()
	if err != nil {
		t.Fatalf("ListProjects: %v", err)
	}
	if len(projects) != 1 || projects[0].ID != activeID {
		t.Fatalf("expected only active project, got %+v", projects)
	}

	archived, err := s.ListArchivedProjects()
	if err != nil {
		t.Fatalf("ListArchivedProjects: %v", err)
	}
	if len(archived) != 1 || archived[0].ID != archivedID {
		t.Fatalf("expected only archived project, got %+v", archived)
	}
}

func TestArchiveProject_Unarchive(t *testing.T) {
	s := newTestStore(t)
	id, err := s.CreateProject(tracker.Project{Name: "p"})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ArchiveProject(id); err != nil {
		t.Fatalf("ArchiveProject: %v", err)
	}
	got, err := s.GetProject(id)
	if err != nil {
		t.Fatal(err)
	}
	if !got.Archived {
		t.Fatalf("expected project to be archived")
	}

	if err := s.UnarchiveProject(id); err != nil {
		t.Fatalf("UnarchiveProject: %v", err)
	}
	got, err = s.GetProject(id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Archived {
		t.Fatalf("expected project to be unarchived")
	}
}

func TestUpdateProject(t *testing.T) {
	s := newTestStore(t)
	id, err := s.CreateProject(tracker.Project{Name: "old", Color: "#000000"})
	if err != nil {
		t.Fatal(err)
	}
	estimate := 30

	if err := s.UpdateProject(tracker.Project{ID: id, Name: "new", Color: "#ffffff", EstimateMinutes: &estimate}); err != nil {
		t.Fatalf("UpdateProject: %v", err)
	}

	got, err := s.GetProject(id)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "new" || got.Color != "#ffffff" {
		t.Fatalf("unexpected project after update: %+v", got)
	}
	if got.EstimateMinutes == nil || *got.EstimateMinutes != 30 {
		t.Fatalf("expected estimate 30, got %+v", got.EstimateMinutes)
	}
}
