package tracker

import "time"

const (
	TaskStatusOpen     = "open"
	TaskStatusDone     = "done"
	TaskStatusArchived = "archived"
)

type Task struct {
	ID              int64
	ProjectID       int64
	Name            string
	EstimateMinutes *int
	Status          string
	CreatedAt       time.Time
}
