package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"chronly/backend/storage"
	"chronly/backend/tracker"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	afkThreshold      = 3 * time.Minute
	waylandIdleMillis = 60000
)

type App struct {
	ctx    context.Context
	store  *storage.Store
	cancel context.CancelFunc
	tray   *Tray
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	path, err := resolveDBPath()
	if err != nil {
		log.Fatalf("resolve db path: %v", err)
	}
	store, err := storage.Open(path)
	if err != nil {
		log.Fatalf("open storage: %v", err)
	}
	a.store = store

	runCtx, cancel := context.WithCancel(ctx)
	a.cancel = cancel

	idle, idleRun := a.resolveIdleDetector(runCtx)
	if idleRun != nil {
		go func() {
			if err := idleRun(); err != nil {
				log.Printf("idle detector stopped: %v", err)
			}
		}()
	}

	windowTracker := tracker.NewHyprlandTracker()
	runner := tracker.NewRunner(windowTracker, idle, afkThreshold, store, store, store)
	go func() {
		if err := runner.Run(runCtx); err != nil {
			log.Printf("runner stopped: %v", err)
		}
	}()

	a.tray = newTray(a)
	go a.tray.run()
}

func (a *App) shutdown(ctx context.Context) {
	if a.cancel != nil {
		a.cancel()
	}
	if a.store != nil {
		a.store.Close()
	}
	systray.Quit()
}

func (a *App) beforeClose(ctx context.Context) bool {
	runtime.WindowHide(ctx)
	return true
}

func (a *App) resolveIdleDetector(ctx context.Context) (tracker.IdleDetector, func() error) {
	if detector, run, err := tracker.NewWaylandIdleDetector(ctx, waylandIdleMillis); err == nil {
		return detector, run
	} else {
		log.Printf("wayland idle detector unavailable: %v", err)
	}

	if detector, run, err := tracker.NewEvdevIdleDetector(ctx); err == nil {
		return detector, run
	} else {
		log.Printf("evdev idle detector unavailable: %v", err)
	}

	choice, err := runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "Idle detection unavailable",
		Message:       "chronly couldn't set up AFK detection (tried Wayland idle-notify and raw input devices). Continue tracking windows only, without AFK detection?",
		Buttons:       []string{"Continue", "Quit"},
		DefaultButton: "Continue",
		CancelButton:  "Quit",
	})
	if err != nil || choice != "Continue" {
		runtime.Quit(a.ctx)
	}

	return noopIdleDetector{}, nil
}

type noopIdleDetector struct{}

func (noopIdleDetector) IdleDuration() time.Duration { return 0 }

func resolveDBPath() (string, error) {
	if p := os.Getenv("CHRONLY_DB_PATH"); p != "" {
		return p, nil
	}
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("resolve user config dir: %w", err)
	}
	dir := filepath.Join(configDir, "chronly")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create config dir: %w", err)
	}
	return filepath.Join(dir, "chronly.db"), nil
}

func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
