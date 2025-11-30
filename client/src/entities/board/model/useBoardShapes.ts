import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import throttle from "lodash/throttle";

import type { Shape } from "../../block/model/types";
import type {
  BoardQueryResponse,
  CreateShapeInput,
  ShapeInput,
  ShapeMovedSubscriptionResponse,
  ShapeUpdatedSubscriptionResponse,
  TransientShapeInput,
  UseBoardShapesResult,
} from "./types";

import {
  BOARD_QUERY,
  UPDATE_SHAPE_MUTATION,
  MOVE_SHAPE_TRANSIENT_MUTATION,
  SHAPE_MOVED_SUBSCRIPTION,
  SHAPE_UPDATED_SUBSCRIPTION,
} from "./board.gql";

import {
  applyMovedShape,
  applyUpdatedShape,
  toggleLockLocal,
  swapZIndexLocal,
} from "./shapeState";

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
    setShapes((current) => applyMovedShape(current, movedData));
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
    setShapes((current) => applyUpdatedShape(current, updatedData));
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
      const { nextShapes, nextLocked } = toggleLockLocal(current, id);
      if (nextLocked === null) return current;

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
      const {
        nextShapes,
        currentShapeId,
        neighborShapeId,
        currentZ,
        neighborZ,
      } = swapZIndexLocal(current, id, mode);

      if (!currentShapeId || !neighborShapeId) return current;

      updateShapeMutation({
        variables: {
          boardId,
          shape: {
            id: currentShapeId,
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
            id: neighborShapeId,
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

  const createShape = useCallback(
    async (input: CreateShapeInput) => {
      const newShape: Shape = {
        id: crypto.randomUUID(),
        boardId,
        type: input.type,
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        text: input.text ?? "",
        rotation: 0,
        zIndex: shapes.length,
        locked: false,
      };

      saveFinalPosition(newShape);
    },
    [boardId, shapes]
  );

  const deleteShape = (id: string) => {
    // пока только локальное удаление
    setShapes((prev) => prev.filter((s) => s.id !== id));
  };

  const resultError = useMemo(
    () => (error ? new Error(error.message) : null),
    [error]
  );

  return {
    shapes,
    loading,
    error: resultError,
    board: data?.board,
    broadcastTransientPosition,
    saveFinalPosition,
    changeZIndex,
    toggleLock,
    createShape,
    deleteShape,
  };
}
