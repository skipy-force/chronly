package tracker

import "testing"

func TestParseHyprlandEvent(t *testing.T) {
	cases := []struct {
		name string
		line string
		want WindowInfo
		ok   bool
	}{
		{
			name: "normal activewindow event",
			line: "activewindow>>code,main.go - chronly - Visual Studio Code",
			want: WindowInfo{AppName: "code", WindowTitle: "main.go - chronly - Visual Studio Code"},
			ok:   true,
		},
		{
			name: "title containing commas",
			line: "activewindow>>firefox,Issue 12, 13 and 14 - Mozilla Firefox",
			want: WindowInfo{AppName: "firefox", WindowTitle: "Issue 12, 13 and 14 - Mozilla Firefox"},
			ok:   true,
		},
		{
			name: "ignored event type",
			line: "workspace>>3",
			want: WindowInfo{},
			ok:   false,
		},
		{
			name: "malformed data",
			line: "activewindow>>onlyclass",
			want: WindowInfo{},
			ok:   false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := parseHyprlandEvent(tc.line)
			if ok != tc.ok || got != tc.want {
				t.Errorf("parseHyprlandEvent(%q) = %+v, %v; want  %+v, %v",
					tc.line, got, ok, tc.want, tc.ok)
			}
		})
	}
}
