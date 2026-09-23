package main

import (
	"context"

	"chronly/backend/tracker"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func emitBlockClosed(ctx context.Context, block tracker.Block) {
	runtime.EventsEmit(ctx, "block:closed", block)
}

func emitStateChanged(ctx context.Context, state tracker.AppState) {
	runtime.EventsEmit(ctx, "state:changed", state)
}

func emitThemeChanged(ctx context.Context, css string) {
	runtime.EventsEmit(ctx, "theme:changed", css)
}
