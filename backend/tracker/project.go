package tracker

import "time"

type Project struct {
	ID              int64
	Name            string
	Color           string
	EstimateMinutes *int
	Archived        bool
	CreatedAt       time.Time
}
