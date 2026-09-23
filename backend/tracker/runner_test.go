package tracker

import (
	"context"
	"sync"
	"testing"
	"time"
)

type fakeTracker struct {
	events []WindowInfo
	delay  time.Duration
}

func (f *fakeTracker) Watch(ctx context.Context, updates chan<- WindowInfo) error {
	for _, e := range f.events {
		select {
		case updates <- e:
		case <-ctx.Done():
			return ctx.Err()
		}
		time.Sleep(f.delay)
	}
	<-ctx.Done()
	return ctx.Err()
}

type fakeIdle struct{ d time.Duration }

func (f *fakeIdle) IdleDuration() time.Duration { return f.d }

type fakeRules struct{ rules []Rule }

func (f *fakeRules) ListAssignmentRulesByPriority() ([]Rule, error) { return f.rules, nil }

type fakeState struct {
	mu    sync.Mutex
	state AppState
}

func (f *fakeState) GetAppState() (AppState, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.state, nil
}

func (f *fakeState) setPaused(paused bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.state.TrackingPaused = paused
}

type fakeSink struct{ saved []Block }

func (f *fakeSink) SaveActivityBlock(b Block, a Assignment) (int64, error) {
	f.saved = append(f.saved, b)
	return int64(len(f.saved)), nil
}

func TestRunner_PersistsClosedBlockOnWindowChange(t *testing.T) {
	tr := &fakeTracker{
		events: []WindowInfo{
			{AppName: "code", WindowTitle: "main.go"},
			{AppName: "firefox", WindowTitle: "docs"},
		},
		delay: 10 * time.Millisecond,
	}
	sink := &fakeSink{}
	r := NewRunner(tr, &fakeIdle{}, 3*time.Minute, &fakeRules{}, &fakeState{}, sink)
	r.pollInterval = 5 * time.Millisecond

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	r.Run(ctx)

	if len(sink.saved) != 1 {
		t.Fatalf("expected 1 saved block, got %d: %+v", len(sink.saved), sink.saved)
	}
	if sink.saved[0].AppName != "code" {
		t.Fatalf("expected first block to be 'code', got %+v", sink.saved[0])
	}
}

func TestRunner_PauseClosesOpenBlockAndSkipsAggregation(t *testing.T) {
	tr := &fakeTracker{
		events: []WindowInfo{
			{AppName: "code", WindowTitle: "main.go"},
		},
		delay: 200 * time.Millisecond,
	}
	sink := &fakeSink{}
	state := &fakeState{}
	r := NewRunner(tr, &fakeIdle{}, 3*time.Minute, &fakeRules{}, state, sink)
	r.pollInterval = 5 * time.Millisecond

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	go func() {
		time.Sleep(30 * time.Millisecond)
		state.setPaused(true)
	}()

	r.Run(ctx)

	if len(sink.saved) != 1 {
		t.Fatalf("expected exactly 1 saved block from pause-close, got %d: %+v", len(sink.saved), sink.saved)
	}
	if sink.saved[0].AppName != "code" {
		t.Fatalf("expected the paused block to be 'code', got %+v", sink.saved[0])
	}
}

func TestRunner_CallsOnBlockSavedWhenBlockCloses(t *testing.T) {
	tr := &fakeTracker{
		events: []WindowInfo{
			{AppName: "code", WindowTitle: "main.go"},
			{AppName: "firefox", WindowTitle: "docs"},
		},
		delay: 10 * time.Millisecond,
	}
	sink := &fakeSink{}
	r := NewRunner(tr, &fakeIdle{}, 3*time.Minute, &fakeRules{}, &fakeState{}, sink)
	r.pollInterval = 5 * time.Millisecond

	var saved []Block
	var mu sync.Mutex
	r.OnBlockSaved = func(b Block) {
		mu.Lock()
		defer mu.Unlock()
		saved = append(saved, b)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()
	r.Run(ctx)

	mu.Lock()
	defer mu.Unlock()
	if len(saved) != 1 || saved[0].AppName != "code" {
		t.Fatalf("expected OnBlockSaved called once with the 'code' block, got %+v", saved)
	}
}
