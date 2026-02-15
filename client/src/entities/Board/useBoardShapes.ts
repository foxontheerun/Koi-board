import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useSubscription } from "@apollo/client/react";
import throttle from "lodash/throttle";
import type {
  UseBoardShapesResult,
  BoardQueryResponse,
  ShapeMovedSubscriptionResponse,
  ShapeEventsSubscriptionResponse,
  TransientShapeInput,
  ShapeInput,
  CreateShapeInput,
} from "../../canvas";
import {
  applyMovedShape,
  applyShapeEvent,
  toggleLockLocal,
  swapZIndexLocal,
} from "../../canvas/entities";
import type { Shape } from "../Shape";
import {
  BOARD_QUERY,
  UPDATE_SHAPE_MUTATION,
  MOVE_SHAPE_TRANSIENT_MUTATION,
  DELETE_SHAPE_MUTATION,
  SHAPE_MOVED_SUBSCRIPTION,
  SHAPE_EVENTS_SUBSCRIPTION,
} from "./api/board.gql";

export function useBoardShapes(boardId: string): UseBoardShapesResult {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const clientIdRef = useRef<string>(crypto.randomUUID());

  const initialDataAppliedRef = useRef(false);

  const { data, loading, error } = useQuery<BoardQueryResponse>(BOARD_QUERY, {
    variables: { id: boardId },
  });

  useEffect(() => {
    initialDataAppliedRef.current = false;
  }, [boardId]);

  useEffect(() => {
    if (!data?.board?.shapes) return;

    if (initialDataAppliedRef.current) return;

    setShapes(data.board.shapes);
    initialDataAppliedRef.current = true;
  }, [data, boardId]);

  const [updateShapeMutation] = useMutation(UPDATE_SHAPE_MUTATION);
  const [moveShapeTransientMutation] = useMutation(
    MOVE_SHAPE_TRANSIENT_MUTATION,
  );
  const [deleteShapeMutation] = useMutation(DELETE_SHAPE_MUTATION);

  const { data: movedData } = useSubscription<ShapeMovedSubscriptionResponse>(
    SHAPE_MOVED_SUBSCRIPTION,
    {
      variables: { boardId },
      skip: !boardId,
    },
  );

  useEffect(() => {
    if (movedData?.shapeMoved?.clientID === clientIdRef.current) return;

    setShapes((current) => applyMovedShape(current, movedData));
  }, [movedData]);

  const { data: eventsData } = useSubscription<ShapeEventsSubscriptionResponse>(
    SHAPE_EVENTS_SUBSCRIPTION,
    {
      variables: { boardId },
      skip: !boardId,
    },
  );

  useEffect(() => {
    if (eventsData?.shapeEvents.clientID === clientIdRef.current) return;

    setShapes((current) => applyShapeEvent(current, eventsData));
  }, [eventsData]);

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
          clientID: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("moveShapeTransient mutation error", e);
      });
    }, 40),
  ).current;

  const rafIdRef = useRef<number | null>(null);
  const pendingShapeRef = useRef<Shape | null>(null);

  const broadcastTransientPosition = useCallback(
    (shape: Shape) => {
      pendingShapeRef.current = shape;

      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          const last = pendingShapeRef.current;
          if (!last) return;

          setShapes((current) =>
            current.map((s) => (s.id === last.id ? { ...s, ...last } : s)),
          );

          throttledTransient(last);
        });
      }
    },
    [throttledTransient],
  );

  const saveFinalPosition = useCallback((shape: Shape) => {
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
        clientID: clientIdRef.current,
      },
    }).catch((e) => {
      console.error("updateShape mutation error", e);
    });
  }, []);

  const toggleLock = useCallback((id: string) => {
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
          clientID: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("toggleLock mutation error", e);
      });

      return nextShapes;
    });
  }, []);

  const changeZIndex = useCallback((id: string, mode: "front" | "back") => {
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
          clientID: clientIdRef.current,
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
          clientID: clientIdRef.current,
        },
      }).catch((e) => {
        console.error("changeZIndex mutation error", e);
      });

      return nextShapes;
    });
  }, []);

  const createShape = useCallback(
    async (input: CreateShapeInput) => {
      const zIndex = [...shapes].sort(
        (a, b) => (b.zIndex || 1) - (a.zIndex || 1),
      )?.[0]?.zIndex;

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
        zIndex: (zIndex || 1) + 1,
        locked: false,
        fill: input.fill ?? "#c5ff5b",
        stroke: input.stroke ?? "#c5ff5b",
      };

      saveFinalPosition(newShape);
    },
    [boardId, shapes],
  );

  const deleteShape = useCallback(
    async (id: string) => {
      setShapes((current) => current.filter((s) => s.id !== id));

      try {
        await deleteShapeMutation({
          variables: {
            boardId,
            shapeId: id,
          },
        });
      } catch (e) {
        console.error("deleteShape mutation error", e);
      }
    },
    [boardId, deleteShapeMutation],
  );

  const resultError = useMemo(
    () => (error ? new Error(error.message) : null),
    [error],
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
