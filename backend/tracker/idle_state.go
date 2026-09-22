package tracker

import (
	"sync"
	"time"
)

type IdleDetector interface {
	IdleDuration() time.Duration
}

type idleState struct {
	mu        sync.Mutex
	idleSince time.Time
	now       func() time.Time
}

func newIdleState() *idleState {
	return &idleState{now: time.Now}
}

func (s *idleState) markIdle() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idleSince = s.now()
}

func (s *idleState) markResumed() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idleSince = time.Time{}
}

func (s *idleState) IdleDuration() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.idleSince.IsZero() {
		return 0
	}
	return s.now().Sub(s.idleSince)
}
