package tracker

import (
	"testing"
	"time"
)

func t0(seconds int) time.Time {
	return time.Date(2026, 1, 1, 12, 0, seconds, 0, time.UTC)
}

func TestAggregator_MergesConsecutiveSameWindow(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	win := WindowInfo{AppName: "code", WindowTitle: "main.go"}

	if _, ok := agg.Add(Sample{Window: win, At: t0(0)}); ok {
		t.Fatal("first sample should not close a block")
	}
	if _, ok := agg.Add(Sample{Window: win, At: t0(30)}); ok {
		t.Fatal("same window should not close a block")
	}
}

func TestAggregator_ClosesOnWindowChange(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	a := WindowInfo{AppName: "code", WindowTitle: "main.go"}
	b := WindowInfo{AppName: "firefox", WindowTitle: "docs"}

	agg.Add(Sample{Window: a, At: t0(0)})
	agg.Add(Sample{Window: a, At: t0(60)})

	closed, ok := agg.Add(Sample{Window: b, At: t0(65)})
	if !ok {
		t.Fatal("window change should close the previous block")
	}
	if closed.AppName != "code" || closed.StartTime != t0(0) || closed.EndTime != t0(60) {
		t.Fatalf("unexpected closed block: %+v", closed)
	}
}

func TestAggregator_ClosesOnAFK(t *testing.T) {
	agg := NewAggregator(3 * time.Minute)
	win := WindowInfo{AppName: "code", WindowTitle: "main.go"}

	agg.Add(Sample{Window: win, At: t0(0)})
	agg.Add(Sample{Window: win, At: t0(60)})

	closed, ok := agg.Add(Sample{Window: win, Idle: 4 * time.Minute, At: t0(300)})
	if !ok {
		t.Fatal("idle over threshold should close the open block")
	}
	if closed.StartTime != t0(0) || closed.EndTime != t0(60) {
		t.Fatalf("unexpected closed block: %+v", closed)
	}

	if _, ok := agg.Add(Sample{Window: win, At: t0(600)}); ok {
		t.Fatal("first sample after AFK should not immediately close anything")
	}
}
