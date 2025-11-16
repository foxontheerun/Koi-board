package server

import (
	"context"
	"sync"
)

var (
	boardsMu sync.RWMutex
	boards   = map[string]*Board{
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
)

// Вспомогательная функция для создания указателя на строку
func strPtr(s string) *string {
	return &s
}

type Resolver struct{}

func (r *mutationResolver) UpdateShape(ctx context.Context, boardID string, shape ShapeInput, clientID string) (*Shape, error) {
	boardsMu.Lock()
	defer boardsMu.Unlock()

	// Находим или создаем доску
	board, exists := boards[boardID]
	if !exists {
		board = &Board{
			ID:     boardID,
			Title:  "New Board",
			Shapes: []*Shape{},
		}
		boards[boardID] = board
	}

	// Ищем существующую фигуру
	var foundShape *Shape
	for i, s := range board.Shapes {
		if s.ID == shape.ID {
			foundShape = board.Shapes[i]
			break
		}
	}

	// Если фигура не найдена, создаем новую
	if foundShape == nil {
		foundShape = &Shape{
			ID:      shape.ID,
			BoardID: boardID,
		}
		board.Shapes = append(board.Shapes, foundShape)
	}

	// Обновляем поля фигуры
	foundShape.Type = shape.Type
	foundShape.X = shape.X
	foundShape.Y = shape.Y
	foundShape.Width = shape.Width
	foundShape.Height = shape.Height
	foundShape.Text = shape.Text

	// Публикуем обновление
	publishShapeUpdate(boardID, foundShape)

	return foundShape, nil
}

func (r *queryResolver) Hello(ctx context.Context) (string, error) {
	return "Hello, world!", nil
}

func (r *queryResolver) Board(ctx context.Context, id string) (*Board, error) {
	boardsMu.RLock()
	defer boardsMu.RUnlock()
	
	if board, exists := boards[id]; exists {
		return board, nil
	}
	
	// Создаем новую доску, если не существует
	board := &Board{
		ID:     id,
		Title:  "New Board",
		Shapes: []*Shape{},
	}
	boards[id] = board
	return board, nil
}

func (r *subscriptionResolver) ShapeUpdated(ctx context.Context, boardID string) (<-chan *Shape, error) {
	ch := make(chan *Shape, 1)
	
	// Регистрируем подписку
	subscribeShape(boardID, ch)
	
	// Отписываемся при закрытии контекста
	go func() {
		<-ctx.Done()
		unsubscribeShape(boardID, ch)
	}()
	
	return ch, nil
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

// Механизм подписок
var (
	subscriptionsMu sync.RWMutex
	subscriptions   = make(map[string]map[chan *Shape]struct{})
)

func subscribeShape(boardID string, ch chan *Shape) {
	subscriptionsMu.Lock()
	defer subscriptionsMu.Unlock()
	
	if subscriptions[boardID] == nil {
		subscriptions[boardID] = make(map[chan *Shape]struct{})
	}
	subscriptions[boardID][ch] = struct{}{}
}

func unsubscribeShape(boardID string, ch chan *Shape) {
	subscriptionsMu.Lock()
	defer subscriptionsMu.Unlock()
	
	if subs, exists := subscriptions[boardID]; exists {
		delete(subs, ch)
		close(ch)
		
		if len(subs) == 0 {
			delete(subscriptions, boardID)
		}
	}
}

func publishShapeUpdate(boardID string, shape *Shape) {
	subscriptionsMu.RLock()
	defer subscriptionsMu.RUnlock()
	
	if subs, exists := subscriptions[boardID]; exists {
		for ch := range subs {
			select {
			case ch <- shape:
				// Успешно отправлено
			default:
				// Если канал полный, пропускаем
			}
		}
	}
}