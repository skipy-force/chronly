package storage

import (
	"encoding/json"
	"testing"
	"time"
)

func assertMarshalsToEmptyArray(t *testing.T, name string, v any) {
	t.Helper()
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("%s: json.Marshal: %v", name, err)
	}
	if string(data) != "[]" {
		t.Fatalf("%s: expected JSON \"[]\" for an empty result (Wails serializes a nil Go slice as null, which crashes frontend code expecting an array), got %q", name, data)
	}
}

func TestListMethods_ReturnEmptyArrayNotNullWhenNoRows(t *testing.T) {
	s := newTestStore(t)

	projects, err := s.ListProjects()
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListProjects", projects)

	archivedProjects, err := s.ListArchivedProjects()
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListArchivedProjects", archivedProjects)

	if _, err := s.db.Exec(`INSERT INTO projects (id, name) VALUES (1, 'a')`); err != nil {
		t.Fatal(err)
	}

	tasks, err := s.ListTasksByProject(1)
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListTasksByProject", tasks)

	doneTasks, err := s.ListDoneTasksByProject(1)
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListDoneTasksByProject", doneTasks)

	archivedTasks, err := s.ListArchivedTasksByProject(1)
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListArchivedTasksByProject", archivedTasks)

	rules, err := s.ListAssignmentRulesByPriority()
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListAssignmentRulesByPriority", rules)

	blocks, err := s.ListActivityBlocksForRange(time.Unix(0, 0), time.Now())
	if err != nil {
		t.Fatal(err)
	}
	assertMarshalsToEmptyArray(t, "ListActivityBlocksForRange", blocks)
}
