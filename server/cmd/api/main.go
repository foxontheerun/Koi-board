package main

import (
	"log"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"

	"server" 
)


func main() {
	srv := handler.NewDefaultServer(server.NewExecutableSchema(server.Config{
		Resolvers: &server.Resolver{},
	}))

	http.Handle("/", playground.Handler("GraphQL playground", "/query"))
	http.Handle("/query", srv)

	log.Println("🚀 server started at http://localhost:8080/")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
