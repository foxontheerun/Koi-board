package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/99designs/gqlgen/graphql/playground"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/cors"

	"server/auth"
	"server/boards"
	"server/db"
	"server/graph"
	"server/resolvers"
	"server/users"
)

const shutdownGrace = 10 * time.Second

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	resolver := &resolvers.Resolver{}
	var pool *pgxpool.Pool
	if cfg.databaseURL != "" {
		if err := db.Migrate(cfg.databaseURL); err != nil {
			log.Fatalf("db migrate: %v", err)
		}
		pool, err = db.Connect(context.Background(), cfg.databaseURL)
		if err != nil {
			log.Fatalf("db connect: %v", err)
		}
		defer pool.Close()
		resolver.DB = pool
		resolver.Users = users.NewPostgresStore(pool)
		resolver.Boards = boards.NewPostgresStore(pool)
		log.Println("connected to Postgres")
	} else {
		resolver.Users = users.NewMemoryStore()
		resolver.Boards = boards.NewMemoryStore()
		log.Println("DATABASE_URL not set - using in-memory storage")
	}

	if cfg.devNoAuth {
		id, err := ensureDevUser(context.Background(), resolver.Users)
		if err != nil {
			log.Fatalf("dev user: %v", err)
		}
		auth.EnableDevUser(id)
		log.Printf("DEV_NO_AUTH is on - every request without a token acts as %s", devUserEmail)
	}

	srv := handler.New(graph.NewExecutableSchema(graph.Config{
		Resolvers: resolver,
	}))

	srv.AddTransport(&transport.Websocket{
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return cfg.allowsOrigin(r.Header.Get("Origin"))
			},
		},
		InitFunc:              auth.WebsocketInit,
		KeepAlivePingInterval: 10 * time.Second,
	})

	srv.AddTransport(transport.Options{})
	srv.AddTransport(transport.GET{})
	srv.AddTransport(transport.POST{})

	c := cors.New(cors.Options{
		AllowedOrigins:   cfg.allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	})

	mux := http.NewServeMux()
	mux.Handle("/query", c.Handler(auth.Middleware(srv)))
	mux.HandleFunc("/healthz", health(pool))
	if cfg.playground {
		mux.Handle("/", playground.Handler("GraphQL playground", "/query"))
	}

	run(&http.Server{Addr: cfg.addr, Handler: mux}, cfg)
}

func run(server *http.Server, cfg config) {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("server started on %s (%s)", cfg.addr, cfg)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	<-ctx.Done()
	log.Println("shutting down")

	// Live websockets are hijacked connections, which Shutdown does not wait
	// for; the grace period covers in-flight HTTP requests, and the clients
	// behind the dropped sockets reconnect.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func health(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if pool != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(ctx); err != nil {
				http.Error(w, "database unreachable", http.StatusServiceUnavailable)
				return
			}
		}
		w.Write([]byte("ok"))
	}
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
