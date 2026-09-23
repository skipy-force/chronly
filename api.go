package main

import (
	"time"

	"chronly/backend/tracker"
)

func (a *App) ListProjects() ([]tracker.Project, error) {
	return a.store.ListProjects()
}

func (a *App) ListArchivedProjects() ([]tracker.Project, error) {
	return a.store.ListArchivedProjects()
}

func (a *App) CreateProject(p tracker.Project) (int64, error) {
	return a.store.CreateProject(p)
}

func (a *App) UpdateProject(p tracker.Project) error {
	return a.store.UpdateProject(p)
}

func (a *App) ArchiveProject(id int64) error {
	return a.store.ArchiveProject(id)
}

func (a *App) UnarchiveProject(id int64) error {
	return a.store.UnarchiveProject(id)
}

func (a *App) ListTasksByProject(projectID int64) ([]tracker.Task, error) {
	return a.store.ListTasksByProject(projectID)
}

func (a *App) ListDoneTasksByProject(projectID int64) ([]tracker.Task, error) {
	return a.store.ListDoneTasksByProject(projectID)
}

func (a *App) ListArchivedTasksByProject(projectID int64) ([]tracker.Task, error) {
	return a.store.ListArchivedTasksByProject(projectID)
}

func (a *App) CreateTask(t tracker.Task) (int64, error) {
	return a.store.CreateTask(t)
}

func (a *App) UpdateTask(t tracker.Task) error {
	return a.store.UpdateTask(t)
}

func (a *App) SetTaskStatus(id int64, status string) error {
	return a.store.SetTaskStatus(id, status)
}

func (a *App) GetAppState() (tracker.AppState, error) {
	return a.store.GetAppState()
}

func (a *App) SetCurrentTask(taskID *int64) error {
	if err := a.store.SetCurrentTask(taskID); err != nil {
		return err
	}
	if state, err := a.store.GetAppState(); err == nil {
		emitStateChanged(a.ctx, state)
	}
	return nil
}

func (a *App) SetTrackingPaused(paused bool) error {
	if err := a.store.SetTrackingPaused(paused); err != nil {
		return err
	}
	if state, err := a.store.GetAppState(); err == nil {
		emitStateChanged(a.ctx, state)
	}
	return nil
}

func (a *App) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error) {
	return a.store.ListActivityBlocksForRange(start, end)
}

func (a *App) UpdateActivityBlockAssignment(id int64, taskID *int64) error {
	return a.store.UpdateActivityBlockAssignment(id, taskID)
}

func (a *App) SplitActivityBlock(id int64, splitAt time.Time) (int64, error) {
	return a.store.SplitActivityBlock(id, splitAt)
}

func (a *App) ListAssignmentRules() ([]tracker.Rule, error) {
	return a.store.ListAssignmentRulesByPriority()
}

func (a *App) CreateAssignmentRule(r tracker.Rule) (int64, error) {
	return a.store.CreateAssignmentRule(r)
}

func (a *App) UpdateAssignmentRule(r tracker.Rule) error {
	return a.store.UpdateAssignmentRule(r)
}

func (a *App) DeleteAssignmentRule(id int64) error {
	return a.store.DeleteAssignmentRule(id)
}
