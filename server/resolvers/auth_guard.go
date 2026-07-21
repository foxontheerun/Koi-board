package resolvers

import (
	"context"
	"errors"

	"server/auth"
)

var ErrUnauthenticated = errors.New("unauthenticated")

func requireUser(ctx context.Context) (string, error) {
	if id, ok := auth.UserIDFromContext(ctx); ok {
		return id, nil
	}
	return "", ErrUnauthenticated
}
