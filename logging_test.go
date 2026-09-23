package main

import "testing"

func TestLastLines_ReturnsAllWhenFewerThanMax(t *testing.T) {
	got := lastLines("a\nb\nc", 10)
	want := "a\nb\nc"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLastLines_TruncatesToMostRecent(t *testing.T) {
	got := lastLines("a\nb\nc\nd\ne", 3)
	want := "c\nd\ne"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLastLines_IgnoresTrailingNewline(t *testing.T) {
	got := lastLines("a\nb\nc\n", 2)
	want := "b\nc"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLastLines_EmptyContentReturnsEmpty(t *testing.T) {
	if got := lastLines("", 10); got != "" {
		t.Fatalf("got %q, want empty", got)
	}
}
