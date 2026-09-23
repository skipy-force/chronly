package storage

import "chronly/backend/tracker"

func (s *Store) CreateTask(t tracker.Task) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO tasks (project_id, name, estimate_minutes) VALUES (?, ?, ?)`,
		t.ProjectID, t.Name, t.EstimateMinutes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetTask(id int64) (tracker.Task, error) {
	var t tracker.Task
	row := s.db.QueryRow(
		`SELECT id, project_id, name, estimate_minutes, status, created_at FROM tasks WHERE id = ?`,
		id,
	)
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.EstimateMinutes, &t.Status, &t.CreatedAt); err != nil {
		return tracker.Task{}, err
	}
	return t, nil
}

func (s *Store) ListTasksByProject(projectID int64) ([]tracker.Task, error) {
	return queryTasksByProjectAndStatus(s, projectID, tracker.TaskStatusOpen)
}

func (s *Store) ListDoneTasksByProject(projectID int64) ([]tracker.Task, error) {
	return queryTasksByProjectAndStatus(s, projectID, tracker.TaskStatusDone)
}

func (s *Store) ListArchivedTasksByProject(projectID int64) ([]tracker.Task, error) {
	return queryTasksByProjectAndStatus(s, projectID, tracker.TaskStatusArchived)
}

func queryTasksByProjectAndStatus(s *Store, projectID int64, status string) ([]tracker.Task, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, estimate_minutes, status, created_at
		 FROM tasks WHERE project_id = ? AND status = ?`,
		projectID, status,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []tracker.Task
	for rows.Next() {
		var t tracker.Task
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.EstimateMinutes, &t.Status, &t.CreatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (s *Store) UpdateTask(t tracker.Task) error {
	_, err := s.db.Exec(
		`UPDATE tasks SET name = ?, estimate_minutes = ? WHERE id = ?`,
		t.Name, t.EstimateMinutes, t.ID,
	)
	return err
}

func (s *Store) SetTaskStatus(id int64, status string) error {
	_, err := s.db.Exec(`UPDATE tasks SET status = ? WHERE id = ?`, status, id)
	return err
}
