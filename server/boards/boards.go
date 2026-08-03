package boards

import (
	"context"
	"errors"

	"server/graph"
)

var ErrBoardNotFound = errors.New("board not found")

type Store interface {
	Create(ctx context.Context, ownerID, title string) (*graph.Board, error)
	Get(ctx context.Context, boardID, userID string) (*graph.Board, error)
	// Answers whether a user may act on a board, without loading it. Get would
	// also answer, but it fetches every shape and joins the caller as a member
	// on the way - too much for a guard that runs on every mutation.
	HasAccess(ctx context.Context, boardID, userID string) (bool, error)
	ListForUser(ctx context.Context, userID string) ([]*graph.Board, error)
	UpsertShape(ctx context.Context, boardID string, input graph.ShapeInput) (*graph.Shape, bool, error)
	DeleteShape(ctx context.Context, boardID, shapeID string) (*graph.Shape, error)
}

func applyShapePatch(shape *graph.Shape, input graph.ShapeInput) {
	if input.Type != nil {
		shape.Type = *input.Type
	}
	if input.X != nil {
		shape.X = *input.X
	}
	if input.Y != nil {
		shape.Y = *input.Y
	}
	if input.Width != nil {
		shape.Width = *input.Width
	}
	if input.Height != nil {
		shape.Height = *input.Height
	}
	if input.Text != nil {
		shape.Text = input.Text
	}
	if input.FontSize != nil {
		shape.FontSize = input.FontSize
	}
	if input.FontWeight != nil {
		shape.FontWeight = input.FontWeight
	}
	if input.TextAlign != nil {
		shape.TextAlign = input.TextAlign
	}
	if input.TextColor != nil {
		shape.TextColor = input.TextColor
	}
	if input.TextFormats != nil {
		shape.TextFormats = input.TextFormats
	}
	if input.Rotation != nil {
		shape.Rotation = *input.Rotation
	}
	if input.ZIndex != nil {
		shape.ZIndex = *input.ZIndex
	}
	if input.Locked != nil {
		shape.Locked = *input.Locked
	}
	if input.Fill != nil {
		shape.Fill = input.Fill
	}
	if input.Stroke != nil {
		shape.Stroke = input.Stroke
	}
	if input.StrokeWidth != nil {
		shape.StrokeWidth = input.StrokeWidth
	}
}
