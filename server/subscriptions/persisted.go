package subscriptions

import (
	"sync"

	"server/graph"
)

var mu sync.RWMutex

var subscribers = make(map[string][]chan *graph.ShapeEvent)

func Subscribe(boardID string, ch chan *graph.ShapeEvent) {
	mu.Lock()
	defer mu.Unlock()

	subscribers[boardID] = append(subscribers[boardID], ch)
}

func Unsubscribe(boardID string, ch chan *graph.ShapeEvent) {
	mu.Lock()
	defer mu.Unlock()

	list := subscribers[boardID]
	if len(list) == 0 {
		return
	}

	newList := make([]chan *graph.ShapeEvent, 0, len(list))
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

func Publish(boardID string, event *graph.ShapeEvent) {
	mu.RLock()
	defer mu.RUnlock()

	for _, ch := range subscribers[boardID] {
		select {
		case ch <- event:
		default:
			// канал забит – пропускаем, чтобы не блокироваться
		}
	}
}
