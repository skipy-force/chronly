package appicons

import "testing"

func TestParseDesktopEntry_ExtractsIconAndStartupWMClass(t *testing.T) {
	content := `[Desktop Entry]
Version=1.0
Type=Application
Name=kitty
Icon=kitty
StartupWMClass=kitty

[Desktop Action new-window]
Name=New Window
Icon=window-new
`
	entry := ParseDesktopEntry(content)
	if entry.Icon != "kitty" {
		t.Fatalf("Icon = %q, want %q", entry.Icon, "kitty")
	}
	if entry.StartupWMClass != "kitty" {
		t.Fatalf("StartupWMClass = %q, want %q", entry.StartupWMClass, "kitty")
	}
}

func TestParseDesktopEntry_HandlesAbsolutePathIcon(t *testing.T) {
	content := "[Desktop Entry]\nIcon=/home/user/.local/zed.app/share/icons/hicolor/512x512/apps/zed.png\n"
	entry := ParseDesktopEntry(content)
	if entry.Icon != "/home/user/.local/zed.app/share/icons/hicolor/512x512/apps/zed.png" {
		t.Fatalf("Icon = %q", entry.Icon)
	}
}

func TestParseDesktopEntry_MissingFieldsReturnEmpty(t *testing.T) {
	content := "[Desktop Entry]\nName=Foo\n"
	entry := ParseDesktopEntry(content)
	if entry.Icon != "" || entry.StartupWMClass != "" {
		t.Fatalf("expected empty fields, got %+v", entry)
	}
}

func TestMatchesAppName_MatchesByFileStemCaseInsensitive(t *testing.T) {
	if !MatchesAppName("Firefox.desktop", "", "firefox") {
		t.Fatal("expected case-insensitive filename stem match")
	}
}

func TestMatchesAppName_MatchesByStartupWMClass(t *testing.T) {
	if !MatchesAppName("codium.desktop", "VSCodium", "VSCodium") {
		t.Fatal("expected StartupWMClass match")
	}
}

func TestMatchesAppName_NoMatch(t *testing.T) {
	if MatchesAppName("firefox.desktop", "firefox", "kitty") {
		t.Fatal("expected no match")
	}
}

func TestPreferredIconPath_PrefersScalableOverSized(t *testing.T) {
	got := PreferredIconPath([]string{
		"/usr/share/icons/Papirus/48x48/apps/kitty.svg",
		"/usr/share/icons/Papirus/scalable/apps/kitty.svg",
		"/usr/share/icons/Papirus/16x16/apps/kitty.svg",
	})
	want := "/usr/share/icons/Papirus/scalable/apps/kitty.svg"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestPreferredIconPath_PrefersLargerSizeOverSmaller(t *testing.T) {
	got := PreferredIconPath([]string{
		"/usr/share/icons/Papirus/16x16/apps/kitty.svg",
		"/usr/share/icons/Papirus/128x128/apps/kitty.svg",
		"/usr/share/icons/Papirus/48x48/apps/kitty.svg",
	})
	want := "/usr/share/icons/Papirus/128x128/apps/kitty.svg"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestPreferredIconPath_PrefersSizedOverPixmap(t *testing.T) {
	got := PreferredIconPath([]string{
		"/usr/share/pixmaps/kitty.png",
		"/usr/share/icons/Papirus/48x48/apps/kitty.svg",
	})
	want := "/usr/share/icons/Papirus/48x48/apps/kitty.svg"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestPreferredIconPath_PrefersPixmapOverTinyIcon(t *testing.T) {
	got := PreferredIconPath([]string{
		"/usr/share/icons/Papirus/16x16/apps/kitty.svg",
		"/usr/share/pixmaps/kitty.png",
	})
	want := "/usr/share/pixmaps/kitty.png"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestPreferredIconPath_EmptyInputReturnsEmpty(t *testing.T) {
	if got := PreferredIconPath(nil); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}
