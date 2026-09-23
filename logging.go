package main

import (
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
)

func logFilePath(dbPath string) string {
	return filepath.Join(filepath.Dir(dbPath), "chronly.log")
}

func setupFileLogging(dbPath string) (*os.File, error) {
	f, err := os.OpenFile(logFilePath(dbPath), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, err
	}
	log.SetOutput(io.MultiWriter(os.Stderr, f))
	return f, nil
}

func lastLines(content string, maxLines int) string {
	if content == "" {
		return ""
	}
	lines := strings.Split(strings.TrimRight(content, "\n"), "\n")
	if len(lines) > maxLines {
		lines = lines[len(lines)-maxLines:]
	}
	return strings.Join(lines, "\n")
}

func (a *App) GetRecentLogs(maxLines int) (string, error) {
	data, err := os.ReadFile(logFilePath(a.dbPath))
	if os.IsNotExist(err) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return lastLines(string(data), maxLines), nil
}
