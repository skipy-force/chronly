package storage

import "chronly/backend/tracker"

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
