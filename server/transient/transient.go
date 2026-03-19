package transient

import (
	"server/graph"
	"sync"
)

var (
	SubsMu    sync.RWMutex
	Subs      = map[string]map[chan *graph.TransientShape]struct{}{}
	BatchSubs = map[string]map[chan *graph.TransientShapesBatch]struct{}{}
)

// Single shape — kept for backward compatibility with shapeMoved subscription.
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

// Batch of shapes — used by shapesMoved subscription.
func PublishBatch(boardID string, batch *graph.TransientShapesBatch) {
	SubsMu.RLock()
	defer SubsMu.RUnlock()

	if subs, ok := BatchSubs[boardID]; ok {
		for ch := range subs {
			select {
			case ch <- batch:
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

func SubscribeBatch(boardID string, ch chan *graph.TransientShapesBatch) {
	SubsMu.Lock()
	defer SubsMu.Unlock()

	if BatchSubs[boardID] == nil {
		BatchSubs[boardID] = map[chan *graph.TransientShapesBatch]struct{}{}
	}
	BatchSubs[boardID][ch] = struct{}{}
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

func UnsubscribeBatch(boardID string, ch chan *graph.TransientShapesBatch) {
	SubsMu.Lock()
	defer SubsMu.Unlock()

	if subs, ok := BatchSubs[boardID]; ok {
		delete(subs, ch)
		close(ch)
		if len(subs) == 0 {
			delete(BatchSubs, boardID)
		}
	}
}