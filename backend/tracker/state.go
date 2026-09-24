package tracker

import "time"

type AppState struct {
	CurrentTaskID       *int64
	CurrentProjectID    *int64
	TrackingPaused      bool
	AFKThresholdMinutes int
}

type LiveStatus struct {
	AppName     string
	WindowTitle string
	BlockStart  time.Time
	UpdatedAt   time.Time
	Paused      bool
}
