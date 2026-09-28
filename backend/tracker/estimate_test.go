package tracker

import "testing"

func TestEstimateTracker_NoNotifyUnderEstimate(t *testing.T) {
	e := NewEstimateTracker()
	if e.ShouldNotify(1, 30, 60) {
		t.Fatal("should not notify while under estimate")
	}
}

func TestEstimateTracker_NotifiesOnceOnCrossing(t *testing.T) {
	e := NewEstimateTracker()
	if !e.ShouldNotify(1, 61, 60) {
		t.Fatal("expected notify on first crossing")
	}
	if e.ShouldNotify(1, 70, 60) {
		t.Fatal("should not notify again while still over, same task")
	}
}

func TestEstimateTracker_RenotifiesAfterDroppingBackUnderAndCrossingAgain(t *testing.T) {
	e := NewEstimateTracker()
	e.ShouldNotify(1, 61, 60)
	if e.ShouldNotify(1, 50, 60) {
		t.Fatal("should not notify while back under estimate")
	}
	if !e.ShouldNotify(1, 61, 60) {
		t.Fatal("expected notify again after re-crossing")
	}
}

func TestEstimateTracker_ForgetAllowsImmediateRenotify(t *testing.T) {
	e := NewEstimateTracker()
	e.ShouldNotify(1, 61, 60)
	e.Forget(1)
	if !e.ShouldNotify(1, 61, 60) {
		t.Fatal("expected notify again after Forget, even though still over")
	}
}

func TestEstimateTracker_TracksMultipleTasksIndependently(t *testing.T) {
	e := NewEstimateTracker()
	e.ShouldNotify(1, 61, 60)
	if !e.ShouldNotify(2, 61, 60) {
		t.Fatal("a different task crossing should notify independently")
	}
}
