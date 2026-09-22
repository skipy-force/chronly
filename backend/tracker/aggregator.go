package tracker

import "time"

type Sample struct {
	Window WindowInfo
	Idle   time.Duration
	At     time.Time
}

type Block struct {
	StartTime   time.Time
	EndTime     time.Time
	AppName     string
	WindowTitle string
}

type Aggregator struct {
	afkThreshold time.Duration
	open         *Block
}

func NewAggregator(afkThreshold time.Duration) *Aggregator {
	return &Aggregator{afkThreshold: afkThreshold}
}

func (a *Aggregator) Add(s Sample) (closed Block, ok bool) {
	if s.Idle >= a.afkThreshold {
		return a.closeOpen()
	}

	if a.open == nil {
		a.open = &Block{
			StartTime:   s.At,
			EndTime:     s.At,
			AppName:     s.Window.AppName,
			WindowTitle: s.Window.WindowTitle,
		}
		return Block{}, false
	}

	if a.open.AppName != s.Window.AppName || a.open.WindowTitle != s.Window.WindowTitle {
		closed, ok = a.closeOpen()
		a.open = &Block{
			StartTime:   s.At,
			EndTime:     s.At,
			AppName:     s.Window.AppName,
			WindowTitle: s.Window.WindowTitle,
		}
		return closed, ok
	}

	a.open.EndTime = s.At
	return Block{}, false
}

func (a *Aggregator) closeOpen() (Block, bool) {
	if a.open == nil {
		return Block{}, false
	}
	b := *a.open
	a.open = nil
	return b, true
}
