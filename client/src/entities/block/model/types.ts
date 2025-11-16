export type BlockType = "rect" | "text";

export type IBlock = {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
};

export type Tool = "pointer" | "rectangle" | "text" | "hand" | "delete";

export interface Shape {
  id: string;
  type: "rectangle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
}
