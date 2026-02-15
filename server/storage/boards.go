package storage

import (
	"server/graph"
	"sync"
)

var (
	BoardsMu sync.RWMutex

	Boards = map[string]*graph.Board{
		"1": defaultBoard1(),
		"2": defaultBoard2(),
	}
)

// --- helpers ---

func strPtr(s string) *string {
	return &s
}

func f64Ptr(f float64) *float64 {
	return &f
}

// --- default boards ---

func defaultBoard1() *graph.Board {
	return &graph.Board{
		ID:    "1",
		Title: "Моя первая доска",
		Shapes: []*graph.Shape{
			{
				ID:         "1",
				BoardID:    "1",
				Type:       graph.ShapeTypeRect,
				X:          200,
				Y:          150,
				Width:      180,
				Height:     120,
				Rotation:   0,
				ZIndex:     0,
				Locked:     false,
				Text:       nil,
				Fill:       strPtr("#f19742"),
				Stroke:      strPtr("#f3870b"),
				StrokeWidth: nil,
			},
			{
				ID:         "10",
				BoardID:    "2",
				Type:       graph.ShapeTypeRect,
				X:          500,
				Y:          200,
				Width:      150,
				Height:     150,
				Rotation:   0,
				ZIndex:     3,
				Locked:     false,
				Text:       strPtr("Круг"),
				Fill:       strPtr("#c0ff96b9"),
				Stroke:     strPtr("#9deb55ff"),
				StrokeWidth: f64Ptr(2),
			},
		},
	}
}

func defaultBoard2() *graph.Board {
	return &graph.Board{
		ID:    "2",
		Title: "Вторая доска",
		Shapes: []*graph.Shape{
			{
				ID:         "10",
				BoardID:    "2",
				Type:       graph.ShapeTypeRect,
				X:          300,
				Y:          200,
				Width:      150,
				Height:     150,
				Rotation:   0,
				ZIndex:     0,
				Locked:     false,
				Text:       strPtr("Круг"),
				Fill:       strPtr("#FFCC00"),
				Stroke:     strPtr("#000000"),
				StrokeWidth: f64Ptr(2),
			},
		},
	}
}
