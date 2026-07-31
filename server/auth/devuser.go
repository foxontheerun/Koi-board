package auth

import "sync/atomic"

// Off by default and only ever enabled from cmd/api when DEV_NO_AUTH is set:
// with it on, any request without a token is treated as this user.
var devUserID atomic.Value

func EnableDevUser(id string) {
	devUserID.Store(id)
}

func DevUserID() string {
	id, _ := devUserID.Load().(string)
	return id
}
