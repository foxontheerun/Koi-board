package resolvers

import (
	"context"
	"server/graph"
	"server/storage"
	"server/transient"
	"server/subscriptions"
)

func (r *mutationResolver) UpdateShape(ctx context.Context, boardID string, input graph.ShapeInput, clientID string) (*graph.Shape, error) {
	storage.BoardsMu.Lock()
	defer storage.BoardsMu.Unlock()

	board, exists := storage.Boards[boardID]
	if !exists {
		board = &graph.Board{
			ID:     boardID,
			Title:  "New Board",
			Shapes: []*graph.Shape{},
		}
		storage.Boards[boardID] = board
	}

	var existing *graph.Shape
	for _, s := range board.Shapes {
		if s.ID == input.ID {
			existing = s
			break
		}
	}

	if existing == nil {
		existing = &graph.Shape{
			ID:      input.ID,
			BoardID: boardID,
			Rotation: 0,
			ZIndex:   0,
			Locked:   false,
		}
		board.Shapes = append(board.Shapes, existing)
	}

	storage.ApplyShapePatch(existing, input)
	subscriptions.Publish(boardID, existing)

	return existing, nil
}

func (r *mutationResolver) MoveShapeTransient(ctx context.Context, boardID string, input graph.TransientShapeInput, clientID string) (bool, error) {
	transient.Publish(boardID, &graph.TransientShape{
		ID: input.ID,
		X:  input.X,
		Y:  input.Y,
	})
	return true, nil
}

func (r *queryResolver) Board(ctx context.Context, id string) (*graph.Board, error) {
	storage.BoardsMu.RLock()
	defer storage.BoardsMu.RUnlock()

	if board, ok := storage.Boards[id]; ok {
		return board, nil
	}

	board := &graph.Board{
		ID:     id,
		Title:  "New Board",
		Shapes: []*graph.Shape{},
	}
	storage.Boards[id] = board
	return board, nil
}

func (r *queryResolver) Hello(ctx context.Context) (string, error) {
	return "Hello, world!", nil
}

func (r *subscriptionResolver) ShapeMoved(ctx context.Context, boardID string) (<-chan *graph.TransientShape, error) {
	ch := make(chan *graph.TransientShape, 1)
	transient.Subscribe(boardID, ch)

	go func() {
		<-ctx.Done()
		transient.Unsubscribe(boardID, ch)
	}()

	return ch, nil
}

func (r *subscriptionResolver) ShapeUpdated(ctx context.Context, boardID string) (<-chan *graph.Shape, error) {
	ch := make(chan *graph.Shape, 1)
	subscriptions.Subscribe(boardID, ch)

	go func() {
		<-ctx.Done()
		subscriptions.Unsubscribe(boardID, ch)
	}()

	return ch, nil
}

// Mutation returns graph.MutationResolver implementation.
func (r *Resolver) Mutation() graph.MutationResolver { 
    return &mutationResolver{r} 
}

// Query returns graph.QueryResolver implementation.
func (r *Resolver) Query() graph.QueryResolver { 
    return &queryResolver{r} 
}

// Subscription returns graph.SubscriptionResolver implementation.
func (r *Resolver) Subscription() graph.SubscriptionResolver {
    return &subscriptionResolver{r}
}

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }