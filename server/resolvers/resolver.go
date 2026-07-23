package resolvers

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"server/boards"
	"server/users"
)

type Resolver struct {
	DB     *pgxpool.Pool
	Users  users.Store
	Boards boards.Store
}
