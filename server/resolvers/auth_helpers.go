package resolvers

import (
	"errors"

	"server/auth"
	"server/graph"
	"server/users"
)

var errBadCredentials = errors.New("invalid email or password")

func authPayload(u *users.User) (*graph.AuthPayload, error) {
	access, err := auth.GenerateAccessToken(u.ID)
	if err != nil {
		return nil, err
	}
	refresh, err := auth.GenerateRefreshToken(u.ID)
	if err != nil {
		return nil, err
	}
	return &graph.AuthPayload{
		AccessToken:  access,
		RefreshToken: refresh,
		User:         &graph.User{ID: u.ID, Email: u.Email},
	}, nil
}
