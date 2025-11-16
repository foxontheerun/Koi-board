export type Tool = "pointer" | "rectangle" | "text" | "hand" | "delete";

export type ShapeType = "rectangle" | "text";

export interface Shape {
  id: string;
  boardId: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string | null;
}
