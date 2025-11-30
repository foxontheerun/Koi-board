package storage

import (
	"sync"
	"server/graph"
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
				Fill:       strPtr("#dff2ffff"),
				Stroke:      strPtr("#8eadc2ff"),
				StrokeWidth: nil,
			},
			{
				ID:         "2",
				BoardID:    "1",
				Type:       graph.ShapeTypeText,
				X:          450,
				Y:          180,
				Width:      220,
				Height:     80,
				Rotation:   0,
				ZIndex:     1,
				Locked:     false,
				Text:       strPtr("Привет с бэкенда 👋"),
				Fill:       strPtr("#ff86aeff"),
				Stroke:     strPtr("#db2c75ff"),
				StrokeWidth: f64Ptr(2),
			},
			{
				ID:         "10",
				BoardID:    "2",
				Type:       graph.ShapeTypeEllipse,
				X:          300,
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
				Type:       graph.ShapeTypeEllipse,
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
