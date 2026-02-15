import { useRef, useEffect } from "react";
import { type CameraController, BoardRuntime } from "../../canvas";
import { BoardSyncGateway } from "./model/BoardSyncGateway";
import type { StickyColorId, Tool } from "../Shape";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;

interface BoardCanvasNewProps {
  boardId: string;
  setCamera: (camera: CameraController) => void;
  activeTool: Tool;
  activeStickyColor: StickyColorId;
  onToolComplete: () => void;
}

export function BoardCanvasNew({
  boardId,
  setCamera,
  activeTool,
  activeStickyColor,
  onToolComplete,
}: BoardCanvasNewProps) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const runtimeRef = useRef<BoardRuntime | null>(null);
  const gatewayRef = useRef<BoardSyncGateway | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.setActiveStickyColor(activeStickyColor);
    runtime.setCreationTool(activeTool === "rectangle" ? "RECT" : null);
  }, [activeStickyColor, activeTool]);

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
    gatewayRef.current = new BoardSyncGateway(
      boardId,
      runtimeRef.current,
      clientIdRef.current,
    );

    runtimeRef.current.setSyncCallbacks({
      onLocalShapeTransient: (shape) => {
        gatewayRef.current?.sendTransient(shape);
      },
      onLocalShapePersisted: (shape) => {
        console.log("onLocalShapePersisted", shape);

        gatewayRef.current?.sendPersisted(shape);
        onToolComplete?.();
      },
    });

    gatewayRef.current.connect().catch((error) => {
      console.error("Board sync init error", error);
    });

    const observer = new ResizeObserver(() => {
      runtimeRef.current?.updateSize();
    });

    observer.observe(mainCanvasRef.current);

    return () => {
      observer.disconnect();
      gatewayRef.current?.dispose();
      gatewayRef.current = null;
      runtimeRef.current = null;
    };
  }, [boardId, setCamera]);

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
