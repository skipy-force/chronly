package storage

import (
	"database/sql"

	"chronly/backend/tracker"
)

func (s *Store) GetAppState() (tracker.AppState, error) {
	var st tracker.AppState
	var paused int
	row := s.db.QueryRow(
		`SELECT app_state.current_task_id, tasks.project_id, app_state.tracking_paused, app_state.afk_threshold_minutes
		 FROM app_state
		 LEFT JOIN tasks ON tasks.id = app_state.current_task_id
		 WHERE app_state.id = 1`,
	)
	if err := row.Scan(&st.CurrentTaskID, &st.CurrentProjectID, &paused, &st.AFKThresholdMinutes); err != nil {
		return tracker.AppState{}, err
	}
	st.TrackingPaused = paused != 0
	return st, nil
}

func (s *Store) SetAFKThresholdMinutes(minutes int) error {
	_, err := s.db.Exec(`UPDATE app_state SET afk_threshold_minutes = ? WHERE id = 1`, minutes)
	return err
}

func (s *Store) SetCurrentTask(taskID *int64) error {
	_, err := s.db.Exec(`UPDATE app_state SET current_task_id = ? WHERE id = 1`, taskID)
	return err
}

func (s *Store) SetTrackingPaused(paused bool) error {
	_, err := s.db.Exec(`UPDATE app_state SET tracking_paused = ? WHERE id = 1`, paused)
	return err
}

func (s *Store) UpdateLiveStatus(status tracker.LiveStatus) error {
	var blockStart any
	if !status.BlockStart.IsZero() {
		blockStart = status.BlockStart.UTC()
	}
	_, err := s.db.Exec(
		`UPDATE app_state SET live_app_name = ?, live_window_title = ?, live_block_start = ?, live_updated_at = ? WHERE id = 1`,
		status.AppName, status.WindowTitle, blockStart, status.UpdatedAt.UTC(),
	)
	return err
}

func (s *Store) GetLiveStatus() (tracker.LiveStatus, error) {
	var status tracker.LiveStatus
	var paused int
	var blockStart, updatedAt sql.NullTime
	row := s.db.QueryRow(
		`SELECT live_app_name, live_window_title, live_block_start, live_updated_at, tracking_paused FROM app_state WHERE id = 1`,
	)
	if err := row.Scan(&status.AppName, &status.WindowTitle, &blockStart, &updatedAt, &paused); err != nil {
		return tracker.LiveStatus{}, err
	}
	if blockStart.Valid {
		status.BlockStart = blockStart.Time
	}
	if updatedAt.Valid {
		status.UpdatedAt = updatedAt.Time
	}
	status.Paused = paused != 0
	return status, nil
}
