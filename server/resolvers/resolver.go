package resolvers

import "github.com/jackc/pgx/v5/pgxpool"

type Resolver struct {
	DB *pgxpool.Pool
}
