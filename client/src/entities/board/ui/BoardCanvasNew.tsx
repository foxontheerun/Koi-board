import { useRef, useEffect } from "react";
import { BoardRuntime } from "../lib/BoardRuntime";
import type { CameraController } from "../lib/CameraController";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;

interface BoardCanvasNewProps {
  setCamera: (camera: CameraController) => void;
}

export function BoardCanvasNew({ setCamera }: BoardCanvasNewProps) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<BoardRuntime | null>(null);

  useEffect(() => {
    if (!gridCanvasRef.current || !mainCanvasRef.current) return;

    // Передаем оба канваса в рантайм
    runtimeRef.current = new BoardRuntime(
      gridCanvasRef.current,
      mainCanvasRef.current
    );
    setCamera(runtimeRef.current.camera);

    const observer = new ResizeObserver(() => {
      runtimeRef.current?.updateSize();
    });

    observer.observe(mainCanvasRef.current); // Следим за основным

    return () => {
      observer.disconnect();
      runtimeRef.current?.dispose();
    };
  }, [setCamera]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!runtimeRef.current) return;
    const rect = mainCanvasRef.current!.getBoundingClientRect();
    const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = runtimeRef.current.camera.zoom * factor;
    const clampedZoom = Math.min(
      MAX_ZOOM / 100,
      Math.max(MIN_ZOOM / 100, newZoom)
    );
    runtimeRef.current.camera.setZoom(clampedZoom, mouse);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50">
      {/* Слой 0: Сетка */}
      <canvas
        ref={gridCanvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full" // Сетка не должна ловить клики
      />
      {/* Слой 1: Фигуры и события */}
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 touch-none w-full h-full"
        onWheel={handleWheel}
      />
    </div>
  );
}
