package users

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"server/db"
)

func runUserStoreSuite(t *testing.T, s Store) {
	ctx := context.Background()

	u, err := s.Register(ctx, "a@b.com", "secret123")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if u.ID == "" {
		t.Fatal("expected a generated id")
	}
	if u.PasswordHash == "" || u.PasswordHash == "secret123" {
		t.Fatal("password must be stored hashed, not in plaintext")
	}

	if _, err := s.Register(ctx, "a@b.com", "secret123"); !errors.Is(err, ErrAlreadyExists) {
		t.Fatalf("duplicate email: want ErrAlreadyExists, got %v", err)
	}

	got, err := s.GetByEmail(ctx, "a@b.com", "secret123")
	if err != nil {
		t.Fatalf("login with correct password: %v", err)
	}
	if got.ID != u.ID {
		t.Fatal("login returned a different user")
	}

	if _, err := s.GetByEmail(ctx, "a@b.com", "wrong"); !errors.Is(err, ErrWrongPassword) {
		t.Fatalf("wrong password: want ErrWrongPassword, got %v", err)
	}
	if _, err := s.GetByEmail(ctx, "nobody@b.com", "secret123"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown email: want ErrNotFound, got %v", err)
	}

	byID, err := s.GetByID(ctx, u.ID)
	if err != nil || byID.Email != "a@b.com" {
		t.Fatalf("get by id: %v", err)
	}
	if _, err := s.GetByID(ctx, "00000000-0000-0000-0000-000000000000"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown id: want ErrNotFound, got %v", err)
	}
}

func TestMemoryStore(t *testing.T) {
	runUserStoreSuite(t, NewMemoryStore())
}

func TestPostgresStore(t *testing.T) {
	pool := testPool(t)
	runUserStoreSuite(t, NewPostgresStore(pool))
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
