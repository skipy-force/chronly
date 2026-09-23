package tracker

import (
	"context"
	"time"
)

type RuleSource interface {
	ListAssignmentRulesByPriority() ([]Rule, error)
}

type StateSource interface {
	GetAppState() (AppState, error)
}

type BlockSink interface {
	SaveActivityBlock(b Block, a Assignment) (int64, error)
}

type Runner struct {
	tracker      WindowTracker
	idle         IdleDetector
	aggregator   *Aggregator
	rules        RuleSource
	state        StateSource
	sink         BlockSink
	pollInterval time.Duration
	OnBlockSaved func(Block)
}

func NewRunner(t WindowTracker, idle IdleDetector, afkThreshold time.Duration, rules RuleSource, state StateSource, sink BlockSink) *Runner {
	return &Runner{
		tracker:      t,
		idle:         idle,
		aggregator:   NewAggregator(afkThreshold),
		rules:        rules,
		state:        state,
		sink:         sink,
		pollInterval: time.Second,
	}
}

func (r *Runner) Run(ctx context.Context) error {
	updates := make(chan WindowInfo)
	trackerErr := make(chan error, 1)
	go func() { trackerErr <- r.tracker.Watch(ctx, updates) }()

	ticker := time.NewTicker(r.pollInterval)
	defer ticker.Stop()

	var last WindowInfo
	for {
		select {
		case <-ctx.Done():
			return nil
		case err := <-trackerErr:
			return err
		case last = <-updates:
			if err := r.process(Sample{Window: last, Idle: r.idle.IdleDuration(), At: time.Now()}); err != nil {
				return err
			}
		case <-ticker.C:
			if err := r.process(Sample{Window: last, Idle: r.idle.IdleDuration(), At: time.Now()}); err != nil {
				return err
			}
		}
	}
}

func (r *Runner) process(s Sample) error {
	state, err := r.state.GetAppState()
	if err != nil {
		return err
	}

	var block Block
	var ok bool
	if state.TrackingPaused {
		block, ok = r.aggregator.CloseOpen()
	} else {
		block, ok = r.aggregator.Add(s)
	}
	if !ok {
		return nil
	}

	rules, err := r.rules.ListAssignmentRulesByPriority()
	if err != nil {
		return err
	}

	assignment := Resolve(block, state.CurrentTaskID, state.CurrentProjectID, rules)
	if _, err := r.sink.SaveActivityBlock(block, assignment); err != nil {
		return err
	}
	if r.OnBlockSaved != nil {
		r.OnBlockSaved(block)
	}
	return nil
}
