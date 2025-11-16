package server

import (
	"context"
	"sync"
)

// ----- Простое "хранилище" в памяти -----

var boardsMu sync.RWMutex
var boards = map[string]*Board{
	"1": {
		ID:    "1",
		Title: "Моя первая доска",
		Shapes: []*Shape{
			{
				ID:      "1",
				BoardID: "1",
				Type:    "rectangle",
				X:       200,
				Y:       150,
				Width:   180,
				Height:  120,
				Text:    nil,
			},
			{
				ID:      "2",
				BoardID: "1",
				Type:    "text",
				X:       450,
				Y:       180,
				Width:   220,
				Height:  80,
				Text:    strPtr("Привет с бэкенда 👋"),
			},
		},
	},
}

func strPtr(s string) *string { return &s }

// ----- Pub/Sub для подписчиков shapeUpdated -----

var subsMu sync.Mutex

// по boardId храним список каналов-подписчиков
var shapeSubscribers = map[string][]chan *Shape{}

// отправка события всем подписчикам доски
func publishShapeUpdate(boardID string, shape *Shape) {
	subsMu.Lock()
	defer subsMu.Unlock()

	subs := shapeSubscribers[boardID]
	for _, ch := range subs {
		// неблокирующая отправка
		select {
		case ch <- shape:
		default:
		}
	}
}

// подписка: создаём канал и сохраняем его в map
func subscribeShape(boardID string) <-chan *Shape {
	ch := make(chan *Shape, 1)

	subsMu.Lock()
	shapeSubscribers[boardID] = append(shapeSubscribers[boardID], ch)
	subsMu.Unlock()

	return ch
}

// отписка: удаляем канал из map
func unsubscribeShape(boardID string, target <-chan *Shape) {
	subsMu.Lock()
	defer subsMu.Unlock()

	subs := shapeSubscribers[boardID]
	res := make([]chan *Shape, 0, len(subs))

	for _, ch := range subs {
		if ch != target {
			res = append(res, ch)
		}
	}
	shapeSubscribers[boardID] = res
}

// ----- Корневой Resolver -----

type Resolver struct{}

// Query returns QueryResolver implementation.
func (r *Resolver) Query() QueryResolver { return &queryResolver{r} }

// Mutation returns MutationResolver implementation.
func (r *Resolver) Mutation() MutationResolver { return &mutationResolver{r} }

// Subscription returns SubscriptionResolver implementation.
func (r *Resolver) Subscription() SubscriptionResolver {
	return &subscriptionResolver{r}
}

type queryResolver struct{ *Resolver }
type mutationResolver struct{ *Resolver }
type subscriptionResolver struct{ *Resolver }

// Hello is the resolver for the hello field.
func (r *queryResolver) Hello(ctx context.Context) (string, error) {
	return "Привет из Go + gqlgen!", nil
}

// Board is the resolver for the board field.
func (r *queryResolver) Board(ctx context.Context, id string) (*Board, error) {
	boardsMu.RLock()
	defer boardsMu.RUnlock()

	if b, ok := boards[id]; ok {
		return b, nil
	}
	return nil, nil
}

// UpdateShape is the resolver for the updateShape field.
func (r *mutationResolver) UpdateShape(ctx context.Context, boardID string, input ShapeInput) (*Shape, error) {
	boardsMu.Lock()
	defer boardsMu.Unlock()

	// найдём доску
	board, ok := boards[boardID]
	if !ok {
		// если нет - можно создать, но пока просто nil
		return nil, nil
	}

	// ищем shape по id
	var shape *Shape
	for _, s := range board.Shapes {
		if s.ID == input.ID {
			shape = s
			break
		}
	}

	// если не нашли - создаём новый
	if shape == nil {
		shape = &Shape{
			ID:      input.ID,
			BoardID: boardID,
		}
		board.Shapes = append(board.Shapes, shape)
	}

	// обновляем поля
	shape.Type = input.Type
	shape.X = input.X
	shape.Y = input.Y
	shape.Width = input.Width
	shape.Height = input.Height
	if input.Text != nil {
		shape.Text = input.Text
	}

	// рассылаем событие подписчикам
	publishShapeUpdate(boardID, shape)

	return shape, nil
}

// ShapeUpdated is the resolver for the shapeUpdated field.
func (r *subscriptionResolver) ShapeUpdated(ctx context.Context, boardID string) (<-chan *Shape, error) {
	// подписываемся
	shapeCh := subscribeShape(boardID)

	// при завершении контекста отписываемся и закрываем канал
	go func() {
		<-ctx.Done()
		unsubscribeShape(boardID, shapeCh)
	}()

	return shapeCh, nil
}
