package auth

import (
	"context"
	"errors"

	"github.com/99designs/gqlgen/graphql/handler/transport"
)

var (
	ErrMissingToken = errors.New("missing auth token")
	ErrInvalidToken = errors.New("invalid auth token")
)

func WebsocketInit(ctx context.Context, initPayload transport.InitPayload) (context.Context, *transport.InitPayload, error) {
	token := StripBearer(initPayload.Authorization())
	if token == "" {
		token = initPayload.GetString("authToken")
	}
	if token == "" {
		return ctx, nil, ErrMissingToken
	}

	claims, err := ParseToken(token)
	if err != nil {
		return ctx, nil, ErrInvalidToken
	}

	return WithUserID(ctx, claims.UserID), nil, nil
}
