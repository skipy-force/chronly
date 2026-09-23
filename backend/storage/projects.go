package storage

import "chronly/backend/tracker"

func (s *Store) CreateProject(p tracker.Project) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO projects (name, color, estimate_minutes) VALUES (?, ?, ?)`,
		p.Name, p.Color, p.EstimateMinutes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (s *Store) GetProject(id int64) (tracker.Project, error) {
	var p tracker.Project
	var archived int
	row := s.db.QueryRow(
		`SELECT id, name, color, estimate_minutes, archived, created_at FROM projects WHERE id = ?`,
		id,
	)
	if err := row.Scan(&p.ID, &p.Name, &p.Color, &p.EstimateMinutes, &archived, &p.CreatedAt); err != nil {
		return tracker.Project{}, err
	}
	p.Archived = archived != 0
	return p, nil
}

func (s *Store) ListProjects() ([]tracker.Project, error) {
	return queryProjects(s, `SELECT id, name, color, estimate_minutes, archived, created_at FROM projects WHERE archived = 0`)
}

func (s *Store) ListArchivedProjects() ([]tracker.Project, error) {
	return queryProjects(s, `SELECT id, name, color, estimate_minutes, archived, created_at FROM projects WHERE archived = 1`)
}

func queryProjects(s *Store, query string) ([]tracker.Project, error) {
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []tracker.Project
	for rows.Next() {
		var p tracker.Project
		var archived int
		if err := rows.Scan(&p.ID, &p.Name, &p.Color, &p.EstimateMinutes, &archived, &p.CreatedAt); err != nil {
			return nil, err
		}
		p.Archived = archived != 0
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func (s *Store) UpdateProject(p tracker.Project) error {
	_, err := s.db.Exec(
		`UPDATE projects SET name = ?, color = ?, estimate_minutes = ? WHERE id = ?`,
		p.Name, p.Color, p.EstimateMinutes, p.ID,
	)
	return err
}

func (s *Store) ArchiveProject(id int64) error {
	_, err := s.db.Exec(`UPDATE projects SET archived = 1 WHERE id = ?`, id)
	return err
}

func (s *Store) UnarchiveProject(id int64) error {
	_, err := s.db.Exec(`UPDATE projects SET archived = 0 WHERE id = ?`, id)
	return err
}
