package main

import (
	"bufio"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"chronly/backend/appicons"
)

type iconResolver struct {
	mu    sync.Mutex
	cache map[string]string
}

func newIconResolver() *iconResolver {
	return &iconResolver{cache: make(map[string]string)}
}

func (r *iconResolver) resolve(appName string) string {
	r.mu.Lock()
	if v, ok := r.cache[appName]; ok {
		r.mu.Unlock()
		return v
	}
	r.mu.Unlock()

	dataURI := resolveAppIconDataURI(appName)

	r.mu.Lock()
	r.cache[appName] = dataURI
	r.mu.Unlock()
	return dataURI
}

func resolveAppIconDataURI(appName string) string {
	if appName == "" {
		return ""
	}

	themeNames := []string{}
	if theme := configuredIconTheme(); theme != "" {
		themeNames = append(themeNames, theme)
	}
	themeNames = append(themeNames, "hicolor")

	path := findIconFile(appName, themeNames)
	if path == "" {
		if entry, ok := findDesktopEntry(appName); ok {
			if strings.HasPrefix(entry.Icon, "/") {
				if _, err := os.Stat(entry.Icon); err == nil {
					path = entry.Icon
				}
			} else if entry.Icon != "" {
				path = findIconFile(entry.Icon, themeNames)
			}
		}
	}
	if path == "" {
		return ""
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}

	var mime string
	switch strings.ToLower(filepath.Ext(path)) {
	case ".svg":
		mime = "image/svg+xml"
	case ".png":
		mime = "image/png"
	default:
		return ""
	}
	return "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func findIconFile(iconName string, themeNames []string) string {
	for _, theme := range themeNames {
		root := filepath.Join("/usr/share/icons", theme)
		if paths := candidateIconPaths(root, iconName); len(paths) > 0 {
			return appicons.PreferredIconPath(paths)
		}
	}
	for _, ext := range []string{".svg", ".png"} {
		p := filepath.Join("/usr/share/pixmaps", iconName+ext)
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return ""
}

func candidateIconPaths(themeRoot, iconName string) []string {
	var candidates []string
	candidates = append(candidates, filepath.Join(themeRoot, "scalable", "apps", iconName+".svg"))
	if matches, err := filepath.Glob(filepath.Join(themeRoot, "*", "apps", iconName+".svg")); err == nil {
		candidates = append(candidates, matches...)
	}
	if matches, err := filepath.Glob(filepath.Join(themeRoot, "*", "apps", iconName+".png")); err == nil {
		candidates = append(candidates, matches...)
	}

	var paths []string
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			paths = append(paths, p)
		}
	}
	return paths
}

func configuredIconTheme() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	f, err := os.Open(filepath.Join(home, ".config", "gtk-3.0", "settings.ini"))
	if err != nil {
		return ""
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if v, ok := strings.CutPrefix(line, "gtk-icon-theme-name="); ok {
			return v
		}
	}
	return ""
}

func desktopDirs() []string {
	var dirs []string

	dataHome := os.Getenv("XDG_DATA_HOME")
	if dataHome == "" {
		if home, err := os.UserHomeDir(); err == nil {
			dataHome = filepath.Join(home, ".local", "share")
		}
	}
	if dataHome != "" {
		dirs = append(dirs, filepath.Join(dataHome, "applications"))
	}

	dataDirs := os.Getenv("XDG_DATA_DIRS")
	if dataDirs == "" {
		dataDirs = "/usr/local/share:/usr/share"
	}
	for _, d := range strings.Split(dataDirs, ":") {
		if d == "" {
			continue
		}
		dirs = append(dirs, filepath.Join(d, "applications"))
	}
	return dirs
}

func findDesktopEntry(appName string) (appicons.DesktopEntry, bool) {
	for _, dir := range desktopDirs() {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, de := range entries {
			if de.IsDir() || !strings.HasSuffix(de.Name(), ".desktop") {
				continue
			}
			content, err := os.ReadFile(filepath.Join(dir, de.Name()))
			if err != nil {
				continue
			}
			entry := appicons.ParseDesktopEntry(string(content))
			if appicons.MatchesAppName(de.Name(), entry.StartupWMClass, appName) {
				return entry, true
			}
		}
	}
	return appicons.DesktopEntry{}, false
}
