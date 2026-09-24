package tracker

import "testing"

func i64(v int64) *int64    { return &v }
func strp(v string) *string { return &v }

func TestResolve_CurrentTaskWins(t *testing.T) {
	b := Block{AppName: "chrome", WindowTitle: "anything"}
	rules := []Rule{{AppNamePattern: strp("chrome"), ProjectID: 99, Priority: 1}}

	got := Resolve(b, i64(5), i64(1), rules)

	if got.TaskID == nil || *got.TaskID != 5 {
		t.Fatalf("expected current task to win, got %+v", got)
	}
	if got.ProjectID == nil || *got.ProjectID != 1 {
		t.Fatalf("expected project from current task, got %+v", got)
	}
	if got.AssignedBy == nil || *got.AssignedBy != "manual" {
		t.Fatalf("expected assigned_by=manual, got %+v", got.AssignedBy)
	}
}

func TestResolve_FallsBackToHighestPriorityRule(t *testing.T) {
	b := Block{AppName: "code", WindowTitle: "chronly - main.go"}
	rules := []Rule{
		{AppNamePattern: strp("firefox"), ProjectID: 1, Priority: 10},
		{WindowTitlePattern: strp("chronly"), ProjectID: 2, Priority: 5},
	}

	got := Resolve(b, nil, nil, rules)

	if got.ProjectID == nil || *got.ProjectID != 2 {
		t.Fatalf("expected rule match on project 2, got %+v", got)
	}
	if got.AssignedBy == nil || *got.AssignedBy != "rule" {
		t.Fatalf("expected assigned_by=rule, got %+v", got.AssignedBy)
	}
}

func TestResolve_UnassignedWhenNothingMatches(t *testing.T) {
	b := Block{AppName: "code", WindowTitle: "untracked project"}
	got := Resolve(b, nil, nil, nil)

	if got.ProjectID != nil || got.TaskID != nil || got.AssignedBy != nil {
		t.Fatalf("expected fully unassigned, got %+v", got)
	}
}

func TestResolve_RequiresBothConditionsWhenBothSet(t *testing.T) {
	b := Block{AppName: "firefox", WindowTitle: "youtube.com - cat videos"}
	rules := []Rule{
		{AppNamePattern: strp("firefox"), WindowTitlePattern: strp("github.com"), ProjectID: 1, Priority: 10},
		{AppNamePattern: strp("firefox"), WindowTitlePattern: strp("youtube"), ProjectID: 2, Priority: 5},
	}

	got := Resolve(b, nil, nil, rules)

	if got.ProjectID == nil || *got.ProjectID != 2 {
		t.Fatalf("expected the rule whose app AND title both match to win, got %+v", got)
	}
}

func TestResolve_AppMatchAloneDoesNotSatisfyRuleRequiringTitleToo(t *testing.T) {
	b := Block{AppName: "firefox", WindowTitle: "reddit.com - funny"}
	rules := []Rule{
		{AppNamePattern: strp("firefox"), WindowTitlePattern: strp("github.com"), ProjectID: 1, Priority: 10},
	}

	got := Resolve(b, nil, nil, rules)

	if got.ProjectID != nil {
		t.Fatalf("expected no match since the title condition fails, got %+v", got)
	}
}

func TestResolve_RuleWithNoConditionsNeverMatches(t *testing.T) {
	b := Block{AppName: "anything", WindowTitle: "anything"}
	rules := []Rule{{ProjectID: 1, Priority: 10}}

	got := Resolve(b, nil, nil, rules)

	if got.ProjectID != nil {
		t.Fatalf("expected a rule with no conditions set to never match, got %+v", got)
	}
}
