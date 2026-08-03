package boards

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"server/db"
	"server/graph"
)

func ptrType(t graph.ShapeType) *graph.ShapeType { return &t }
func ptrF(v float64) *float64                    { return &v }
func ptrS(v string) *string                      { return &v }
func ptrI(v int) *int                            { return &v }

func newShape(id string) graph.ShapeInput {
	return graph.ShapeInput{
		ID:     id,
		Type:   ptrType(graph.ShapeTypeRect),
		X:      ptrF(10),
		Y:      ptrF(20),
		Width:  ptrF(100),
		Height: ptrF(80),
	}
}

func moveX(id string, x float64) graph.ShapeInput {
	return graph.ShapeInput{ID: id, X: ptrF(x)}
}

func runBoardStoreSuite(t *testing.T, s Store, ownerID, otherID string) {
	ctx := context.Background()

	b, err := s.Create(ctx, ownerID, "My Board")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if b.ID == "" {
		t.Fatal("expected a generated board id")
	}

	if list, _ := s.ListForUser(ctx, ownerID); len(list) != 1 || list[0].ID != b.ID {
		t.Fatalf("owner should see exactly their board, got %v", list)
	}
	if list, _ := s.ListForUser(ctx, otherID); len(list) != 0 {
		t.Fatalf("non-member should see no boards, got %d", len(list))
	}

	if _, err := s.Get(ctx, "missing-id", ownerID); !errors.Is(err, ErrBoardNotFound) {
		t.Fatalf("missing board: want ErrBoardNotFound, got %v", err)
	}

	if ok, err := s.HasAccess(ctx, b.ID, ownerID); err != nil || !ok {
		t.Fatalf("owner should have access: ok=%v err=%v", ok, err)
	}
	if ok, err := s.HasAccess(ctx, b.ID, otherID); err != nil || ok {
		t.Fatalf("stranger should be refused: ok=%v err=%v", ok, err)
	}
	if ok, err := s.HasAccess(ctx, b.ID, ""); err != nil || ok {
		t.Fatalf("anonymous should be refused: ok=%v err=%v", ok, err)
	}
	if _, err := s.HasAccess(ctx, "missing-id", ownerID); !errors.Is(err, ErrBoardNotFound) {
		t.Fatalf("access to a missing board: want ErrBoardNotFound, got %v", err)
	}

	if _, err := s.Get(ctx, b.ID, otherID); err != nil {
		t.Fatalf("open by link: %v", err)
	}
	if list, _ := s.ListForUser(ctx, otherID); len(list) != 1 {
		t.Fatalf("open-by-link should grant membership, got %d boards", len(list))
	}
	if ok, err := s.HasAccess(ctx, b.ID, otherID); err != nil || !ok {
		t.Fatalf("open-by-link should grant access: ok=%v err=%v", ok, err)
	}

	sh, created, err := s.UpsertShape(ctx, b.ID, newShape("s1"))
	if err != nil || !created {
		t.Fatalf("create shape: created=%v err=%v", created, err)
	}
	if sh.X != 10 || sh.Y != 20 {
		t.Fatalf("unexpected shape coords: x=%v y=%v", sh.X, sh.Y)
	}

	if _, created2, err := s.UpsertShape(ctx, b.ID, moveX("s1", 99)); err != nil || created2 {
		t.Fatalf("second upsert should update, not create: created=%v err=%v", created2, err)
	}

	board, err := s.Get(ctx, b.ID, ownerID)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if len(board.Shapes) != 1 {
		t.Fatalf("expected 1 shape, got %d", len(board.Shapes))
	}
	if board.Shapes[0].X != 99 || board.Shapes[0].Y != 20 {
		t.Fatalf("partial patch should move x and keep y, got x=%v y=%v", board.Shapes[0].X, board.Shapes[0].Y)
	}

	align := graph.TextAlignCenter
	if _, _, err := s.UpsertShape(ctx, b.ID, graph.ShapeInput{
		ID:         "s1",
		Text:       ptrS("hello"),
		FontSize:   ptrF(24),
		FontWeight: ptrI(700),
		TextAlign:  &align,
		TextColor:  ptrS("#FF0000"),
		TextFormats: ptrS(
			`[{"index":0,"length":2,"attributes":{"bold":true}}]`,
		),
	}); err != nil {
		t.Fatalf("patch text: %v", err)
	}
	if _, _, err := s.UpsertShape(ctx, b.ID, moveX("s1", 42)); err != nil {
		t.Fatalf("move after text: %v", err)
	}

	board, err = s.Get(ctx, b.ID, ownerID)
	if err != nil {
		t.Fatalf("reload after text: %v", err)
	}
	textShape := board.Shapes[0]
	if textShape.Text == nil || *textShape.Text != "hello" {
		t.Fatalf("text should survive an unrelated patch, got %v", textShape.Text)
	}
	if textShape.FontSize == nil || *textShape.FontSize != 24 {
		t.Fatalf("font size should survive an unrelated patch, got %v", textShape.FontSize)
	}
	if textShape.FontWeight == nil || *textShape.FontWeight != 700 {
		t.Fatalf("font weight should survive an unrelated patch, got %v", textShape.FontWeight)
	}
	if textShape.TextAlign == nil || *textShape.TextAlign != graph.TextAlignCenter {
		t.Fatalf("text align should survive an unrelated patch, got %v", textShape.TextAlign)
	}
	if textShape.TextColor == nil || *textShape.TextColor != "#FF0000" {
		t.Fatalf("text colour should survive an unrelated patch, got %v", textShape.TextColor)
	}
	if textShape.TextFormats == nil || !strings.Contains(*textShape.TextFormats, `"bold":true`) {
		t.Fatalf("text formats should survive an unrelated patch, got %v", textShape.TextFormats)
	}

	if _, _, err := s.UpsertShape(ctx, b.ID, graph.ShapeInput{
		ID:   "s1",
		Text: ptrS(""),
	}); err != nil {
		t.Fatalf("clear text: %v", err)
	}
	board, _ = s.Get(ctx, b.ID, ownerID)
	if cleared := board.Shapes[0].Text; cleared == nil || *cleared != "" {
		t.Fatalf("empty text should be stored, got %v", cleared)
	}

	del, err := s.DeleteShape(ctx, b.ID, "s1")
	if err != nil || len(del) != 1 {
		t.Fatalf("delete shape: del=%v err=%v", del, err)
	}
	if board, _ := s.Get(ctx, b.ID, ownerID); len(board.Shapes) != 0 {
		t.Fatal("shape should be gone after delete")
	}
	if del, err := s.DeleteShape(ctx, b.ID, "nope"); err != nil || len(del) != 0 {
		t.Fatalf("delete missing shape: want none, got (%v, %v)", del, err)
	}

	runShapeTreeSuite(t, s, b.ID, ownerID)
}

func child(id, parentID, orderKey string) graph.ShapeInput {
	in := newShape(id)
	in.ParentID = ptrS(parentID)
	in.OrderKey = ptrS(orderKey)
	return in
}

func shapeByID(board *graph.Board, id string) *graph.Shape {
	for _, sh := range board.Shapes {
		if sh.ID == id {
			return sh
		}
	}
	return nil
}

func runShapeTreeSuite(t *testing.T, s Store, boardID, userID string) {
	ctx := context.Background()

	group := newShape("g1")
	group.Type = ptrType(graph.ShapeTypeGroup)
	group.OrderKey = ptrS("V")
	if _, _, err := s.UpsertShape(ctx, boardID, group); err != nil {
		t.Fatalf("create group: %v", err)
	}
	for _, in := range []graph.ShapeInput{child("c1", "g1", "V"), child("c2", "g1", "k")} {
		if _, _, err := s.UpsertShape(ctx, boardID, in); err != nil {
			t.Fatalf("create child: %v", err)
		}
	}

	board, _ := s.Get(ctx, boardID, userID)
	c1 := shapeByID(board, "c1")
	if c1 == nil || c1.ParentID == nil || *c1.ParentID != "g1" {
		t.Fatalf("child should keep its parent, got %v", c1)
	}
	if c1.OrderKey != "V" {
		t.Fatalf("child should keep its order key, got %q", c1.OrderKey)
	}

	if _, _, err := s.UpsertShape(ctx, boardID, moveX("c1", 55)); err != nil {
		t.Fatalf("move child: %v", err)
	}
	board, _ = s.Get(ctx, boardID, userID)
	if moved := shapeByID(board, "c1"); moved.ParentID == nil || *moved.ParentID != "g1" {
		t.Fatalf("an unrelated patch should not detach a child, got %v", moved)
	}

	// The empty string is how a client says "root"; null still means "leave alone".
	if _, _, err := s.UpsertShape(ctx, boardID, graph.ShapeInput{ID: "c2", ParentID: ptrS("")}); err != nil {
		t.Fatalf("ungroup child: %v", err)
	}
	board, _ = s.Get(ctx, boardID, userID)
	if freed := shapeByID(board, "c2"); freed.ParentID != nil {
		t.Fatalf("empty parent should mean the root, got %v", freed.ParentID)
	}

	// A parent that no longer exists heals to the root rather than failing: the
	// sender cannot fix it, and a shape nobody can see is worse.
	if _, _, err := s.UpsertShape(ctx, boardID, child("c3", "gone", "V")); err != nil {
		t.Fatalf("unknown parent should be healed, not refused: %v", err)
	}
	board, _ = s.Get(ctx, boardID, userID)
	if healed := shapeByID(board, "c3"); healed == nil || healed.ParentID != nil {
		t.Fatalf("unknown parent should land at the root, got %v", healed)
	}

	if _, _, err := s.UpsertShape(ctx, boardID, graph.ShapeInput{ID: "g1", ParentID: ptrS("c1")}); !errors.Is(err, ErrShapeCycle) {
		t.Fatalf("a group under its own child: want ErrShapeCycle, got %v", err)
	}
	if _, _, err := s.UpsertShape(ctx, boardID, graph.ShapeInput{ID: "g1", ParentID: ptrS("g1")}); !errors.Is(err, ErrShapeCycle) {
		t.Fatalf("a group under itself: want ErrShapeCycle, got %v", err)
	}

	// Deleting a group takes its subtree, and every removed shape comes back so
	// the other clients can be told about all of them.
	if _, _, err := s.UpsertShape(ctx, boardID, child("c4", "c1", "V")); err != nil {
		t.Fatalf("create grandchild: %v", err)
	}
	deleted, err := s.DeleteShape(ctx, boardID, "g1")
	if err != nil {
		t.Fatalf("delete group: %v", err)
	}
	gone := map[string]bool{}
	for _, sh := range deleted {
		gone[sh.ID] = true
	}
	if len(deleted) != 3 || !gone["g1"] || !gone["c1"] || !gone["c4"] {
		t.Fatalf("deleting a group should return its whole subtree, got %v", gone)
	}
	board, _ = s.Get(ctx, boardID, userID)
	for _, id := range []string{"g1", "c1", "c4"} {
		if shapeByID(board, id) != nil {
			t.Fatalf("%s should be gone with its group", id)
		}
	}
	if shapeByID(board, "c2") == nil || shapeByID(board, "c3") == nil {
		t.Fatal("shapes outside the group should survive")
	}
}

func TestMemoryStoreBoards(t *testing.T) {
	runBoardStoreSuite(t, NewMemoryStore(), "owner-1", "other-1")
}

func TestPostgresStoreBoards(t *testing.T) {
	pool := testPool(t)
	owner := createTestUser(t, pool, "owner@t.dev")
	other := createTestUser(t, pool, "other@t.dev")
	runBoardStoreSuite(t, NewPostgresStore(pool), owner, other)
}

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to run Postgres integration tests")
	}
	if err := db.Migrate(url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := db.Connect(context.Background(), url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(context.Background(),
		`TRUNCATE users, boards, board_members, shapes RESTART IDENTITY CASCADE`,
	); err != nil {
		t.Fatalf("truncate: %v", err)
	}
	return pool
}

func createTestUser(t *testing.T, pool *pgxpool.Pool, email string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id::text`, email,
	).Scan(&id); err != nil {
		t.Fatalf("create test user: %v", err)
	}
	return id
}
