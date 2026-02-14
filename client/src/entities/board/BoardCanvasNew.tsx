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
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const runtimeRef = useRef<BoardRuntime | null>(null);

  useEffect(() => {
    if (
      !gridCanvasRef.current ||
      !mainCanvasRef.current ||
      !dragCanvasRef.current ||
      !overlayCanvasRef.current
    )
      return;

    runtimeRef.current = new BoardRuntime(
      gridCanvasRef.current,
      mainCanvasRef.current,
      dragCanvasRef.current,
      overlayCanvasRef.current,
    );

    setCamera(runtimeRef.current.camera);

    const observer = new ResizeObserver(() => {
      runtimeRef.current?.updateSize();
    });

    observer.observe(mainCanvasRef.current);

    return () => {
      observer.disconnect();
    };
  }, [setCamera]);

  const handleWheel = (e: React.WheelEvent) => {
    if (!runtimeRef.current) return;
    const rect = mainCanvasRef.current!.getBoundingClientRect();
    const mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = runtimeRef.current.camera.getScale() * factor;
    const clampedZoom = Math.min(
      MAX_ZOOM / 100,
      Math.max(MIN_ZOOM / 100, newZoom),
    );
    runtimeRef.current.camera.setZoom(clampedZoom, mouse);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-50">
      <canvas
        ref={gridCanvasRef}
        className="absolute inset-0 pointer-events-none w-full h-full"
      />
      <canvas
        ref={mainCanvasRef}
        className="absolute inset-0 touch-none w-full h-full"
      />
      <canvas
        ref={dragCanvasRef}
        onMouseUp={() => runtimeRef.current?.handleMouseUp()}
        className="absolute inset-0 touch-none w-full h-full  "
        onWheel={handleWheel}
        onMouseDown={(e) => {
          if (e.button === 2) {
            runtimeRef.current?.handlePanStart(e.clientX, e.clientY);
            return;
          }

          if (e.button === 0) {
            runtimeRef.current?.handleMouseDown(e.clientX, e.clientY);
          }
        }}
        onMouseMove={(e) =>
          runtimeRef.current?.handleMouseMove(e.clientX, e.clientY)
        }
        onContextMenu={(e) => e.preventDefault()}
      />
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none  w-full h-full "
      />
    </div>
  );
}
