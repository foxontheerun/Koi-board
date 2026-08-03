export type Tool =
  | "pointer"
  | "sticker"
  | "rectangle"
  | "ellipse"
  | "text"
  | "hand"
  | "delete";

export type ShapeType = "RECT" | "ELLIPSE" | "TEXT" | "STICKER" | "GROUP";

export type TextAlign = "LEFT" | "CENTER" | "RIGHT";

export interface Shape {
  id: string;
  boardId: string;
  type: ShapeType;

  x: number;
  y: number;
  width: number;
  height: number;

  text?: string | null;
  fontSize?: number | null;
  fontWeight?: number | null;
  textAlign?: TextAlign | null;
  textColor?: string | null;
  textFormats?: string | null;

  rotation?: number;
  parentId?: string | null;
  orderKey?: string;
  locked?: boolean;

  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number | null;
  radius?: number;
}
