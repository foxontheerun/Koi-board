package auth

import (
	"net/http"
	"strings"
)

// Middleware extracts a Bearer token, verifies it, and injects the user id into
// the request context. Absent or invalid tokens pass through as anonymous —
// resolvers decide what actually requires authentication (see requireUser).
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if token := bearerToken(r); token != "" {
			if claims, err := ParseToken(token); err == nil {
				r = r.WithContext(WithUserID(r.Context(), claims.UserID))
			}
		}
		next.ServeHTTP(w, r)
	})
}

func bearerToken(r *http.Request) string {
	return StripBearer(r.Header.Get("Authorization"))
}

// StripBearer returns the token from a "Bearer <token>" header value, or "" if
// the value isn't a well-formed bearer credential.
func StripBearer(header string) string {
	parts := strings.SplitN(header, " ", 2)
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return strings.TrimSpace(parts[1])
	}
	return ""
}
