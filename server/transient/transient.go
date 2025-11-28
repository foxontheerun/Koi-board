package transient

import (
	"sync"
	"server/graph"
)

var (
	SubsMu      sync.RWMutex
	Subs        = map[string]map[chan *graph.TransientShape]struct{}{}
)

func Publish(boardID string, s *graph.TransientShape) {
	SubsMu.RLock()
	defer SubsMu.RUnlock()

	if subs, ok := Subs[boardID]; ok {
		for ch := range subs {
			select {
			case ch <- s:
			default:
			}
		}
	}
}

func Subscribe(boardID string, ch chan *graph.TransientShape) {
	SubsMu.Lock()
	defer SubsMu.Unlock()

	if Subs[boardID] == nil {
		Subs[boardID] = map[chan *graph.TransientShape]struct{}{}
	}

	Subs[boardID][ch] = struct{}{}
}

func Unsubscribe(boardID string, ch chan *graph.TransientShape) {
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
