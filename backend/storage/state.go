package storage

import "chronly/backend/tracker"

func (s *Store) GetAppState() (tracker.AppState, error) {
	var st tracker.AppState
	var paused int
	row := s.db.QueryRow(
		`SELECT app_state.current_task_id, tasks.project_id, app_state.tracking_paused
		 FROM app_state
		 LEFT JOIN tasks ON tasks.id = app_state.current_task_id
		 WHERE app_state.id = 1`,
	)
	if err := row.Scan(&st.CurrentTaskID, &st.CurrentProjectID, &paused); err != nil {
		return tracker.AppState{}, err
	}
	st.TrackingPaused = paused != 0
	return st, nil
}
