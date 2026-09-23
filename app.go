package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"chronly/backend/storage"
	"chronly/backend/tracker"

	"github.com/energye/systray"
	"github.com/fsnotify/fsnotify"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	afkThreshold      = 3 * time.Minute
	waylandIdleMillis = 60000
	AppVersion        = "0.1.0-dev"
)

var openFileManager = func(dir string) error {
	return exec.Command("xdg-open", dir).Start()
}

type App struct {
	ctx              context.Context
	store            *storage.Store
	cancel           context.CancelFunc
	tray             *Tray
	idleDetectorTier string
	themeWatcher     *fsnotify.Watcher
	dbPath           string
	icons            *iconResolver
}

func NewApp() *App {
	return &App{icons: newIconResolver()}
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
	a.dbPath = path

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
	runner.OnBlockSaved = func(b tracker.Block) {
		emitBlockClosed(ctx, b)
	}
	go func() {
		if err := runner.Run(runCtx); err != nil {
			log.Printf("runner stopped: %v", err)
		}
	}()

	if err := a.watchTheme(runCtx); err != nil {
		log.Printf("theme watcher unavailable: %v", err)
	}

	a.tray = newTray(a)
	go a.tray.run()
}

func (a *App) shutdown(ctx context.Context) {
	if a.cancel != nil {
		a.cancel()
	}
	if a.themeWatcher != nil {
		a.themeWatcher.Close()
	}
	if a.store != nil {
		a.store.Close()
	}
	systray.Quit()
}

func (a *App) watchTheme(ctx context.Context) error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return err
	}
	a.themeWatcher = watcher

	path, err := themeCSSPath()
	if err != nil {
		return err
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := watcher.Add(dir); err != nil {
		return err
	}

	go func() {
		for {
			select {
			case <-ctx.Done():
				watcher.Close()
				return
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if filepath.Clean(event.Name) != filepath.Clean(path) {
					continue
				}
				css, err := a.GetThemeCSS()
				if err != nil {
					log.Printf("reload theme: %v", err)
					continue
				}
				emitThemeChanged(a.ctx, css)
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("theme watcher error: %v", err)
			}
		}
	}()
	return nil
}

func (a *App) GetThemeCSS() (string, error) {
	path, err := themeCSSPath()
	if err != nil {
		return "", err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func themeCSSPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".config", "colors", "matugen", "chronly.css"), nil
}

func (a *App) beforeClose(ctx context.Context) bool {
	runtime.WindowHide(ctx)
	return true
}

func (a *App) resolveIdleDetector(ctx context.Context) (tracker.IdleDetector, func() error) {
	if detector, run, err := tracker.NewWaylandIdleDetector(ctx, waylandIdleMillis); err == nil {
		a.idleDetectorTier = "wayland"
		return detector, run
	} else {
		log.Printf("wayland idle detector unavailable: %v", err)
	}

	if detector, run, err := tracker.NewEvdevIdleDetector(ctx); err == nil {
		a.idleDetectorTier = "evdev"
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

	a.idleDetectorTier = "none"
	return noopIdleDetector{}, nil
}

func (a *App) GetIdleDetectorTier() string {
	return a.idleDetectorTier
}

func (a *App) GetDBPath() string {
	return a.dbPath
}

func (a *App) GetAppVersion() string {
	return AppVersion
}

func (a *App) OpenDataFolder() error {
	return openFileManager(filepath.Dir(a.dbPath))
}

func (a *App) GetAppIcon(appName string) string {
	return a.icons.resolve(appName)
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
