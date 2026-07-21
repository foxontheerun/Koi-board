package auth

import "context"

type ctxKey struct{}

// WithUserID returns a context carrying the authenticated user id. Set by the
// HTTP/WS auth middleware once a token is verified.
func WithUserID(ctx context.Context, userID string) context.Context {
	return context.WithValue(ctx, ctxKey{}, userID)
}

// UserIDFromContext returns the authenticated user id, or ("", false) when the
// request is anonymous.
func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(ctxKey{}).(string)
	return id, ok && id != ""
}
