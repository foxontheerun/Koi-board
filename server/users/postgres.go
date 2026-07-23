package users

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) Register(ctx context.Context, email, password string) (*User, error) {
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}

	var user User
	err = s.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash)
		 VALUES ($1, $2)
		 RETURNING id::text, email, password_hash`,
		email, hash,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrAlreadyExists
		}
		return nil, err
	}
	return &user, nil
}

func (s *PostgresStore) GetByEmail(ctx context.Context, email, password string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, email, password_hash
		 FROM users
		 WHERE lower(email) = lower($1)`,
		email,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if err := checkPassword(user.PasswordHash, password); err != nil {
		return nil, err
	}
	return &user, nil
}

func (s *PostgresStore) GetByID(ctx context.Context, id string) (*User, error) {
	var user User
	err := s.pool.QueryRow(ctx,
		`SELECT id::text, email, password_hash
		 FROM users
		 WHERE id::text = $1`,
		id,
	).Scan(&user.ID, &user.Email, &user.PasswordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &user, nil
}
