package presence

import (
	"server/graph"
	"sync"
)

// Per-board fan-out of live cursor positions. Mirrors the transient/locks
// pub-sub pattern: best-effort, non-blocking, dropped on a full channel.
var (
	SubsMu sync.RWMutex
	Subs   = map[string]map[chan *graph.CursorPresence]struct{}{}
)

func Publish(boardID string, c *graph.CursorPresence) {
	SubsMu.RLock()
	defer SubsMu.RUnlock()

	if subs, ok := Subs[boardID]; ok {
		for ch := range subs {
			select {
			case ch <- c:
			default:
			}
		}
	}
}

func Subscribe(boardID string, ch chan *graph.CursorPresence) {
	SubsMu.Lock()
	defer SubsMu.Unlock()

	if Subs[boardID] == nil {
		Subs[boardID] = map[chan *graph.CursorPresence]struct{}{}
	}
	Subs[boardID][ch] = struct{}{}
}

func Unsubscribe(boardID string, ch chan *graph.CursorPresence) {
	SubsMu.Lock()
	defer SubsMu.Unlock()

	if subs, ok := Subs[boardID]; ok {
		delete(subs, ch)
		close(ch)
		if len(subs) == 0 {
			delete(Subs, boardID)
		}
	}
}
