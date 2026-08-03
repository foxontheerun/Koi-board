package resolvers

import (
	"context"
	"errors"

	"server/auth"
)

var (
	ErrUnauthenticated = errors.New("unauthenticated")
	ErrForbidden       = errors.New("no access to this board")
)

func requireUser(ctx context.Context) (string, error) {
	if id, ok := auth.UserIDFromContext(ctx); ok {
		return id, nil
	}
	return "", ErrUnauthenticated
}

// Every operation naming a board goes through here. Authentication alone only
// answers "is this a user"; a board id is otherwise a bearer token, and a
// former member would keep access to a board they were removed from.
func (r *Resolver) requireBoardAccess(
	ctx context.Context,
	boardID string,
) (string, error) {
	userID, err := requireUser(ctx)
	if err != nil {
		return "", err
	}

	allowed, err := r.Boards.HasAccess(ctx, boardID, userID)
	if err != nil {
		return "", err
	}
	if !allowed {
		return "", ErrForbidden
	}

	return userID, nil
}
