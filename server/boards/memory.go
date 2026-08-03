package boards

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"server/graph"
)

type MemoryStore struct {
	mu      sync.RWMutex
	boards  map[string]*graph.Board
	members map[string]map[string]bool
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		boards:  map[string]*graph.Board{},
		members: map[string]map[string]bool{},
	}
}

func (s *MemoryStore) addMember(boardID, userID string) {
	if userID == "" {
		return
	}
	if s.members[boardID] == nil {
		s.members[boardID] = map[string]bool{}
	}
	s.members[boardID][userID] = true
}

func (s *MemoryStore) Create(_ context.Context, ownerID, title string) (*graph.Board, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if title == "" {
		title = "New Board"
	}
	board := &graph.Board{ID: uuid.NewString(), Title: title, Shapes: []*graph.Shape{}}
	s.boards[board.ID] = board
	s.addMember(board.ID, ownerID)
	return board, nil
}

func (s *MemoryStore) Get(_ context.Context, boardID, userID string) (*graph.Board, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	board, ok := s.boards[boardID]
	if !ok {
		return nil, ErrBoardNotFound
	}
	s.addMember(boardID, userID)
	return board, nil
}

func (s *MemoryStore) HasAccess(_ context.Context, boardID, userID string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, ok := s.boards[boardID]; !ok {
		return false, ErrBoardNotFound
	}

	return s.members[boardID][userID], nil
}

func (s *MemoryStore) ListForUser(_ context.Context, userID string) ([]*graph.Board, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := []*graph.Board{}
	for id, board := range s.boards {
		if s.members[id][userID] {
			out = append(out, &graph.Board{ID: board.ID, Title: board.Title})
		}
	}
	return out, nil
}

func (s *MemoryStore) UpsertShape(_ context.Context, boardID string, input graph.ShapeInput) (*graph.Shape, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	board, ok := s.boards[boardID]
	if !ok {
		return nil, false, ErrBoardNotFound
	}

	if input.ParentID != nil && *input.ParentID != "" {
		parent := *input.ParentID
		if !hasShape(board, parent) {
			// The parent is gone - most likely another client deleted the group
			// while this move was in flight. Put the shape at the root rather
			// than refuse: the sender cannot fix it, and a shape outside its
			// group is better than a shape nobody can see.
			root := ""
			input.ParentID = &root
		} else if wouldCycle(board, input.ID, parent) {
			return nil, false, ErrShapeCycle
		}
	}

	for _, sh := range board.Shapes {
		if sh.ID == input.ID {
			applyShapePatch(sh, input)
			return sh, false, nil
		}
	}

	shape := &graph.Shape{ID: input.ID, BoardID: boardID, OrderKey: defaultOrderKey}
	applyShapePatch(shape, input)
	board.Shapes = append(board.Shapes, shape)
	return shape, true, nil
}

func hasShape(board *graph.Board, id string) bool {
	for _, sh := range board.Shapes {
		if sh.ID == id {
			return true
		}
	}
	return false
}

func wouldCycle(board *graph.Board, shapeID, parentID string) bool {
	for at := parentID; at != ""; {
		if at == shapeID {
			return true
		}
		next := ""
		for _, sh := range board.Shapes {
			if sh.ID == at && sh.ParentID != nil {
				next = *sh.ParentID
			}
		}
		at = next
	}
	return false
}

func (s *MemoryStore) DeleteShape(_ context.Context, boardID, shapeID string) ([]*graph.Shape, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	board, ok := s.boards[boardID]
	if !ok {
		return nil, nil
	}
	if !hasShape(board, shapeID) {
		return nil, nil
	}

	// Postgres gets this from ON DELETE CASCADE; here it is done by hand, which
	// is exactly why the conformance suite checks both.
	doomed := map[string]bool{shapeID: true}
	for grew := true; grew; {
		grew = false
		for _, sh := range board.Shapes {
			if doomed[sh.ID] || sh.ParentID == nil || !doomed[*sh.ParentID] {
				continue
			}
			doomed[sh.ID] = true
			grew = true
		}
	}

	remaining := make([]*graph.Shape, 0, len(board.Shapes))
	deleted := make([]*graph.Shape, 0, len(doomed))
	for _, sh := range board.Shapes {
		if doomed[sh.ID] {
			deleted = append(deleted, sh)
			continue
		}
		remaining = append(remaining, sh)
	}
	board.Shapes = remaining
	return deleted, nil
}
