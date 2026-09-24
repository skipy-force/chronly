package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"time"

	"chronly/backend/storage"
	"chronly/backend/tracker"

	"github.com/mattn/go-isatty"
)

const liveStatusStaleAfter = 10 * time.Second

type appMinutes struct {
	AppName string `json:"app_name"`
	Minutes int    `json:"minutes"`
}

type statusOutput struct {
	Running        bool         `json:"running"`
	Paused         bool         `json:"paused"`
	AppName        string       `json:"app_name"`
	WindowTitle    string       `json:"window_title"`
	ElapsedSeconds int          `json:"elapsed_seconds"`
	TopAppsToday   []appMinutes `json:"top_apps_today"`
}

func topAppsFromBlocks(blocks []tracker.Block, limit int) []appMinutes {
	totals := map[string]time.Duration{}
	for _, b := range blocks {
		if b.AppName == "" {
			continue
		}
		totals[b.AppName] += b.EndTime.Sub(b.StartTime)
	}

	list := make([]appMinutes, 0, len(totals))
	for name, d := range totals {
		list = append(list, appMinutes{AppName: name, Minutes: int(d.Minutes())})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Minutes != list[j].Minutes {
			return list[i].Minutes > list[j].Minutes
		}
		return list[i].AppName < list[j].AppName
	})
	if len(list) > limit {
		list = list[:limit]
	}
	return list
}

func buildStatusOutput(status tracker.LiveStatus, now time.Time) statusOutput {
	out := statusOutput{Paused: status.Paused}
	if status.UpdatedAt.IsZero() || now.Sub(status.UpdatedAt) > liveStatusStaleAfter {
		return out
	}

	out.Running = true
	out.AppName = status.AppName
	out.WindowTitle = status.WindowTitle
	if !status.BlockStart.IsZero() {
		if elapsed := now.Sub(status.BlockStart); elapsed > 0 {
			out.ElapsedSeconds = int(elapsed.Seconds())
		}
	}
	return out
}

func formatElapsed(seconds int) string {
	d := time.Duration(seconds) * time.Second
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh%02dm", h, m)
	}
	return fmt.Sprintf("%dm", m)
}

func humanStatus(out statusOutput) string {
	if !out.Running {
		if out.Paused {
			return "chronly: paused, not running\n"
		}
		return "chronly: not running\n"
	}

	appName := out.AppName
	if appName == "" {
		appName = "no active window"
	}
	line := fmt.Sprintf("%s · %s\n", appName, formatElapsed(out.ElapsedSeconds))
	if out.Paused {
		line = "⏸ paused — " + line
	}
	return line
}

func runStatusCommand(args []string) int {
	forceJSON := false
	for _, a := range args {
		if a == "--json" {
			forceJSON = true
		}
	}

	path, err := resolveDBPath()
	if err != nil {
		fmt.Fprintln(os.Stderr, "resolve db path:", err)
		return 1
	}

	store, err := storage.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open storage:", err)
		return 1
	}
	defer store.Close()

	status, err := store.GetLiveStatus()
	if err != nil {
		fmt.Fprintln(os.Stderr, "get live status:", err)
		return 1
	}

	now := time.Now()
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	todayBlocks, err := store.ListActivityBlocksForRange(dayStart.UTC(), dayStart.Add(24*time.Hour).UTC())
	if err != nil {
		fmt.Fprintln(os.Stderr, "list today's blocks:", err)
		return 1
	}

	out := buildStatusOutput(status, now.UTC())
	out.TopAppsToday = topAppsFromBlocks(todayBlocks, 3)

	if !forceJSON && isatty.IsTerminal(os.Stdout.Fd()) {
		fmt.Print(humanStatus(out))
		return 0
	}

	data, err := json.Marshal(out)
	if err != nil {
		fmt.Fprintln(os.Stderr, "marshal status:", err)
		return 1
	}
	fmt.Println(string(data))
	return 0
}

func runTogglePauseCommand() int {
	path, err := resolveDBPath()
	if err != nil {
		fmt.Fprintln(os.Stderr, "resolve db path:", err)
		return 1
	}

	store, err := storage.Open(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "open storage:", err)
		return 1
	}
	defer store.Close()

	state, err := store.GetAppState()
	if err != nil {
		fmt.Fprintln(os.Stderr, "get app state:", err)
		return 1
	}

	if err := store.SetTrackingPaused(!state.TrackingPaused); err != nil {
		fmt.Fprintln(os.Stderr, "set tracking paused:", err)
		return 1
	}
	return 0
}

func usageText() string {
	return "Usage: chronly [status [--json]|toggle-pause]\n\nCommands:\n  status         Print current tracking status and exit\n                 (human-readable in a terminal, JSON when piped, or with --json)\n  toggle-pause   Flip tracking paused/resumed and exit\n\nRun chronly with no arguments to launch the GUI.\n"
}

func runCLI(args []string) int {
	switch args[0] {
	case "status":
		return runStatusCommand(args[1:])
	case "toggle-pause":
		return runTogglePauseCommand()
	case "--help", "-h", "help":
		fmt.Print(usageText())
		return 0
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n%s", args[0], usageText())
		return 1
	}
}
