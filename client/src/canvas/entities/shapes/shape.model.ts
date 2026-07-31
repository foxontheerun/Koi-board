import type { ShapeType, TextAlign } from "../../../entities/Shape";

export interface _Shape {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth?: string;
  radius?: number;
  type?: ShapeType;
  state: "static" | "dragging" | "selected" | "remote-dragging" | "resizing";
  zIndex?: number;
  text?: string;
  fontSize?: number;
  fontWeight?: number;
  textAlign?: TextAlign;
  textColor?: string;
  locked?: boolean;
}
export interface ManipulationBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
