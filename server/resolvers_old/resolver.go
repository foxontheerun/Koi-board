package server

// THIS CODE WILL BE UPDATED WITH SCHEMA CHANGES. PREVIOUS IMPLEMENTATION FOR SCHEMA CHANGES WILL BE KEPT IN THE COMMENT SECTION. IMPLEMENTATION FOR UNCHANGED SCHEMA WILL BE KEPT.

import (
	"context"
)

type Resolver struct{}

// UpdateShape is the resolver for the updateShape field.
func (r *mutationResolver) UpdateShape(ctx context.Context, boardID string, shape ShapeInput, clientID string) (*Shape, error) {
	panic("not implemented")
}

// MoveShapeTransient is the resolver for the moveShapeTransient field.
func (r *mutationResolver) MoveShapeTransient(ctx context.Context, boardID string, shape TransientShapeInput, clientID string) (bool, error) {
	panic("not implemented")
}

// Board is the resolver for the board field.
func (r *queryResolver) Board(ctx context.Context, id string) (*Board, error) {
	panic("not implemented")
}

// Hello is the resolver for the hello field.
func (r *queryResolver) Hello(ctx context.Context) (string, error) {
	panic("not implemented")
}

// ShapeMoved is the resolver for the shapeMoved field.
func (r *subscriptionResolver) ShapeMoved(ctx context.Context, boardID string) (<-chan *TransientShape, error) {
	panic("not implemented")
}

// ShapeUpdated is the resolver for the shapeUpdated field.
func (r *subscriptionResolver) ShapeUpdated(ctx context.Context, boardID string) (<-chan *Shape, error) {
	panic("not implemented")
}

// Mutation returns MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Query returns QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

// Subscription returns SubscriptionResolver implementation.
func (r *Resolver) Subscription() SubscriptionResolver { return &subscriptionResolver{r} }

type mutationResolver struct{ *Resolver }
type queryResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }
