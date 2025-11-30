import { useEffect, useMemo, useRef, useState } from "react";
import { gql } from "@apollo/client";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import throttle from "lodash/throttle";
import type { Shape } from "../../block/model/types";
import type {
  BoardQueryResponse,
  ShapeInput,
  ShapeMovedSubscriptionResponse,
  ShapeUpdatedSubscriptionResponse,
  TransientShapeInput,
  UseBoardShapesResult,
} from "./types";

// ------------ GQL ------------- //

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
        rotation
        zIndex
        locked
        fill
        stroke
        strokeWidth
      }
    }
  }
`;

const UPDATE_SHAPE_MUTATION = gql`
  mutation UpdateShape($boardId: ID!, $shape: ShapeInput!, $clientId: ID!) {
    updateShape(boardId: $boardId, shape: $shape, clientId: $clientId) {
      id
      boardId
      type

      x
      y
      width
      height

      text
      rotation
      zIndex
      locked
      fill
      stroke
      strokeWidth
    }
  }
`;

const MOVE_SHAPE_TRANSIENT_MUTATION = gql`
  mutation MoveShapeTransient(
    $boardId: ID!
    $shape: TransientShapeInput!
    $clientId: ID!
  ) {
    moveShapeTransient(boardId: $boardId, shape: $shape, clientId: $clientId)
  }
`;

const SHAPE_MOVED_SUBSCRIPTION = gql`
  subscription ShapeMoved($boardId: ID!) {
    shapeMoved(boardId: $boardId) {
      id
      x
      y
      width
      height
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
      rotation
      zIndex
      locked
      fill
      stroke
      strokeWidth
    }
  }
`;

export function useBoardShapes(boardId: string): UseBoardShapesResult {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const clientIdRef = useRef<string>(crypto.randomUUID());

  const { data, loading, error } = useQuery<BoardQueryResponse>(BOARD_QUERY, {
    variables: { id: boardId },
  });

  const [updateShapeMutation] = useMutation(UPDATE_SHAPE_MUTATION);
  const [moveShapeTransientMutation] = useMutation(
    MOVE_SHAPE_TRANSIENT_MUTATION
  );

  useEffect(() => {
    if (data?.board?.shapes) {
      setShapes(data.board.shapes);
    }
  }, [data]);

  const { data: movedData } = useSubscription<ShapeMovedSubscriptionResponse>(
    SHAPE_MOVED_SUBSCRIPTION,
    {
      variables: { boardId },
      skip: !boardId,
    }
  );

  useEffect(() => {
    const moved = movedData?.shapeMoved;
    if (!moved) return;

    setShapes((current) =>
      current.map((s) =>
        s.id === moved.id
          ? {
              ...s,
              x: moved.x ?? s.x,
              y: moved.y ?? s.y,
              width: moved.width ?? s.width,
              height: moved.height ?? s.height,
            }
          : s
      )
    );
  }, [movedData]);

  const { data: updatedData } =
    useSubscription<ShapeUpdatedSubscriptionResponse>(
      SHAPE_UPDATED_SUBSCRIPTION,
      {
        variables: { boardId },
        skip: !boardId,
      }
    );

  useEffect(() => {
    const updated = updatedData?.shapeUpdated;
    if (!updated) return;

    setShapes((current) => {
      const exists = current.some((s) => s.id === updated.id);
      if (exists) {
        return current.map((s) => (s.id === updated.id ? updated : s));
      }
      return [...current, updated];
    });
  }, [updatedData]);

  const throttledTransient = useRef(
    throttle((shape: Shape) => {
      moveShapeTransientMutation({
        variables: {
          boardId,
          shape: {
            id: shape.id,
            x: shape.x,
            y: shape.y,
            width: shape.width,
            height: shape.height,
          } as TransientShapeInput,
          clientId: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("moveShapeTransient mutation error", e);
      });
    }, 40)
  ).current;

  const broadcastTransientPosition = (shape: Shape) => {
    setShapes((current) =>
      current.map((s) => (s.id === shape.id ? { ...s, ...shape } : s))
    );

    throttledTransient(shape);
  };

  const saveFinalPosition = (shape: Shape) => {
    setShapes((current) => current.map((s) => (s.id === shape.id ? shape : s)));

    updateShapeMutation({
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
          rotation: shape.rotation ?? 0,
          zIndex: shape.zIndex ?? 0,
          locked: shape.locked ?? false,
          fill: shape.fill ?? null,
          stroke: shape.stroke ?? null,
          strokeWidth: shape.strokeWidth ?? null,
        } as ShapeInput,
        clientId: clientIdRef.current,
      },
    }).catch((e) => {
      console.error("updateShape mutation error", e);
    });
  };

  const toggleLock = (id: string) => {
    setShapes((current) => {
      const target = current.find((s) => s.id === id);
      if (!target) return current;

      const nextLocked = !target.locked;

      const nextShapes = current.map((s) =>
        s.id === id ? { ...s, locked: nextLocked } : s
      );

      updateShapeMutation({
        variables: {
          boardId,
          shape: {
            id,
            locked: nextLocked,
          } as ShapeInput,
          clientId: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("toggleLock mutation error", e);
      });

      return nextShapes;
    });
  };

  const changeZIndex = (id: string, mode: "front" | "back") => {
    setShapes((current) => {
      if (current.length <= 1) return current;

      const sorted = [...current].sort(
        (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
      );

      const idx = sorted.findIndex((s) => s.id === id);
      if (idx === -1) return current;

      const neighborIdx = mode === "front" ? idx + 1 : idx - 1;

      if (neighborIdx < 0 || neighborIdx >= sorted.length) {
        return current;
      }

      const currentShape = sorted[idx];
      const neighborShape = sorted[neighborIdx];

      const currentZ = currentShape.zIndex ?? 0;
      const neighborZ = neighborShape.zIndex ?? 0;

      const nextShapes = current.map((s) => {
        if (s.id === currentShape.id) {
          return { ...s, zIndex: neighborZ };
        }
        if (s.id === neighborShape.id) {
          return { ...s, zIndex: currentZ };
        }
        return s;
      });

      updateShapeMutation({
        variables: {
          boardId,
          shape: {
            id: currentShape.id,
            zIndex: neighborZ,
          } as ShapeInput,
          clientId: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("changeZIndex mutation error", e);
      });

      updateShapeMutation({
        variables: {
          boardId,
          shape: {
            id: neighborShape.id,
            zIndex: currentZ,
          } as ShapeInput,
          clientId: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("changeZIndex mutation error", e);
      });

      return nextShapes;
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
    broadcastTransientPosition,
    saveFinalPosition,
    changeZIndex,
    toggleLock,
  };
}
