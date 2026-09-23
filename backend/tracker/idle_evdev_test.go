package tracker

import (
	"testing"
	"time"
)

func TestActivityClock(t *testing.T) {
	fakeNow := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	c := newActivityClock()
	c.now = func() time.Time { return fakeNow }
	c.touch()

	if got := c.IdleDuration(); got != 0 {
		t.Fatalf("just touched, expected 0 idle, got %v", got)
	}

	fakeNow = fakeNow.Add(5 * time.Minute)
	if got := c.IdleDuration(); got != 5*time.Minute {
		t.Fatalf("expected 5m idle, got %v", got)
	}

	c.touch()
	if got := c.IdleDuration(); got != 0 {
		t.Fatalf("after touch, expected 0 idle, got %v", got)
	}
}
