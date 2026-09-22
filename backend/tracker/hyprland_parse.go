package tracker

import "strings"

func parseHyprlandEvent(line string) (WindowInfo, bool) {
	event, data, found := strings.Cut(line, ">>")
	if !found || event != "activewindow" {
		return WindowInfo{}, false
	}
	class, title, found := strings.Cut(data, ",")
	if !found {
		return WindowInfo{}, false
	}
	return WindowInfo{AppName: class, WindowTitle: title}, true
}
