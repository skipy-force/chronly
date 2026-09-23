package main

import "testing"

func TestApp_GetDBPath_ReturnsConfiguredPath(t *testing.T) {
	a := &App{dbPath: "/tmp/example/chronly.db"}
	if got := a.GetDBPath(); got != "/tmp/example/chronly.db" {
		t.Fatalf("GetDBPath() = %q, want %q", got, "/tmp/example/chronly.db")
	}
}

func TestApp_GetAppVersion_ReturnsNonEmptyVersion(t *testing.T) {
	a := &App{}
	if got := a.GetAppVersion(); got == "" {
		t.Fatal("GetAppVersion() returned empty string")
	}
}

func TestApp_OpenDataFolder_OpensDBDirectory(t *testing.T) {
	var gotDir string
	orig := openFileManager
	openFileManager = func(dir string) error {
		gotDir = dir
		return nil
	}
	defer func() { openFileManager = orig }()

	a := &App{dbPath: "/tmp/example/chronly.db"}
	if err := a.OpenDataFolder(); err != nil {
		t.Fatalf("OpenDataFolder() error = %v", err)
	}
	if gotDir != "/tmp/example" {
		t.Fatalf("openFileManager called with %q, want %q", gotDir, "/tmp/example")
	}
}
