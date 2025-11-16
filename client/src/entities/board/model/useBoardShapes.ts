import { useEffect, useMemo, useState } from "react";
import { gql } from "@apollo/client";
import type { Shape } from "../../block/model/types";
import { useMutation, useQuery } from "@apollo/client/react";

const BOARD_QUERY = gql`
  query GetBoard($id: ID!) {
    board(id: $id) {
      id
      title
      shapes {
        id
        boardId
        type
        x
        y
        width
        height
        text
      }
    }
  }
`;

const UPDATE_SHAPE_MUTATION = gql`
  mutation UpdateShape($boardId: ID!, $shape: ShapeInput!) {
    updateShape(boardId: $boardId, shape: $shape) {
      id
      boardId
      type
      x
      y
      width
      height
      text
    }
  }
`;

const SHAPE_UPDATED_SUBSCRIPTION = gql`
  subscription ShapeUpdated($boardId: ID!) {
    shapeUpdated(boardId: $boardId) {
      id
      boardId
      type
      x
      y
      width
      height
      text
    }
  }
`;

type UseBoardShapesResult = {
  shapes: Shape[];
  loading: boolean;
  error: Error | null;
  updateShape: (shape: Shape) => void;
};

export function useBoardShapes(boardId: string): UseBoardShapesResult {
  const [shapes, setShapes] = useState<Shape[]>([]);

  // 1. query: начальные данные
  const { data, loading, error, subscribeToMore } = useQuery(BOARD_QUERY, {
    variables: { id: boardId },
  });

  // 2. mutation: отправка изменений
  const [mutateShape] = useMutation(UPDATE_SHAPE_MUTATION);

  // когда пришёл ответ от query — кладём шейпы в state
  useEffect(() => {
    if (data?.board?.shapes) {
      setShapes(data.board.shapes);
    }
  }, [data]);

  // 3. subscription: слушаем обновления с сервера
  useEffect(() => {
    if (!boardId) return;

    const unsubscribe = subscribeToMore({
      document: SHAPE_UPDATED_SUBSCRIPTION,
      variables: { boardId },
      updateQuery: (prev, { subscriptionData }) => {
        const shape = subscriptionData.data?.shapeUpdated;
        if (!shape) return prev;

        // обновляем локальный state
        setShapes((current) => {
          const exists = current.some((s) => s.id === shape.id);
          if (exists) {
            return current.map((s) => (s.id === shape.id ? shape : s));
          }
          return [...current, shape];
        });

        return prev;
      },
    });

    return () => {
      unsubscribe();
    };
  }, [boardId, subscribeToMore]);

  const updateShape = (shape: Shape) => {
    setShapes((current) => current.map((s) => (s.id === shape.id ? shape : s)));

    // отправляем на бэк
    mutateShape({
      variables: {
        boardId,
        shape: {
          id: shape.id,
          type: shape.type,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          text: shape.text ?? null,
        },
      },
    }).catch((e) => {
      console.error("updateShape mutation error", e);
    });
  };

  const resultError = useMemo(
    () => (error ? new Error(error.message) : null),
    [error]
  );

  return {
    shapes,
    loading,
    error: resultError,
    updateShape,
  };
}
