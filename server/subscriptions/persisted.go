package subscriptions

import (
	"sync"

	"server/graph"
)

// Shape events carry state a client cannot recover on its own: a shape that
// appeared, a shape that is gone. Dropping one leaves the board silently wrong
// until a reload, so a subscriber that falls this far behind is disconnected
// instead - it reconnects and re-reads the board.
const bufferSize = 64

var mu sync.Mutex

var subscribers = make(map[string][]chan *graph.ShapeEvent)

func NewChannel() chan *graph.ShapeEvent {
	return make(chan *graph.ShapeEvent, bufferSize)
}

func Subscribe(boardID string, ch chan *graph.ShapeEvent) {
	mu.Lock()
	defer mu.Unlock()

	subscribers[boardID] = append(subscribers[boardID], ch)
}

func Unsubscribe(boardID string, ch chan *graph.ShapeEvent) {
	mu.Lock()
	defer mu.Unlock()

	remove(boardID, ch)
}

func Publish(boardID string, event *graph.ShapeEvent) {
	mu.Lock()
	defer mu.Unlock()

	var stalled []chan *graph.ShapeEvent
	for _, ch := range subscribers[boardID] {
		select {
		case ch <- event:
		default:
			stalled = append(stalled, ch)
		}
	}

	for _, ch := range stalled {
		remove(boardID, ch)
		close(ch)
	}
}

func remove(boardID string, ch chan *graph.ShapeEvent) {
	list := subscribers[boardID]
	if len(list) == 0 {
		return
	}

	kept := make([]chan *graph.ShapeEvent, 0, len(list))
	for _, c := range list {
		if c != ch {
			kept = append(kept, c)
		}
	}

	if len(kept) == 0 {
		delete(subscribers, boardID)
	} else {
		subscribers[boardID] = kept
	}
}
