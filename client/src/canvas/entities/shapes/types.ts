import type { Shape } from "../../../entities/Shape";
import type { _Shape } from "../EntityManager";

export type UseBoardShapesResult = {
  shapes: Shape[];
  loading: boolean;
  error: Error | null;
  board?: BoardGQL;
  broadcastTransientPosition: (shape: Shape) => void;
  saveFinalPosition: (shape: Shape) => void;
  changeZIndex: (id: string, mode: "front" | "back") => void;
  toggleLock: (id: string) => void;
  createShape: (input: CreateShapeInput) => void;
  deleteShape: (id: string) => void;
};

// types/graphql.ts

export interface BoardGQL {
  id: string;
  title: string;
  shapes: Shape[];
}

// Response types
export interface BoardQueryResponse {
  board: BoardGQL;
}

export interface ShapeMovedSubscriptionResponse {
  shapeMoved: {
    id: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    clientID: string;
  };
}

export type ShapeEventType = "CREATED" | "UPDATED" | "DELETED";

export interface ShapeEvent {
  type: ShapeEventType;
  shape: Shape;
  clientID: string;
}

export interface ShapeEventsSubscriptionResponse {
  shapeEvents: ShapeEvent;
}

// Mutation input types
export interface ShapeInput {
  id: string;
  type?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string | null;
  rotation?: number | null;
  zIndex?: number | null;
  locked?: boolean | null;
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
}

export interface TransientShapeInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CreateShapeInput = {
  type: Shape["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fill?: string;
  stroke?: string;
};

export type ResizeHandle =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export const ResizeHandles = {
  Top: "top",
  Bottom: "bottom",
  Left: "left",
  Right: "right",
  TopLeft: "top-left",
  TopRight: "top-right",
  BottomLeft: "bottom-left",
  BottomRight: "bottom-right",
} as const;
