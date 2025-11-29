import type { Shape } from "../../block/model/types";

export type UseBoardShapesResult = {
  shapes: Shape[];
  loading: boolean;
  error: Error | null;
  broadcastTransientPosition: (shape: Shape) => void;
  saveFinalPosition: (shape: Shape) => void;
  changeZIndex: (id: string, mode: "front" | "back") => void;
  toggleLock: (id: string) => void;
};
