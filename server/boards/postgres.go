package boards

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"server/graph"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

const shapeColumns = `id, board_id, type, x, y, width, height, rotation, z_index, locked, text, fill, stroke, stroke_width`

func scanShape(row pgx.Row) (*graph.Shape, error) {
	var sh graph.Shape
	var shapeType string
	if err := row.Scan(
		&sh.ID, &sh.BoardID, &shapeType, &sh.X, &sh.Y, &sh.Width, &sh.Height,
		&sh.Rotation, &sh.ZIndex, &sh.Locked, &sh.Text, &sh.Fill, &sh.Stroke, &sh.StrokeWidth,
	); err != nil {
		return nil, err
	}
	sh.Type = graph.ShapeType(shapeType)
	return &sh, nil
}

func (s *PostgresStore) Get(ctx context.Context, boardID, ownerID string) (*graph.Board, error) {
	if ownerID != "" {
		if _, err := s.pool.Exec(ctx,
			`INSERT INTO boards (id, owner_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
			boardID, ownerID,
		); err != nil {
			return nil, err
		}
	}

	var board graph.Board
	err := s.pool.QueryRow(ctx,
		`SELECT id, title FROM boards WHERE id = $1`, boardID,
	).Scan(&board.ID, &board.Title)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrBoardNotFound
		}
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+shapeColumns+` FROM shapes WHERE board_id = $1 ORDER BY z_index`, boardID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	board.Shapes = []*graph.Shape{}
	for rows.Next() {
		shape, err := scanShape(rows)
		if err != nil {
			return nil, err
		}
		board.Shapes = append(board.Shapes, shape)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return &board, nil
}

func (s *PostgresStore) UpsertShape(ctx context.Context, boardID string, input graph.ShapeInput) (*graph.Shape, bool, error) {
	var shapeType *string
	if input.Type != nil {
		t := string(*input.Type)
		shapeType = &t
	}

	var sh graph.Shape
	var outType string
	var created bool
	err := s.pool.QueryRow(ctx,
		`INSERT INTO shapes (id, board_id, type, x, y, width, height, rotation, z_index, locked, text, fill, stroke, stroke_width)
		 VALUES ($1, $2, COALESCE($3, ''), COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0), COALESCE($7, 0),
		         COALESCE($8, 0), COALESCE($9, 0), COALESCE($10, false), $11, $12, $13, $14)
		 ON CONFLICT (id) DO UPDATE SET
		     type = COALESCE($3, shapes.type),
		     x = COALESCE($4, shapes.x),
		     y = COALESCE($5, shapes.y),
		     width = COALESCE($6, shapes.width),
		     height = COALESCE($7, shapes.height),
		     rotation = COALESCE($8, shapes.rotation),
		     z_index = COALESCE($9, shapes.z_index),
		     locked = COALESCE($10, shapes.locked),
		     text = COALESCE($11, shapes.text),
		     fill = COALESCE($12, shapes.fill),
		     stroke = COALESCE($13, shapes.stroke),
		     stroke_width = COALESCE($14, shapes.stroke_width),
		     updated_at = now()
		 RETURNING `+shapeColumns+`, (xmax = 0)`,
		input.ID, boardID, shapeType, input.X, input.Y, input.Width, input.Height,
		input.Rotation, input.ZIndex, input.Locked, input.Text, input.Fill, input.Stroke, input.StrokeWidth,
	).Scan(
		&sh.ID, &sh.BoardID, &outType, &sh.X, &sh.Y, &sh.Width, &sh.Height,
		&sh.Rotation, &sh.ZIndex, &sh.Locked, &sh.Text, &sh.Fill, &sh.Stroke, &sh.StrokeWidth, &created,
	)
	if err != nil {
		return nil, false, err
	}
	sh.Type = graph.ShapeType(outType)
	return &sh, created, nil
}

func (s *PostgresStore) DeleteShape(ctx context.Context, boardID, shapeID string) (*graph.Shape, error) {
	shape, err := scanShape(s.pool.QueryRow(ctx,
		`DELETE FROM shapes WHERE id = $1 AND board_id = $2 RETURNING `+shapeColumns,
		shapeID, boardID,
	))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return shape, nil
}
