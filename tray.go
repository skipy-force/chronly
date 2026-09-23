package main

import (
	_ "embed"
	"fmt"
	"time"

	"chronly/backend/tracker"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2/pkg/runtime"
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

	systray.AddSeparator()
	switchTask := systray.AddMenuItem("Switch task", "")
	for i := range t.slots {
		item := switchTask.AddSubMenuItem("", "")
		item.Hide()
		t.slots[i].item = item
		go t.watchSlot(i)
	}

	systray.AddSeparator()
	open := systray.AddMenuItem("Open chronly", "")
	quit := systray.AddMenuItem("Quit", "")

	go t.watchPause()
	go t.watchOpen(open)
	go t.watchQuit(quit)
	go t.refreshLoop()

	t.refresh()
}

func (t *Tray) onExit() {}

func (t *Tray) watchPause() {
	for range t.pause.ClickedCh {
		paused := !t.pause.Checked()
		if err := t.app.store.SetTrackingPaused(paused); err != nil {
			continue
		}
		t.refresh()
	}
}

func (t *Tray) watchOpen(item *systray.MenuItem) {
	for range item.ClickedCh {
		if t.app.ctx != nil {
			runtime.WindowShow(t.app.ctx)
		}
	}
}

func (t *Tray) watchQuit(item *systray.MenuItem) {
	<-item.ClickedCh
	if t.app.ctx != nil {
		runtime.Quit(t.app.ctx)
	}
	systray.Quit()
}

func (t *Tray) watchSlot(i int) {
	for range t.slots[i].item.ClickedCh {
		taskID := t.slots[i].taskID
		if taskID == 0 {
			continue
		}
		if err := t.app.store.SetCurrentTask(&taskID); err != nil {
			continue
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
	if err == nil {
		if state.TrackingPaused {
			t.pause.Check()
		} else {
			t.pause.Uncheck()
		}
		t.status.SetTitle(t.statusLabel(state))
	}

	projects, err := t.app.store.ListProjects()
	if err != nil {
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
