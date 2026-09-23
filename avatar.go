package main

import (
	"encoding/base64"
	"os"
	"path/filepath"

	"chronly/backend/appicons"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) PickAvatar() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose an avatar",
		Filters: []runtime.FileFilter{
			{DisplayName: "Images", Pattern: "*.png;*.jpg;*.jpeg;*.gif;*.webp"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}

	mime, ok := appicons.MimeTypeForExt(filepath.Ext(path))
	if !ok {
		return "", nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data), nil
}
