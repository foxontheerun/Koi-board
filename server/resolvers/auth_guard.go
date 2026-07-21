package resolvers

import (
	"context"
	"errors"

	"server/auth"
)

// ErrUnauthenticated is returned by guards when a protected resolver is reached
// without a valid token.
var ErrUnauthenticated = errors.New("unauthenticated")

// requireUser returns the authenticated user id, or ErrUnauthenticated when the
// request is anonymous. Use at the top of resolvers that must not run for guests.
func requireUser(ctx context.Context) (string, error) {
	if id, ok := auth.UserIDFromContext(ctx); ok {
		return id, nil
	}
	return "", ErrUnauthenticated
}
