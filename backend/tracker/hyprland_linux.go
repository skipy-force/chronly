//go:build linux

package tracker

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
)

type HyprlandTracker struct{}

func NewHyprlandTracker() *HyprlandTracker {
	return &HyprlandTracker{}
}

func hyprlandSocketPath() (string, error) {
	runtimeDir := os.Getenv("XDG_RUNTIME_DIR")
	signature := os.Getenv("HYPRLAND_INSTANCE_SIGNATURE")
	if runtimeDir == "" || signature == "" {
		return "", fmt.Errorf("not running under Hyprland: XDG_RUNTIME_DIR or HYPRLAND_INSTANCE_SIGNATURE is unset")
	}
	return filepath.Join(runtimeDir, "hypr", signature, ".socket2.sock"), nil
}

func (t *HyprlandTracker) Watch(ctx context.Context, updates chan<- WindowInfo) error {
	path, err := hyprlandSocketPath()
	if err != nil {
		return err
	}
	conn, err := net.Dial("unix", path)
	if err != nil {
		return fmt.Errorf("dial hyprland socket: %w", err)
	}
	defer conn.Close()

	go func() {
		<-ctx.Done()
		conn.Close()
	}()

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		info, ok := parseHyprlandEvent(scanner.Text())
		if !ok {
			continue
		}
		select {
		case updates <- info:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return scanner.Err()
}
