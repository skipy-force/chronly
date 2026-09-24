package storage

import (
	"testing"

	"chronly/backend/tracker"
)

func strp(v string) *string { return &v }

func TestListAssignmentRulesByPriority_OrdersDescending(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a'), (2, 'b')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (app_name_pattern, project_id, priority) VALUES ('low', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (app_name_pattern, project_id, priority) VALUES ('high', 2, 10)`); err != nil {
		t.Fatal(err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatalf("ListAssignmentRulesByPriority: %v", err)
	}
	if len(rules) != 2 || rules[0].AppNamePattern == nil || *rules[0].AppNamePattern != "high" ||
		rules[1].AppNamePattern == nil || *rules[1].AppNamePattern != "low" {
		t.Fatalf("expected [high, low] order, got %+v", rules)
	}
}

func TestCreateUpdateDeleteAssignmentRule(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}

	id, err := s.CreateAssignmentRule(tracker.Rule{
		AppNamePattern: strp("firefox"), ProjectID: 1, Priority: 5,
	})
	if err != nil {
		t.Fatalf("CreateAssignmentRule: %v", err)
	}
	if id == 0 {
		t.Fatal("expected non-zero id")
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != id || rules[0].AppNamePattern == nil || *rules[0].AppNamePattern != "firefox" {
		t.Fatalf("unexpected rules after create: %+v", rules)
	}

	if err := s.UpdateAssignmentRule(tracker.Rule{
		ID: id, AppNamePattern: strp("chrome"), ProjectID: 1, Priority: 9,
	}); err != nil {
		t.Fatalf("UpdateAssignmentRule: %v", err)
	}
	rules, err = s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].AppNamePattern == nil || *rules[0].AppNamePattern != "chrome" || rules[0].Priority != 9 {
		t.Fatalf("unexpected rules after update: %+v", rules)
	}

	if err := s.DeleteAssignmentRule(id); err != nil {
		t.Fatalf("DeleteAssignmentRule: %v", err)
	}
	rules, err = s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 0 {
		t.Fatalf("expected no rules after delete, got %+v", rules)
	}
}

func TestListAssignmentRulesByPriority_StableOrderOnTies(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}
	firstID, err := s.CreateAssignmentRule(tracker.Rule{AppNamePattern: strp("a"), ProjectID: 1, Priority: 5})
	if err != nil {
		t.Fatal(err)
	}
	secondID, err := s.CreateAssignmentRule(tracker.Rule{AppNamePattern: strp("b"), ProjectID: 1, Priority: 5})
	if err != nil {
		t.Fatal(err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 2 || rules[0].ID != firstID || rules[1].ID != secondID {
		t.Fatalf("expected stable id-ascending order on tied priority, got %+v", rules)
	}
}

func TestCreateAssignmentRule_PersistsBothPatternsForCompoundMatching(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}

	id, err := s.CreateAssignmentRule(tracker.Rule{
		AppNamePattern: strp("firefox"), WindowTitlePattern: strp("github.com"), ProjectID: 1, Priority: 5,
	})
	if err != nil {
		t.Fatalf("CreateAssignmentRule: %v", err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0].ID != id ||
		rules[0].AppNamePattern == nil || *rules[0].AppNamePattern != "firefox" ||
		rules[0].WindowTitlePattern == nil || *rules[0].WindowTitlePattern != "github.com" {
		t.Fatalf("expected both patterns to round-trip, got %+v", rules)
	}
}
