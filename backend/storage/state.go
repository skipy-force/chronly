package storage

import "chronly/backend/tracker"

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
