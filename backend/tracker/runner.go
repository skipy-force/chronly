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

type LiveStatusSink interface {
	UpdateLiveStatus(status LiveStatus) error
}

type Runner struct {
	tracker             WindowTracker
	idle                IdleDetector
	aggregator          *Aggregator
	rules               RuleSource
	state               StateSource
	sink                BlockSink
	statusSink          LiveStatusSink
	pollInterval        time.Duration
	maxSampleGap        time.Duration
	statusWriteInterval time.Duration
	lastProcessedAt     time.Time
	lastStatusWriteAt   time.Time
	OnBlockSaved        func(Block)
}

func NewRunner(
	t WindowTracker, idle IdleDetector, afkThreshold time.Duration,
	rules RuleSource, state StateSource, sink BlockSink, statusSink LiveStatusSink,
) *Runner {
	return &Runner{
		tracker:             t,
		idle:                idle,
		aggregator:          NewAggregator(afkThreshold),
		rules:               rules,
		state:               state,
		sink:                sink,
		statusSink:          statusSink,
		pollInterval:        time.Second,
		maxSampleGap:        10 * time.Second,
		statusWriteInterval: 2 * time.Second,
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
			if err := r.handleSample(last); err != nil {
				return err
			}
		case <-ticker.C:
			if err := r.handleSample(last); err != nil {
				return err
			}
		}
	}
}

func (r *Runner) handleSample(w WindowInfo) error {
	now := time.Now().UTC()
	if !r.lastProcessedAt.IsZero() && now.Sub(r.lastProcessedAt) > r.maxSampleGap {
		if err := r.flushStaleOpenBlock(); err != nil {
			return err
		}
	}
	r.lastProcessedAt = now
	return r.process(Sample{Window: w, Idle: r.idle.IdleDuration(), At: now})
}

func (r *Runner) flushStaleOpenBlock() error {
	block, ok := r.aggregator.CloseOpen()
	if !ok {
		return nil
	}
	state, err := r.state.GetAppState()
	if err != nil {
		return err
	}
	return r.saveClosedBlock(block, state)
}

func (r *Runner) process(s Sample) error {
	state, err := r.state.GetAppState()
	if err != nil {
		return err
	}

	if state.AFKThresholdMinutes > 0 {
		r.aggregator.SetThreshold(time.Duration(state.AFKThresholdMinutes) * time.Minute)
	}

	var block Block
	var ok bool
	if state.TrackingPaused {
		block, ok = r.aggregator.CloseOpen()
	} else {
		block, ok = r.aggregator.Add(s)
	}

	if err := r.writeLiveStatusIfDue(s.At, state); err != nil {
		return err
	}

	if !ok {
		return nil
	}

	return r.saveClosedBlock(block, state)
}

func (r *Runner) writeLiveStatusIfDue(now time.Time, state AppState) error {
	if !r.lastStatusWriteAt.IsZero() && now.Sub(r.lastStatusWriteAt) < r.statusWriteInterval {
		return nil
	}
	r.lastStatusWriteAt = now

	status := LiveStatus{Paused: state.TrackingPaused, UpdatedAt: now}
	if open, ok := r.aggregator.Peek(); ok {
		status.AppName = open.AppName
		status.WindowTitle = open.WindowTitle
		status.BlockStart = open.StartTime
	}
	return r.statusSink.UpdateLiveStatus(status)
}

func (r *Runner) saveClosedBlock(block Block, state AppState) error {
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
