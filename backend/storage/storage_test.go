package storage

import "testing"

func TestOpenCrteatesSchema(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	defer store.Close()

	tables := []string{
		"projects", "tasks", "activity_blocks",
		"assignment_rules", "manual_entries", "app_state",
	}

	for _, table := range tables {
		var name string
		err := store.db.QueryRow(
			"SELECT name FROM sqlite_master WHERE type='table' and name=?", table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)

		}
	}
}
