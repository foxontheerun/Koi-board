package boards

import (
	"context"
	"errors"

	"github.com/google/uuid"
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

const shapeColumns = `id, board_id, type, x, y, width, height, rotation, z_index, locked, text, font_size, font_weight, text_align, text_color, text_formats, fill, stroke, stroke_width`

func scanShape(row pgx.Row) (*graph.Shape, error) {
	var sh graph.Shape
	var shapeType string
	var textAlign *string
	if err := row.Scan(
		&sh.ID, &sh.BoardID, &shapeType, &sh.X, &sh.Y, &sh.Width, &sh.Height,
		&sh.Rotation, &sh.ZIndex, &sh.Locked, &sh.Text, &sh.FontSize, &sh.FontWeight,
		&textAlign, &sh.TextColor, &sh.TextFormats, &sh.Fill, &sh.Stroke, &sh.StrokeWidth,
	); err != nil {
		return nil, err
	}
	sh.Type = graph.ShapeType(shapeType)
	sh.TextAlign = toTextAlign(textAlign)
	return &sh, nil
}

func toTextAlign(value *string) *graph.TextAlign {
	if value == nil {
		return nil
	}
	align := graph.TextAlign(*value)
	return &align
}

func fromTextAlign(value *graph.TextAlign) *string {
	if value == nil {
		return nil
	}
	text := string(*value)
	return &text
}

func (s *PostgresStore) Create(ctx context.Context, ownerID, title string) (*graph.Board, error) {
	if title == "" {
		title = "New Board"
	}
	id := uuid.NewString()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx,
		`INSERT INTO boards (id, title, owner_id) VALUES ($1, $2, $3)`,
		id, title, ownerID,
	); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
		id, ownerID,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &graph.Board{ID: id, Title: title, Shapes: []*graph.Shape{}}, nil
}

func (s *PostgresStore) ListForUser(ctx context.Context, userID string) ([]*graph.Board, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT b.id, b.title
		 FROM boards b
		 JOIN board_members m ON m.board_id = b.id
		 WHERE m.user_id = $1
		 ORDER BY b.updated_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []*graph.Board{}
	for rows.Next() {
		var b graph.Board
		if err := rows.Scan(&b.ID, &b.Title); err != nil {
			return nil, err
		}
		b.Shapes = []*graph.Shape{}
		out = append(out, &b)
	}
	return out, rows.Err()
}

func (s *PostgresStore) HasAccess(ctx context.Context, boardID, userID string) (bool, error) {
	var member bool
	err := s.pool.QueryRow(ctx,
		`SELECT EXISTS (
		   SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2
		 ) AND EXISTS (
		   SELECT 1 FROM boards WHERE id = $1
		 )`,
		boardID, userID,
	).Scan(&member)
	if err != nil {
		return false, err
	}

	if !member {
		// Tell "no such board" apart from "not yours": the first is a dead
		// link, the second is a refusal.
		var exists bool
		if err := s.pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM boards WHERE id = $1)`, boardID,
		).Scan(&exists); err != nil {
			return false, err
		}
		if !exists {
			return false, ErrBoardNotFound
		}
	}

	return member, nil
}

func (s *PostgresStore) Get(ctx context.Context, boardID, userID string) (*graph.Board, error) {
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

	if userID != "" {
		if _, err := s.pool.Exec(ctx,
			`INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'editor') ON CONFLICT DO NOTHING`,
			boardID, userID,
		); err != nil {
			return nil, err
		}
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
	var outAlign *string
	var created bool
	err := s.pool.QueryRow(ctx,
		`INSERT INTO shapes (id, board_id, type, x, y, width, height, rotation, z_index, locked, text, font_size, font_weight, text_align, text_color, text_formats, fill, stroke, stroke_width)
		 VALUES ($1, $2, COALESCE($3, ''), COALESCE($4, 0), COALESCE($5, 0), COALESCE($6, 0), COALESCE($7, 0),
		         COALESCE($8, 0), COALESCE($9, 0), COALESCE($10, false), $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
		     font_size = COALESCE($12, shapes.font_size),
		     font_weight = COALESCE($13, shapes.font_weight),
		     text_align = COALESCE($14, shapes.text_align),
		     text_color = COALESCE($15, shapes.text_color),
		     text_formats = COALESCE($16, shapes.text_formats),
		     fill = COALESCE($17, shapes.fill),
		     stroke = COALESCE($18, shapes.stroke),
		     stroke_width = COALESCE($19, shapes.stroke_width),
		     updated_at = now()
		 RETURNING `+shapeColumns+`, (xmax = 0)`,
		input.ID, boardID, shapeType, input.X, input.Y, input.Width, input.Height,
		input.Rotation, input.ZIndex, input.Locked, input.Text, input.FontSize,
		input.FontWeight, fromTextAlign(input.TextAlign), input.TextColor,
		input.TextFormats, input.Fill, input.Stroke, input.StrokeWidth,
	).Scan(
		&sh.ID, &sh.BoardID, &outType, &sh.X, &sh.Y, &sh.Width, &sh.Height,
		&sh.Rotation, &sh.ZIndex, &sh.Locked, &sh.Text, &sh.FontSize, &sh.FontWeight,
		&outAlign, &sh.TextColor, &sh.TextFormats, &sh.Fill, &sh.Stroke, &sh.StrokeWidth, &created,
	)
	if err != nil {
		return nil, false, err
	}
	sh.Type = graph.ShapeType(outType)
	sh.TextAlign = toTextAlign(outAlign)
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
