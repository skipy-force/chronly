package storage

import (
	"database/sql"
	"strings"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      estimate_minutes INTEGER,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      estimate_minutes INTEGER,
      status TEXT NOT NULL DEFAULT 'open',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      app_name TEXT NOT NULL,
      window_title TEXT NOT NULL,
      task_id INTEGER REFERENCES tasks(id),
      project_id INTEGER REFERENCES projects(id),
      assigned_by TEXT
);

CREATE TABLE IF NOT EXISTS assignment_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pattern_type TEXT NOT NULL,
      pattern TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      task_id INTEGER REFERENCES tasks(id),
      priority INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS manual_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_task_id INTEGER REFERENCES tasks(id),
      tracking_paused INTEGER NOT NULL DEFAULT 0,
      afk_threshold_minutes INTEGER NOT NULL DEFAULT 3
);
INSERT OR IGNORE INTO app_state (id, tracking_paused) VALUES (1, 0);

CREATE INDEX IF NOT EXISTS idx_activity_blocks_start_time ON activity_blocks(start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);`

func migrate(db *sql.DB) error {
	if _, err := db.Exec(`ALTER TABLE app_state ADD COLUMN afk_threshold_minutes INTEGER NOT NULL DEFAULT 3`); err != nil {
		if !strings.Contains(err.Error(), "duplicate column") {
			return err
		}
	}
	return nil
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}

	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, err
	}
	if err := migrate(db); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}
