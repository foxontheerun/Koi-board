export type Tool = "pointer" | "rectangle" | "ellipse" | "text" | "hand" | "delete";

export type ShapeType = "RECT" | "ELLIPSE" | "TEXT";

export interface Shape {
  id: string;
  boardId: string;
  type: ShapeType;

  x: number;
  y: number;
  width: number;
  height: number;

  text?: string | null;

  rotation?: number;
  zIndex?: number;
  locked?: boolean;

  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  radius?: number;
}
