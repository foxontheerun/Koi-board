package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"

	"server/auth"
	"server/boards"
	"server/db"
	"server/graph"
	"server/resolvers"
	"server/users"
)

func main() {
	resolver := &resolvers.Resolver{}
	if url := os.Getenv("DATABASE_URL"); url != "" {
		if err := db.Migrate(url); err != nil {
			log.Fatalf("db migrate: %v", err)
		}
		pool, err := db.Connect(context.Background(), url)
		if err != nil {
			log.Fatalf("db connect: %v", err)
		}
		defer pool.Close()
		resolver.DB = pool
		resolver.Users = users.NewPostgresStore(pool)
		resolver.Boards = boards.NewPostgresStore(pool)
		log.Println("📦 connected to Postgres")
	} else {
		resolver.Users = users.NewMemoryStore()
		resolver.Boards = boards.NewMemoryStore()
		log.Println("⚠️  DATABASE_URL not set — using in-memory storage")
	}

	if os.Getenv("DEV_NO_AUTH") == "1" {
		id, err := ensureDevUser(context.Background(), resolver.Users)
		if err != nil {
			log.Fatalf("dev user: %v", err)
		}
		auth.EnableDevUser(id)
		log.Printf("⚠️  DEV_NO_AUTH=1 — every request without a token acts as %s", devUserEmail)
	}

	// Создаём gqlgen-сервер
	srv := handler.New(graph.NewExecutableSchema(graph.Config{
		Resolvers: resolver,
	}))

	// Включаем WebSocket-транспорт с CheckOrigin = true
	srv.AddTransport(&transport.Websocket{
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// для дев-окружения можно так, в проде лучше ограничить
				return true
			},
		},
		InitFunc:              auth.WebsocketInit,
		KeepAlivePingInterval: 10 * time.Second,
	})

	// Остальные транспорты (HTTP)
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	// CORS, чтобы фронт (5173/5174) мог ходить на бэк
	c := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5173",
			"http://localhost:5174",
		},
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	// Маршруты
	http.Handle("/", playground.Handler("GraphQL playground", "/query"))
	http.Handle("/query", c.Handler(auth.Middleware(srv)))

	log.Println("🚀 server started at http://localhost:8080/")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

const (
	devUserEmail    = "dev@local"
	devUserPassword = "dev-password"
)

func ensureDevUser(ctx context.Context, store users.Store) (string, error) {
	if user, err := store.GetByEmail(ctx, devUserEmail, devUserPassword); err == nil {
		return user.ID, nil
	}

	user, err := store.Register(ctx, devUserEmail, devUserPassword)
	if err != nil {
		return "", err
	}
	return user.ID, nil
}
