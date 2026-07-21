package auth

import (
	"context"
	"testing"

	"github.com/99designs/gqlgen/graphql/handler/transport"
)

func TestWebsocketInit(t *testing.T) {
	token, err := GenerateAccessToken("user-1")
	if err != nil {
		t.Fatalf("token: %v", err)
	}

	t.Run("missing token is rejected", func(t *testing.T) {
		if _, _, err := WebsocketInit(context.Background(), transport.InitPayload{}); err == nil {
			t.Fatal("expected rejection, got nil")
		}
	})

	t.Run("invalid token is rejected", func(t *testing.T) {
		if _, _, err := WebsocketInit(context.Background(), transport.InitPayload{"authToken": "not.a.token"}); err == nil {
			t.Fatal("expected rejection, got nil")
		}
	})

	t.Run("valid authToken is accepted and carries the user id", func(t *testing.T) {
		ctx, _, err := WebsocketInit(context.Background(), transport.InitPayload{"authToken": token})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if id, ok := UserIDFromContext(ctx); !ok || id != "user-1" {
			t.Fatalf("want user-1, got %q (ok=%v)", id, ok)
		}
	})

	t.Run("valid Bearer authorization is accepted", func(t *testing.T) {
		ctx, _, err := WebsocketInit(context.Background(), transport.InitPayload{"Authorization": "Bearer " + token})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if id, _ := UserIDFromContext(ctx); id != "user-1" {
			t.Fatalf("want user-1, got %q", id)
		}
	})
}

func TestStripBearer(t *testing.T) {
	cases := []struct{ in, want string }{
		{"Bearer abc", "abc"},
		{"bearer abc", "abc"},
		{"Bearer  abc ", "abc"},
		{"abc", ""},
		{"", ""},
		{"Basic abc", ""},
	}
	for _, c := range cases {
		if got := StripBearer(c.in); got != c.want {
			t.Errorf("StripBearer(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
