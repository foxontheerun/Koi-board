import { createContext, useContext } from "react";
import type { CameraController } from "../lib/CameraController";

export const CameraContext = createContext<CameraController | null>(null);

export const useCamera = () => {
  const camera = useContext(CameraContext);
  if (!camera) throw new Error("useCamera must be used inside CameraProvider");
  return camera;
};
