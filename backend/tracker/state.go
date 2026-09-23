package tracker

type AppState struct {
	CurrentTaskID       *int64
	CurrentProjectID    *int64
	TrackingPaused      bool
	AFKThresholdMinutes int
}
