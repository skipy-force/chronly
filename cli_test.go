package main

import (
	"strings"
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

func TestFormatElapsed_MinutesOnlyUnderAnHour(t *testing.T) {
	if got := formatElapsed(305); got != "5m" {
		t.Fatalf("formatElapsed(305) = %q, want %q", got, "5m")
	}
}

func TestFormatElapsed_HoursAndMinutesOverAnHour(t *testing.T) {
	if got := formatElapsed(3725); got != "1h02m" {
		t.Fatalf("formatElapsed(3725) = %q, want %q", got, "1h02m")
	}
}

func TestHumanStatus_NotRunning(t *testing.T) {
	got := humanStatus(statusOutput{Running: false})
	if !strings.Contains(got, "not running") {
		t.Fatalf("expected a not-running message, got %q", got)
	}
}

func TestHumanStatus_RunningShowsAppAndElapsed(t *testing.T) {
	got := humanStatus(statusOutput{Running: true, AppName: "kitty", ElapsedSeconds: 305})
	if !strings.Contains(got, "kitty") || !strings.Contains(got, "5m") {
		t.Fatalf("expected app name and elapsed time in output, got %q", got)
	}
}

func TestHumanStatus_PausedIsFlaggedEvenWhileRunning(t *testing.T) {
	got := humanStatus(statusOutput{Running: true, Paused: true, AppName: "kitty", ElapsedSeconds: 60})
	if !strings.Contains(strings.ToLower(got), "paused") {
		t.Fatalf("expected paused state to be visible, got %q", got)
	}
}

func TestTopAppsFromBlocks_SumsDurationPerApp(t *testing.T) {
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	blocks := []tracker.Block{
		{AppName: "kitty", StartTime: start, EndTime: start.Add(10 * time.Minute)},
		{AppName: "kitty", StartTime: start.Add(10 * time.Minute), EndTime: start.Add(15 * time.Minute)},
		{AppName: "firefox", StartTime: start, EndTime: start.Add(5 * time.Minute)},
	}

	got := topAppsFromBlocks(blocks, 3)

	if len(got) != 2 {
		t.Fatalf("expected 2 apps, got %+v", got)
	}
	if got[0].AppName != "kitty" || got[0].Minutes != 15 {
		t.Fatalf("expected kitty=15m first, got %+v", got[0])
	}
	if got[1].AppName != "firefox" || got[1].Minutes != 5 {
		t.Fatalf("expected firefox=5m second, got %+v", got[1])
	}
}

func TestTopAppsFromBlocks_TruncatesToLimit(t *testing.T) {
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	blocks := []tracker.Block{
		{AppName: "a", StartTime: start, EndTime: start.Add(40 * time.Minute)},
		{AppName: "b", StartTime: start, EndTime: start.Add(30 * time.Minute)},
		{AppName: "c", StartTime: start, EndTime: start.Add(20 * time.Minute)},
		{AppName: "d", StartTime: start, EndTime: start.Add(10 * time.Minute)},
	}

	got := topAppsFromBlocks(blocks, 3)

	if len(got) != 3 {
		t.Fatalf("expected 3 apps after truncation, got %+v", got)
	}
	if got[0].AppName != "a" || got[1].AppName != "b" || got[2].AppName != "c" {
		t.Fatalf("expected [a,b,c] in order, got %+v", got)
	}
}

func TestTopAppsFromBlocks_IgnoresEmptyAppName(t *testing.T) {
	start := time.Date(2026, 1, 1, 9, 0, 0, 0, time.UTC)
	blocks := []tracker.Block{
		{AppName: "", StartTime: start, EndTime: start.Add(40 * time.Minute)},
		{AppName: "kitty", StartTime: start, EndTime: start.Add(5 * time.Minute)},
	}

	got := topAppsFromBlocks(blocks, 3)

	if len(got) != 1 || got[0].AppName != "kitty" {
		t.Fatalf("expected only kitty, got %+v", got)
	}
}

func TestTopAppsFromBlocks_EmptyInputReturnsEmpty(t *testing.T) {
	got := topAppsFromBlocks(nil, 3)
	if len(got) != 0 {
		t.Fatalf("expected empty result, got %+v", got)
	}
}

func TestUsageText_MentionsStatusCommand(t *testing.T) {
	if got := usageText(); !strings.Contains(got, "status") {
		t.Fatalf("expected usage text to mention the status command, got %q", got)
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
