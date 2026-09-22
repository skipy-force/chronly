//go:build linux

package tracker

import (
	"context"
	"fmt"

	"github.com/rajveermalviya/go-wayland/wayland/client"
	idlenotify "github.com/rajveermalviya/go-wayland/wayland/staging/ext-idle-notify-v1"
)

func bindGlobal(registry *client.Registry, name uint32, iface string, version uint32, id client.Proxy) error {
	strLen := len(iface) + 1
	strPadded := (strLen + 3) / 4 * 4
	bufLen := 8 + 4 + (4 + strPadded) + 4 + 4
	buf := make([]byte, bufLen)
	l := 0
	client.PutUint32(buf[l:l+4], registry.ID())
	l += 4
	const opcode = 0
	client.PutUint32(buf[l:l+4], uint32(bufLen<<16|opcode))
	l += 4
	client.PutUint32(buf[l:l+4], name)
	l += 4
	client.PutUint32(buf[l:l+4], uint32(strLen))
	l += 4
	copy(buf[l:l+len(iface)], iface)
	l += strPadded
	client.PutUint32(buf[l:l+4], version)
	l += 4
	client.PutUint32(buf[l:l+4], id.ID())
	l += 4
	return registry.Context().WriteMsg(buf, nil)
}

func NewWaylandIdleDetector(ctx context.Context, idleMillis uint32) (IdleDetector, func() error, error) {
	display, err := client.Connect("")
	if err != nil {
		return nil, nil, fmt.Errorf("connect to wayland display: %w", err)
	}

	state := newIdleState()

	var seat *client.Seat
	var notifier *idlenotify.IdleNotifier

	registry, err := display.GetRegistry()
	if err != nil {
		return nil, nil, fmt.Errorf("get registry: %w", err)
	}
	registry.SetGlobalHandler(func(e client.RegistryGlobalEvent) {
		switch e.Interface {
		case "wl_seat":
			seat = client.NewSeat(display.Context())
			bindGlobal(registry, e.Name, e.Interface, e.Version, seat)
		case "ext_idle_notifier_v1":
			notifier = idlenotify.NewIdleNotifier(display.Context())
			bindGlobal(registry, e.Name, e.Interface, e.Version, notifier)
		}
	})

	callback, err := display.Sync()
	if err != nil {
		return nil, nil, fmt.Errorf("sync: %w", err)
	}
	done := make(chan struct{})
	callback.SetDoneHandler(func(client.CallbackDoneEvent) { close(done) })
syncLoop:
	for {
		if err := display.Context().Dispatch(); err != nil {
			return nil, nil, fmt.Errorf("dispatch during sync: %w", err)
		}
		select {
		case <-done:
			break syncLoop
		default:
		}
	}

	if seat == nil || notifier == nil {
		return nil, nil, fmt.Errorf("compositor does not expose wl_seat + ext_idle_notifier_v1 (idle detection unavailable)")
	}

	notification, err := notifier.GetIdleNotification(idleMillis, seat)
	if err != nil {
		return nil, nil, fmt.Errorf("get idle notification: %w", err)
	}
	notification.SetIdledHandler(func(idlenotify.IdleNotificationIdledEvent) { state.markIdle() })
	notification.SetResumedHandler(func(idlenotify.IdleNotificationResumedEvent) { state.markResumed() })

	run := func() error {
		for {
			select {
			case <-ctx.Done():
				return nil
			default:
			}
			if err := display.Context().Dispatch(); err != nil {
				return err
			}
		}
	}

	return state, run, nil
}
