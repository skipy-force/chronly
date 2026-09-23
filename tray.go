package main

import (
	_ "embed"
	"fmt"
	"log"
	"time"

	"chronly/backend/tracker"

	"github.com/energye/systray"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed build/appicon.png
var trayIcon []byte

const traySlots = 20

type trayTaskSlot struct {
	item   *systray.MenuItem
	taskID int64
}

type Tray struct {
	app    *App
	status *systray.MenuItem
	pause  *systray.MenuItem
	slots  [traySlots]trayTaskSlot
}

func newTray(app *App) *Tray {
	return &Tray{app: app}
}

func (t *Tray) run() {
	systray.Run(t.onReady, t.onExit)
}

func (t *Tray) onReady() {
	systray.SetIcon(trayIcon)
	systray.SetTitle("chronly")
	systray.SetTooltip("chronly")

	t.status = systray.AddMenuItem("No task selected", "")
	t.status.Disable()

	systray.AddSeparator()
	t.pause = systray.AddMenuItemCheckbox("Pause tracking", "", false)
	t.pause.Click(t.onPauseClicked)

	systray.AddSeparator()
	switchTask := systray.AddMenuItem("Switch task", "")
	for i := range t.slots {
		item := switchTask.AddSubMenuItem("", "")
		item.Hide()
		t.slots[i].item = item
		item.Click(t.onSlotClicked(i))
	}

	systray.AddSeparator()
	open := systray.AddMenuItem("Open chronly", "")
	open.Click(t.onOpenClicked)
	quit := systray.AddMenuItem("Quit", "")
	quit.Click(t.onQuitClicked)

	go t.refreshLoop()

	t.refresh()
	log.Println("tray: ready")
}

func (t *Tray) onExit() {}

func (t *Tray) onPauseClicked() {
	paused := !t.pause.Checked()
	log.Printf("tray: pause clicked, currentlyChecked=%v -> settingPaused=%v", t.pause.Checked(), paused)
	if err := t.app.SetTrackingPaused(paused); err != nil {
		log.Printf("tray: SetTrackingPaused(%v) failed: %v", paused, err)
		return
	}
	t.refresh()
}

func (t *Tray) onOpenClicked() {
	log.Printf("tray: open clicked, ctx set=%v", t.app.ctx != nil)
	if t.app.ctx != nil {
		wailsruntime.WindowShow(t.app.ctx)
	}
}

func (t *Tray) onQuitClicked() {
	log.Println("tray: quit clicked")
	if t.app.ctx != nil {
		wailsruntime.Quit(t.app.ctx)
	}
	systray.Quit()
}

func (t *Tray) onSlotClicked(i int) func() {
	return func() {
		taskID := t.slots[i].taskID
		log.Printf("tray: slot %d clicked, taskID=%d", i, taskID)
		if taskID == 0 {
			return
		}
		if err := t.app.SetCurrentTask(&taskID); err != nil {
			log.Printf("tray: SetCurrentTask(%d) failed: %v", taskID, err)
			return
		}
		t.refresh()
	}
}

func (t *Tray) refreshLoop() {
	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		t.refresh()
	}
}

func (t *Tray) refresh() {
	state, err := t.app.store.GetAppState()
	if err != nil {
		log.Printf("tray: GetAppState failed: %v", err)
	} else {
		if state.TrackingPaused {
			t.pause.Check()
		} else {
			t.pause.Uncheck()
		}
		t.status.SetTitle(t.statusLabel(state))
	}

	projects, err := t.app.store.ListProjects()
	if err != nil {
		log.Printf("tray: ListProjects failed: %v", err)
		return
	}

	idx := 0
	for _, p := range projects {
		tasks, err := t.app.store.ListTasksByProject(p.ID)
		if err != nil {
			continue
		}
		for _, task := range tasks {
			if idx >= len(t.slots) {
				break
			}
			slot := &t.slots[idx]
			slot.taskID = task.ID
			slot.item.SetTitle(fmt.Sprintf("%s — %s", p.Name, task.Name))
			slot.item.Show()
			idx++
		}
	}
	for ; idx < len(t.slots); idx++ {
		t.slots[idx].taskID = 0
		t.slots[idx].item.Hide()
	}
}

func (t *Tray) statusLabel(state tracker.AppState) string {
	if state.CurrentTaskID == nil {
		return "No task selected"
	}
	task, err := t.app.store.GetTask(*state.CurrentTaskID)
	if err != nil {
		return "No task selected"
	}
	if state.CurrentProjectID != nil {
		if project, err := t.app.store.GetProject(*state.CurrentProjectID); err == nil {
			return fmt.Sprintf("%s — %s", project.Name, task.Name)
		}
	}
	return task.Name
}
