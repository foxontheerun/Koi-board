package subscriptions

import (
	"testing"

	"server/graph"
)

func event(id string) *graph.ShapeEvent {
	return &graph.ShapeEvent{Type: graph.ShapeEventTypeCreated, Shape: &graph.Shape{ID: id}}
}

func drain(ch chan *graph.ShapeEvent) {
	for len(ch) > 0 {
		<-ch
	}
}

func TestPublishReachesEverySubscriber(t *testing.T) {
	a, b := NewChannel(), NewChannel()
	Subscribe("reach", a)
	Subscribe("reach", b)
	defer Unsubscribe("reach", a)
	defer Unsubscribe("reach", b)

	for i := 0; i < bufferSize; i++ {
		Publish("reach", event("s"))
	}

	if len(a) != bufferSize || len(b) != bufferSize {
		t.Fatalf("a buffer's worth of events should all arrive, got %d and %d", len(a), len(b))
	}
}

func TestSlowSubscriberIsDisconnectedNotSkipped(t *testing.T) {
	slow, healthy := NewChannel(), NewChannel()
	Subscribe("stall", slow)
	Subscribe("stall", healthy)
	defer Unsubscribe("stall", healthy)

	for i := 0; i < bufferSize; i++ {
		Publish("stall", event("s"))
	}
	drain(healthy)

	Publish("stall", event("overflow"))

	drain(slow)
	if _, open := <-slow; open {
		t.Fatal("a subscriber that overflows should be closed, not silently skipped")
	}
	if len(healthy) != 1 {
		t.Fatalf("a healthy subscriber should keep receiving, got %d events", len(healthy))
	}
}

func TestUnsubscribedChannelStopsReceiving(t *testing.T) {
	ch := NewChannel()
	Subscribe("gone", ch)
	Unsubscribe("gone", ch)

	Publish("gone", event("s"))

	if len(ch) != 0 {
		t.Fatalf("unsubscribed channel should receive nothing, got %d", len(ch))
	}
}
