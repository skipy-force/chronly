package storage

import (
	"fmt"
	"path/filepath"
	"sync"
	"testing"

	"chronly/backend/tracker"
)

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

func TestOpen_CreatesIndexOnActivityBlocksStartTime(t *testing.T) {
	store, err := Open(":memory:")
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer store.Close()

	var name string
	err = store.db.QueryRow(
		"SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='activity_blocks' AND sql LIKE '%start_time%'",
	).Scan(&name)
	if err != nil {
		t.Fatalf("expected an index on activity_blocks(start_time), got error: %v", err)
	}
}

func TestOpen_HandlesConcurrentAccessWithoutLockErrors(t *testing.T) {
	path := filepath.Join(t.TempDir(), "concurrent.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer s.Close()

	var wg sync.WaitGroup
	errCh := make(chan error, 40)
	for i := 0; i < 20; i++ {
		wg.Add(2)
		go func(n int) {
			defer wg.Done()
			if _, err := s.CreateProject(tracker.Project{Name: fmt.Sprintf("p%d", n)}); err != nil {
				errCh <- err
			}
		}(i)
		go func() {
			defer wg.Done()
			if _, err := s.GetAppState(); err != nil {
				errCh <- err
			}
		}()
	}
	wg.Wait()
	close(errCh)

	for err := range errCh {
		t.Errorf("concurrent access error: %v", err)
	}
}
