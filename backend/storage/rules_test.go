package storage

import "testing"

func TestListAssignmentRulesByPriority_OrdersDescending(t *testing.T) {
	s := newTestStore(t)
	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a'), (2, 'b')`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (pattern_type, pattern, project_id, priority) VALUES ('app_name', 'low', 1, 1)`); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO assignment_rules (pattern_type, pattern, project_id, priority) VALUES ('app_name', 'high', 2, 10)`); err != nil {
		t.Fatal(err)
	}

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatalf("ListAssignmentRulesByPriority: %v", err)
	}
	if len(rules) != 2 || rules[0].Pattern != "high" || rules[1].Pattern != "low" {
		t.Fatalf("expected [high, low] order, got %+v", rules)
	}
}
