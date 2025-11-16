package main

import (
	"log"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"

	"server"
)

func main() {
	// Создаём gqlgen-сервер
	srv := handler.New(server.NewExecutableSchema(server.Config{
		Resolvers: &server.Resolver{},
	}))

	// Включаем WebSocket-транспорт с CheckOrigin = true
	srv.AddTransport(&transport.Websocket{
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// для дев-окружения можно так, в проде лучше ограничить
				return true
			},
		},
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
	http.Handle("/query", c.Handler(srv))

	log.Println("🚀 server started at http://localhost:8080/")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
