package storage

import (
	"errors"
	"time"

	"chronly/backend/tracker"
)

func (s *Store) SaveActivityBlock(b tracker.Block, a tracker.Assignment) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO activity_blocks (start_time, end_time, app_name, window_title, task_id, project_id, assigned_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		b.StartTime, b.EndTime, b.AppName, b.WindowTitle, a.TaskID, a.ProjectID, a.AssignedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error) {
	rows, err := s.db.Query(
		`SELECT start_time, end_time, app_name, window_title, task_id, project_id
		 FROM activity_blocks
		 WHERE start_time >= ? AND start_time < ?
		 ORDER BY start_time ASC`,
		start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []tracker.Block
	for rows.Next() {
		var b tracker.Block
		var taskID, projectID *int64
		if err := rows.Scan(&b.StartTime, &b.EndTime, &b.AppName, &b.WindowTitle, &taskID, &projectID); err != nil {
			return nil, err
		}
		blocks = append(blocks, b)
	}
	return blocks, rows.Err()
}

func (s *Store) UpdateActivityBlockAssignment(id int64, taskID *int64) error {
	var projectID *int64
	if taskID != nil {
		var pid int64
		if err := s.db.QueryRow(`SELECT project_id FROM tasks WHERE id = ?`, *taskID).Scan(&pid); err != nil {
			return err
		}
		projectID = &pid
	}
	_, err := s.db.Exec(
		`UPDATE activity_blocks SET task_id = ?, project_id = ?, assigned_by = 'manual' WHERE id = ?`,
		taskID, projectID, id,
	)
	return err
}

func (s *Store) SplitActivityBlock(id int64, splitAt time.Time) (int64, error) {
	var startTime, endTime time.Time
	var appName, windowTitle string
	var taskID, projectID *int64
	var assignedBy *string
	if err := s.db.QueryRow(
		`SELECT start_time, end_time, app_name, window_title, task_id, project_id, assigned_by
		 FROM activity_blocks WHERE id = ?`, id,
	).Scan(&startTime, &endTime, &appName, &windowTitle, &taskID, &projectID, &assignedBy); err != nil {
		return 0, err
	}

	if !splitAt.After(startTime) || !splitAt.Before(endTime) {
		return 0, errors.New("split point must be strictly inside the block's time range")
	}

	if _, err := s.db.Exec(`UPDATE activity_blocks SET end_time = ? WHERE id = ?`, splitAt, id); err != nil {
		return 0, err
	}

	res, err := s.db.Exec(
		`INSERT INTO activity_blocks (start_time, end_time, app_name, window_title, task_id, project_id, assigned_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		splitAt, endTime, appName, windowTitle, taskID, projectID, assignedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}
