import type { Shape } from "../../block/model/types";
import type {
  ShapeEventsSubscriptionResponse,
  ShapeMovedSubscriptionResponse,
} from "./types";

export function applyMovedShape(
  current: Shape[],
  movedData?: ShapeMovedSubscriptionResponse
): Shape[] {
  const moved = movedData?.shapeMoved;
  if (!moved) return current;

  return current.map((s) =>
    s.id === moved.id
      ? {
          ...s,
          x: moved.x ?? s.x,
          y: moved.y ?? s.y,
          width: moved.width ?? s.width,
          height: moved.height ?? s.height,
        }
      : s
  );
}

export function applyShapeEvent(
  current: Shape[],
  eventsData?: ShapeEventsSubscriptionResponse
): Shape[] {
  const event = eventsData?.shapeEvents;
  if (!event) return current;

  const { type, shape } = event;
  if (!shape) return current;

  switch (type) {
    case "DELETED": {
      return current.filter((s) => s.id !== shape.id);
    }

    case "CREATED":
    case "UPDATED": {
      const index = current.findIndex((s) => s.id === shape.id);
      if (index === -1) {
        return [...current, shape];
      }

      const next = current.slice();
      next[index] = { ...next[index], ...shape };
      return next;
    }

    default:
      return current;
  }
}

export function toggleLockLocal(
  current: Shape[],
  id: string
): {
  nextShapes: Shape[];
  nextLocked: boolean | null;
} {
  const target = current.find((s) => s.id === id);
  if (!target) return { nextShapes: current, nextLocked: null };

  const nextLocked = !target.locked;

  return {
    nextLocked,
    nextShapes: current.map((s) =>
      s.id === id ? { ...s, locked: nextLocked } : s
    ),
  };
}

export function swapZIndexLocal(
  current: Shape[],
  id: string,
  mode: "front" | "back"
): {
  nextShapes: Shape[];
  currentShapeId?: string;
  neighborShapeId?: string;
  currentZ?: number;
  neighborZ?: number;
} {
  if (current.length <= 1) return { nextShapes: current };

  const sorted = [...current].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  const idx = sorted.findIndex((s) => s.id === id);
  if (idx === -1) return { nextShapes: current };

  const neighborIdx = mode === "front" ? idx + 1 : idx - 1;

  if (neighborIdx < 0 || neighborIdx >= sorted.length) {
    return { nextShapes: current };
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

  return {
    nextShapes,
    currentShapeId: currentShape.id,
    neighborShapeId: neighborShape.id,
    currentZ,
    neighborZ,
  };
}
