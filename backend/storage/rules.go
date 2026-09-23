package storage

import "chronly/backend/tracker"

func (s *Store) ListAssignmentRulesByPriority() ([]tracker.Rule, error) {
	rows, err := s.db.Query(
		`SELECT id, pattern_type, pattern, project_id, task_id, priority
		 FROM assignment_rules ORDER BY priority DESC, id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := []tracker.Rule{}
	for rows.Next() {
		var r tracker.Rule
		if err := rows.Scan(&r.ID, &r.PatternType, &r.Pattern, &r.ProjectID, &r.TaskID, &r.Priority); err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, rows.Err()
}

func (s *Store) CreateAssignmentRule(r tracker.Rule) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO assignment_rules (pattern_type, pattern, project_id, task_id, priority)
		 VALUES (?, ?, ?, ?, ?)`,
		r.PatternType, r.Pattern, r.ProjectID, r.TaskID, r.Priority,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) UpdateAssignmentRule(r tracker.Rule) error {
	_, err := s.db.Exec(
		`UPDATE assignment_rules SET pattern_type = ?, pattern = ?, project_id = ?, task_id = ?, priority = ?
		 WHERE id = ?`,
		r.PatternType, r.Pattern, r.ProjectID, r.TaskID, r.Priority, r.ID,
	)
	return err
}

func (s *Store) DeleteAssignmentRule(id int64) error {
	_, err := s.db.Exec(`DELETE FROM assignment_rules WHERE id = ?`, id)
	return err
}
