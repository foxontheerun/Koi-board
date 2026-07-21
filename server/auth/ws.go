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

// WebsocketInit authenticates a subscription connection from its init payload
// (Apollo's connectionParams). It accepts either an "Authorization: Bearer …"
// entry or a bare "authToken". Missing or invalid tokens reject the connection;
// a valid one injects the user id into the context every subscription resolver
// then sees.
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
