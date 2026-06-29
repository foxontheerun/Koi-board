import type { ShapeType } from "../../../entities/Shape";

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
  state: "static" | "dragging" | "selected" | "remote-dragging";
  zIndex?: number;
  text?: string;
  locked?: boolean;
}
export interface ManipulationBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}
