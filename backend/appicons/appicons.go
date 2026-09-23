package appicons

import (
	"regexp"
	"strconv"
	"strings"
)

type DesktopEntry struct {
	Icon           string
	StartupWMClass string
}

func ParseDesktopEntry(content string) DesktopEntry {
	var entry DesktopEntry
	inEntry := false
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "[") {
			inEntry = line == "[Desktop Entry]"
			continue
		}
		if !inEntry {
			continue
		}
		if v, ok := strings.CutPrefix(line, "Icon="); ok {
			entry.Icon = v
		}
		if v, ok := strings.CutPrefix(line, "StartupWMClass="); ok {
			entry.StartupWMClass = v
		}
	}
	return entry
}

func MatchesAppName(desktopFileName, startupWMClass, appName string) bool {
	stem := strings.TrimSuffix(desktopFileName, ".desktop")
	if strings.EqualFold(stem, appName) {
		return true
	}
	if startupWMClass != "" && strings.EqualFold(startupWMClass, appName) {
		return true
	}
	return false
}

var sizePattern = regexp.MustCompile(`/(\d+)x\d+/`)

func iconRank(path string) int {
	if strings.Contains(path, "/scalable/") {
		return 1 << 20
	}
	if m := sizePattern.FindStringSubmatch(path); m != nil {
		size, err := strconv.Atoi(m[1])
		if err == nil {
			return size
		}
	}
	if strings.Contains(path, "/pixmaps/") {
		return 40
	}
	return 0
}

func PreferredIconPath(paths []string) string {
	if len(paths) == 0 {
		return ""
	}
	best := paths[0]
	bestRank := iconRank(best)
	for _, p := range paths[1:] {
		if r := iconRank(p); r > bestRank {
			best, bestRank = p, r
		}
	}
	return best
}

var mimeByExt = map[string]string{
	".svg":  "image/svg+xml",
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".gif":  "image/gif",
	".webp": "image/webp",
}

func MimeTypeForExt(ext string) (string, bool) {
	mime, ok := mimeByExt[strings.ToLower(ext)]
	return mime, ok
}
