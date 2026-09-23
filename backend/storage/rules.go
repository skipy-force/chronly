package storage

import "chronly/backend/tracker"

func (s *Store) ListAssignmentRulesByPriority() ([]tracker.Rule, error) {
	rows, err := s.db.Query(
		`SELECT pattern_type, pattern, project_id, task_id, priority
		 FROM assignment_rules ORDER BY priority DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []tracker.Rule
	for rows.Next() {
		var r tracker.Rule
		if err := rows.Scan(&r.PatternType, &r.Pattern, &r.ProjectID, &r.TaskID, &r.Priority); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}
