export type InteractionMode =
  | { type: "idle"; selectedIds: string[] }
  | { type: "drag"; selectedIds: string[]; activeId: string }
  | { type: "resize"; selectedIds: string[]; activeId: string }
  | {
      type: "select";
      startWorldX: number;
      startWorldY: number;
      currentWorldX: number;
      currentWorldY: number;
      selectedIds: string[];
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | { type: "pan"; startX: number; startY: number; selectedIds: string[] };

export interface Point {
  x: number;
  y: number;
}
