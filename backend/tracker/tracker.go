package tracker

import "context"

type WindowInfo struct {
	AppName     string
	WindowTitle string
}

type WindowTracker interface {
	Watch(ctx context.Context, updates chan<- WindowInfo) error
}
