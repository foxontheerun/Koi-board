export type InteractionMode =
  | { type: "idle"; selectedId: string | null }
  | { type: "drag"; selectedId: string; activeId: string }
  | { type: "resize"; selectedId: string; activeId: string }
  | {
      type: "select";
      selectedId: string | null;
      startX: number;
      startY: number;
      currentX: number;
      currentY: number;
    }
  | { type: "pan"; selectedId: string | null; startX: number; startY: number };

export interface Point {
  x: number;
  y: number;
}
