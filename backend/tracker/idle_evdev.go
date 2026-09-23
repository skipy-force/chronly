package tracker

import (
	"sync"
	"time"
)

type activityClock struct {
	mu         sync.Mutex
	lastActive time.Time
	now        func() time.Time
}

func newActivityClock() *activityClock {
	c := &activityClock{now: time.Now}
	c.lastActive = c.now()
	return c
}

func (c *activityClock) touch() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastActive = c.now()
}

func (c *activityClock) IdleDuration() time.Duration {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now().Sub(c.lastActive)
}
