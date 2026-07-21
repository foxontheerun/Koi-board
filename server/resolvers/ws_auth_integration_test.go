package resolvers_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gorilla/websocket"

	"server/auth"
	"server/graph"
	"server/resolvers"
	"server/users"
)

// Spins up the real gqlgen handler with the WS InitFunc wired, then drives the
// graphql-transport-ws handshake to prove unauthenticated sockets are refused
// and authenticated ones are accepted.
func newWSTestServer() *httptest.Server {
	srv := handler.New(graph.NewExecutableSchema(graph.Config{Resolvers: &resolvers.Resolver{}}))
	srv.AddTransport(&transport.Websocket{
		Upgrader: websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
		InitFunc: auth.WebsocketInit,
	})
	return httptest.NewServer(srv)
}

func dialWS(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	d := websocket.Dialer{Subprotocols: []string{"graphql-transport-ws"}}
	conn, _, err := d.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	return conn
}

// initAck sends connection_init with the given params and reports whether the
// server replied with connection_ack (true) or closed the socket (false).
func initAck(t *testing.T, conn *websocket.Conn, params map[string]any) bool {
	t.Helper()
	if err := conn.WriteJSON(map[string]any{"type": "connection_init", "payload": params}); err != nil {
		t.Fatalf("write init: %v", err)
	}
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	var msg struct {
		Type string `json:"type"`
	}
	if err := conn.ReadJSON(&msg); err != nil {
		return false // socket closed → rejected
	}
	return msg.Type == "connection_ack"
}

func TestWebsocketAuthHandshake(t *testing.T) {
	ts := newWSTestServer()
	defer ts.Close()
	url := "ws" + strings.TrimPrefix(ts.URL, "http")

	u, err := users.Register("ws-int@koi.dev", "secret123")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	token, err := auth.GenerateAccessToken(u.ID)
	if err != nil {
		t.Fatalf("token: %v", err)
	}

	t.Run("no token is refused", func(t *testing.T) {
		conn := dialWS(t, url)
		defer conn.Close()
		if initAck(t, conn, map[string]any{}) {
			t.Fatal("expected the socket to be refused")
		}
	})

	t.Run("invalid token is refused", func(t *testing.T) {
		conn := dialWS(t, url)
		defer conn.Close()
		if initAck(t, conn, map[string]any{"authToken": "not.a.token"}) {
			t.Fatal("expected the socket to be refused")
		}
	})

	t.Run("valid token is accepted", func(t *testing.T) {
		conn := dialWS(t, url)
		defer conn.Close()
		if !initAck(t, conn, map[string]any{"authToken": token}) {
			t.Fatal("expected connection_ack")
		}
	})
}
