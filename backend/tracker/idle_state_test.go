package tracker

import (
	"testing"
	"time"
)

func TestIdleState(t *testing.T) {
	fakeNow := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	s := newIdleState()
	s.now = func() time.Time { return fakeNow }

	if got := s.IdleDuration(); got != 0 {
		t.Fatalf("fresh idleState should report 0 idle, got %v", got)
	}

	s.markIdle()
	fakeNow = fakeNow.Add(5 * time.Minute)
	if got := s.IdleDuration(); got != 5*time.Minute {
		t.Fatalf("expected 5m idle, got %v", got)
	}

	s.markResumed()
	if got := s.IdleDuration(); got != 0 {
		t.Fatalf("after resume, expected 0 idle, got %v", got)
	}
}
