package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"chronly/backend/storage"
	"chronly/backend/tracker"
)

const liveStatusStaleAfter = 10 * time.Second

type statusOutput struct {
	Running        bool   `json:"running"`
	Paused         bool   `json:"paused"`
	AppName        string `json:"app_name"`
	WindowTitle    string `json:"window_title"`
	ElapsedSeconds int    `json:"elapsed_seconds"`
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

func runStatusCommand() int {
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

	data, err := json.Marshal(buildStatusOutput(status, time.Now().UTC()))
	if err != nil {
		fmt.Fprintln(os.Stderr, "marshal status:", err)
		return 1
	}
	fmt.Println(string(data))
	return 0
}

func runCLI(args []string) int {
	switch args[0] {
	case "status":
		return runStatusCommand()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\nUsage: chronly [status]\n", args[0])
		return 1
	}
}
