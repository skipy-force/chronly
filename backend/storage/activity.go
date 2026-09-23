package storage

import (
	"database/sql"
	"errors"
	"time"

	"chronly/backend/tracker"
)

func (s *Store) SaveActivityBlock(b tracker.Block, a tracker.Assignment) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO activity_blocks (start_time, end_time, app_name, window_title, task_id, project_id, assigned_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		b.StartTime.UTC(), b.EndTime.UTC(), b.AppName, b.WindowTitle, a.TaskID, a.ProjectID, a.AssignedBy,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) ListActivityBlocksForRange(start, end time.Time) ([]tracker.Block, error) {
	rows, err := s.db.Query(
		`SELECT id, start_time, end_time, app_name, window_title, task_id, project_id
		 FROM activity_blocks
		 WHERE start_time >= ? AND start_time < ?
		 ORDER BY start_time ASC`,
		start.UTC(), end.UTC(),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	blocks := []tracker.Block{}
	for rows.Next() {
		var b tracker.Block
		if err := rows.Scan(&b.ID, &b.StartTime, &b.EndTime, &b.AppName, &b.WindowTitle, &b.TaskID, &b.ProjectID); err != nil {
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

func (s *Store) UpdateActivityBlockProjectOnly(id int64, projectID int64) error {
	_, err := s.db.Exec(
		`UPDATE activity_blocks SET task_id = NULL, project_id = ?, assigned_by = 'manual' WHERE id = ?`,
		projectID, id,
	)
	return err
}

const compactMergeGapTolerance = 3 * time.Second

type compactRow struct {
	id             int64
	start, end     time.Time
	appName, title string
	taskID         sql.NullInt64
	projectID      sql.NullInt64
}

func (s *Store) CompactActivityBlocks(cutoff time.Time) (merged, deleted int, err error) {
	rows, err := s.db.Query(
		`SELECT id, start_time, end_time, app_name, window_title, task_id, project_id
		 FROM activity_blocks WHERE start_time < ? ORDER BY start_time ASC`,
		cutoff.UTC(),
	)
	if err != nil {
		return 0, 0, err
	}

	var all []compactRow
	for rows.Next() {
		var r compactRow
		if err := rows.Scan(&r.id, &r.start, &r.end, &r.appName, &r.title, &r.taskID, &r.projectID); err != nil {
			rows.Close()
			return 0, 0, err
		}
		all = append(all, r)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, 0, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return 0, 0, err
	}

	i := 0
	for i < len(all) {
		j := i + 1
		for j < len(all) {
			prev, cur := all[j-1], all[j]
			gap := cur.start.Sub(prev.end)
			sameAssignment := prev.taskID == cur.taskID && prev.projectID == cur.projectID
			if cur.appName != prev.appName || !sameAssignment || gap > compactMergeGapTolerance || gap < -compactMergeGapTolerance {
				break
			}
			j++
		}

		if j-i > 1 {
			first, last := all[i], all[j-1]
			if _, err := tx.Exec(
				`UPDATE activity_blocks SET end_time = ?, window_title = ? WHERE id = ?`,
				last.end, last.title, first.id,
			); err != nil {
				tx.Rollback()
				return 0, 0, err
			}
			for k := i + 1; k < j; k++ {
				if _, err := tx.Exec(`DELETE FROM activity_blocks WHERE id = ?`, all[k].id); err != nil {
					tx.Rollback()
					return 0, 0, err
				}
				deleted++
			}
			merged++
		}

		i = j
	}

	if err := tx.Commit(); err != nil {
		return 0, 0, err
	}
	return merged, deleted, nil
}

func (s *Store) Vacuum() error {
	_, err := s.db.Exec("VACUUM")
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

	splitAt = splitAt.UTC()
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
