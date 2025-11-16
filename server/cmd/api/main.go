package main

import (
	"log"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/rs/cors"

	"server"
)

func main() {
	srv := handler.NewDefaultServer(server.NewExecutableSchema(server.Config{
		Resolvers: &server.Resolver{},
	}))

	// Включаем WebSocket для gqlgen
	srv.AddTransport(transport.Websocket{
		KeepAlivePingInterval: 0,
	})

	// Включаем обычные POST запросы
	srv.AddTransport(transport.POST{})
	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})

	// CORS, чтобы фронт мог обращаться
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
