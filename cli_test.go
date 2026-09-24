package main

import (
	"testing"
	"time"

	"chronly/backend/tracker"
)

func TestBuildStatusOutput_FreshStatusReportsRunning(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 10, 0, time.UTC)
	status := tracker.LiveStatus{
		AppName:     "kitty",
		WindowTitle: "~/chronly",
		BlockStart:  now.Add(-90 * time.Second),
		UpdatedAt:   now.Add(-1 * time.Second),
		Paused:      false,
	}

	out := buildStatusOutput(status, now)

	if !out.Running {
		t.Fatal("expected Running=true for a recently updated status")
	}
	if out.AppName != "kitty" || out.WindowTitle != "~/chronly" {
		t.Fatalf("unexpected app/title: %+v", out)
	}
	if out.ElapsedSeconds != 90 {
		t.Fatalf("expected ElapsedSeconds=90, got %d", out.ElapsedSeconds)
	}
	if out.Paused {
		t.Fatal("expected Paused=false")
	}
}

func TestBuildStatusOutput_StaleStatusReportsNotRunning(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	status := tracker.LiveStatus{
		AppName:    "kitty",
		BlockStart: now.Add(-5 * time.Minute),
		UpdatedAt:  now.Add(-30 * time.Second),
	}

	out := buildStatusOutput(status, now)

	if out.Running {
		t.Fatal("expected Running=false when UpdatedAt is older than the stale threshold")
	}
	if out.AppName != "" || out.ElapsedSeconds != 0 {
		t.Fatalf("expected no app/elapsed data when not running, got %+v", out)
	}
}

func TestBuildStatusOutput_NeverUpdatedReportsNotRunning(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

	out := buildStatusOutput(tracker.LiveStatus{}, now)

	if out.Running {
		t.Fatal("expected Running=false when the app has never written a live status")
	}
}

func TestBuildStatusOutput_ReportsPausedRegardlessOfRunning(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	status := tracker.LiveStatus{Paused: true, UpdatedAt: now.Add(-30 * time.Second)}

	out := buildStatusOutput(status, now)

	if !out.Paused {
		t.Fatal("expected Paused to reflect the persisted flag even when not running")
	}
}
