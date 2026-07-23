package boards

import (
	"context"
	"sync"

	"server/graph"
)

type MemoryStore struct {
	mu     sync.RWMutex
	boards map[string]*graph.Board
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{boards: map[string]*graph.Board{}}
}

func (s *MemoryStore) getOrCreate(boardID string) *graph.Board {
	board, ok := s.boards[boardID]
	if !ok {
		board = &graph.Board{ID: boardID, Title: "New Board", Shapes: []*graph.Shape{}}
		s.boards[boardID] = board
	}
	return board
}

func (s *MemoryStore) Get(_ context.Context, boardID, _ string) (*graph.Board, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.getOrCreate(boardID), nil
}

func (s *MemoryStore) UpsertShape(_ context.Context, boardID string, input graph.ShapeInput) (*graph.Shape, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	board := s.getOrCreate(boardID)

	for _, sh := range board.Shapes {
		if sh.ID == input.ID {
			applyShapePatch(sh, input)
			return sh, false, nil
		}
	}

	shape := &graph.Shape{ID: input.ID, BoardID: boardID}
	applyShapePatch(shape, input)
	board.Shapes = append(board.Shapes, shape)
	return shape, true, nil
}

func (s *MemoryStore) DeleteShape(_ context.Context, boardID, shapeID string) (*graph.Shape, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	board, ok := s.boards[boardID]
	if !ok {
		return nil, nil
	}

	remaining := make([]*graph.Shape, 0, len(board.Shapes))
	var deleted *graph.Shape
	for _, sh := range board.Shapes {
		if sh.ID == shapeID {
			deleted = sh
			continue
		}
		remaining = append(remaining, sh)
	}
	board.Shapes = remaining
	return deleted, nil
}
