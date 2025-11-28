package subscriptions

import (
	"sync"
	"server/graph"
)

var (
	SubsMuP      sync.RWMutex
	SubsP        = map[string]map[chan *graph.Shape]struct{}{}
)

func Publish(boardID string, s *graph.Shape) {
	SubsMuP.RLock()
	defer SubsMuP.RUnlock()

	if subs, ok := SubsP[boardID]; ok {
		for ch := range subs {
			select {
			case ch <- s:
			default:
			}
		}
	}
}

func Subscribe(boardID string, ch chan *graph.Shape) {
	SubsMuP.Lock()
	defer SubsMuP.Unlock()

	if SubsP[boardID] == nil {
		SubsP[boardID] = map[chan *graph.Shape]struct{}{}
	}

	SubsP[boardID][ch] = struct{}{}
}

func Unsubscribe(boardID string, ch chan *graph.Shape) {
	SubsMuP.Lock()
	defer SubsMuP.Unlock()

	if subs, ok := SubsP[boardID]; ok {
		delete(subs, ch)
		close(ch)

		if len(subs) == 0 {
			delete(SubsP, boardID)
		}
	}
}
