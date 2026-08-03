package resolvers

import (
	"context"
	"errors"
	"testing"

	"server/auth"
	"server/boards"
	"server/graph"
)

func testResolver(t *testing.T) (*Resolver, string, *graph.Board) {
	t.Helper()

	r := &Resolver{Boards: boards.NewMemoryStore()}
	owner := "owner-1"
	board, err := r.Boards.Create(context.Background(), owner, "Board")
	if err != nil {
		t.Fatalf("create board: %v", err)
	}
	return r, owner, board
}

func asUser(id string) context.Context {
	return auth.WithUserID(context.Background(), id)
}

func TestTransientMutationsRequireBoardAccess(t *testing.T) {
	r, owner, board := testResolver(t)
	m := &mutationResolver{r}

	shape := graph.TransientShapeInput{ID: "s1"}

	if _, err := m.MoveShapeTransient(context.Background(), board.ID, shape, "c1"); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("anonymous move: want ErrUnauthenticated, got %v", err)
	}
	if _, err := m.MoveShapeTransient(asUser("stranger"), board.ID, shape, "c1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger move: want ErrForbidden, got %v", err)
	}
	if ok, err := m.MoveShapeTransient(asUser(owner), board.ID, shape, "c1"); err != nil || !ok {
		t.Fatalf("owner move: ok=%v err=%v", ok, err)
	}
}

func TestLockAndCursorRequireBoardAccess(t *testing.T) {
	r, owner, board := testResolver(t)
	m := &mutationResolver{r}

	if _, err := m.SetShapeLock(asUser("stranger"), board.ID, "s1", "c1", graph.LockActionAcquire); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger lock: want ErrForbidden, got %v", err)
	}
	if _, err := m.UpdateCursor(asUser("stranger"), board.ID, "c1", 1, 2, nil); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger cursor: want ErrForbidden, got %v", err)
	}
	if ok, err := m.SetShapeLock(asUser(owner), board.ID, "s1", "c1", graph.LockActionAcquire); err != nil || !ok {
		t.Fatalf("owner lock: ok=%v err=%v", ok, err)
	}
}

func TestSubscriptionsRequireBoardAccess(t *testing.T) {
	r, owner, board := testResolver(t)
	s := &subscriptionResolver{r}

	if _, err := s.ShapeEvents(asUser("stranger"), board.ID); !errors.Is(err, ErrForbidden) {
		t.Fatalf("stranger subscribe: want ErrForbidden, got %v", err)
	}
	if _, err := s.CursorsMoved(context.Background(), board.ID); !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("anonymous subscribe: want ErrUnauthenticated, got %v", err)
	}

	ctx, cancel := context.WithCancel(asUser(owner))
	defer cancel()
	if ch, err := s.ShapeEvents(ctx, board.ID); err != nil || ch == nil {
		t.Fatalf("owner subscribe: ch=%v err=%v", ch, err)
	}
}

func TestUnknownBoardIsNotFound(t *testing.T) {
	r, owner, _ := testResolver(t)
	m := &mutationResolver{r}

	_, err := m.MoveShapeTransient(asUser(owner), "missing-board", graph.TransientShapeInput{ID: "s1"}, "c1")
	if !errors.Is(err, boards.ErrBoardNotFound) {
		t.Fatalf("unknown board: want ErrBoardNotFound, got %v", err)
	}
}
