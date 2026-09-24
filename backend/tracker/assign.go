package tracker

import "strings"

type Rule struct {
	ID                 int64
	AppNamePattern     *string
	WindowTitlePattern *string
	ProjectID          int64
	TaskID             *int64
	Priority           int
}

type Assignment struct {
	ProjectID  *int64
	TaskID     *int64
	AssignedBy *string
}

func Resolve(b Block, currentTaskID *int64, currentTaskProjectID *int64, rules []Rule) Assignment {
	if currentTaskID != nil {
		assignedBy := "manual"
		return Assignment{ProjectID: currentTaskProjectID, TaskID: currentTaskID, AssignedBy: &assignedBy}
	}

	for _, r := range rules {
		if !r.matches(b) {
			continue
		}
		assignedBy := "rule"
		projectID := r.ProjectID
		return Assignment{ProjectID: &projectID, TaskID: r.TaskID, AssignedBy: &assignedBy}
	}

	return Assignment{}
}

func (r Rule) matches(b Block) bool {
	if r.AppNamePattern == nil && r.WindowTitlePattern == nil {
		return false
	}
	if r.AppNamePattern != nil && !strings.Contains(b.AppName, *r.AppNamePattern) {
		return false
	}
	if r.WindowTitlePattern != nil && !strings.Contains(b.WindowTitle, *r.WindowTitlePattern) {
		return false
	}
	return true
}
