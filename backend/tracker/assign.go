package tracker

import "strings"

type Rule struct {
	PatternType string
	Pattern     string
	ProjectID   int64
	TaskID      *int64
	Priority    int
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
		var subject string
		switch r.PatternType {
		case "app_name":
			subject = b.AppName
		case "window_title":
			subject = b.WindowTitle
		default:
			continue
		}
		if strings.Contains(subject, r.Pattern) {
			assignedBy := "rule"
			projectID := r.ProjectID
			return Assignment{ProjectID: &projectID, TaskID: r.TaskID, AssignedBy: &assignedBy}
		}
	}

	return Assignment{}
}
