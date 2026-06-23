package locks

import (
	"sync"

	"server/graph"
)

var mu sync.RWMutex

var subscribers = make(map[string][]chan *graph.LockEvent)

func Subscribe(boardID string, ch chan *graph.LockEvent) {
	mu.Lock()
	defer mu.Unlock()

	subscribers[boardID] = append(subscribers[boardID], ch)
}

func Unsubscribe(boardID string, ch chan *graph.LockEvent) {
	mu.Lock()
	defer mu.Unlock()

	list := subscribers[boardID]
	if len(list) == 0 {
		return
	}

	newList := make([]chan *graph.LockEvent, 0, len(list))
	for _, c := range list {
		if c != ch {
			newList = append(newList, c)
		}
	}

	if len(newList) == 0 {
		delete(subscribers, boardID)
	} else {
		subscribers[boardID] = newList
	}
}

func Publish(boardID string, event *graph.LockEvent) {
	mu.RLock()
	defer mu.RUnlock()

	for _, ch := range subscribers[boardID] {
		select {
		case ch <- event:
		default:
		}
	}
}
