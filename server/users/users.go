package users

import (
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
	mu    sync.RWMutex
	store = map[string]*User{} // email → User
)

var (
	ErrNotFound       = errors.New("user not found")
	ErrAlreadyExists  = errors.New("user already exists")
	ErrWrongPassword  = errors.New("wrong password")
)

func Register(email, password string) (*User, error) {
	mu.Lock()
	defer mu.Unlock()

	if _, ok := store[email]; ok {
		return nil, ErrAlreadyExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &User{
		ID:           uuid.NewString(),
		Email:        email,
		PasswordHash: string(hash),
	}

	store[email] = user
	return user, nil
}

func GetByEmail(email, password string) (*User, error) {
	mu.RLock()
	user, ok := store[email]
	mu.RUnlock()

	if !ok {
		return nil, ErrNotFound
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrWrongPassword
	}

	return user, nil
}

func GetByID(id string) (*User, error) {
	mu.RLock()
	defer mu.RUnlock()

	for _, u := range store {
		if u.ID == id {
			return u, nil
		}
	}

	return nil, ErrNotFound
}
