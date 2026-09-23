//go:build linux

package tracker

import (
	"context"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
)

type inputEvent struct {
	Sec   int64
	Usec  int64
	Type  uint16
	Code  uint16
	Value int32
}

func NewEvdevIdleDetector(ctx context.Context) (IdleDetector, func() error, error) {
	paths, err := filepath.Glob("/dev/input/event*")
	if err != nil {
		return nil, nil, fmt.Errorf("glob /dev/input/event*: %w", err)
	}

	clock := newActivityClock()
	opened := 0

	for _, path := range paths {
		f, err := os.OpenFile(path, os.O_RDONLY, 0)
		if err != nil {
			continue
		}
		opened++
		go watchInputDevice(ctx, f, clock)
	}

	if opened == 0 {
		return nil, nil, fmt.Errorf("no readable /dev/input/event* devices (check 'input' group membership)")
	}

	run := func() error {
		<-ctx.Done()
		return nil
	}
	return clock, run, nil
}

func watchInputDevice(ctx context.Context, f *os.File, clock *activityClock) {
	defer f.Close()
	go func() {
		<-ctx.Done()
		f.Close()
	}()

	var ev inputEvent
	for {
		if err := binary.Read(f, binary.LittleEndian, &ev); err != nil {
			return
		}
		clock.touch()
	}
}
