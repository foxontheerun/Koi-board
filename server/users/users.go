package users

import (
	"context"
	"errors"
	"sync"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID           string
	Email        string
	PasswordHash string
}

var (
	ErrNotFound      = errors.New("user not found")
	ErrAlreadyExists = errors.New("user already exists")
	ErrWrongPassword = errors.New("wrong password")
)

type Store interface {
	Register(ctx context.Context, email, password string) (*User, error)
	GetByEmail(ctx context.Context, email, password string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
}

func hashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

func checkPassword(hash, password string) error {
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return ErrWrongPassword
	}
	return nil
}

type MemoryStore struct {
	mu    sync.RWMutex
	store map[string]*User
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{store: map[string]*User{}}
}

func (s *MemoryStore) Register(_ context.Context, email, password string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.store[email]; ok {
		return nil, ErrAlreadyExists
	}

	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}

	user := &User{ID: uuid.NewString(), Email: email, PasswordHash: hash}
	s.store[email] = user
	return user, nil
}

func (s *MemoryStore) GetByEmail(_ context.Context, email, password string) (*User, error) {
	s.mu.RLock()
	user, ok := s.store[email]
	s.mu.RUnlock()

	if !ok {
		return nil, ErrNotFound
	}
	if err := checkPassword(user.PasswordHash, password); err != nil {
		return nil, err
	}
	return user, nil
}

func (s *MemoryStore) GetByID(_ context.Context, id string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for _, u := range s.store {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, ErrNotFound
}
