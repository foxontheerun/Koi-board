import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { type CameraController, BoardRuntime } from "../../canvas";
import { BoardSyncGateway } from "./model/BoardSyncGateway";
import type { ShapeType, StickyColorId, Tool } from "../Shape";
import type { EditingContextValue } from "./EditingContext";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;

const toolToShapeType: Partial<Record<Tool, ShapeType>> = {
  sticker: "STICKER",
  rectangle: "RECT",
  ellipse: "ELLIPSE",
};

export interface BoardCanvasHandle {
  setShapeColor: (fill: string, stroke: string) => void;
  commitText: (shapeId: string, text: string) => void;
}

interface BoardCanvasNewProps {
  boardId: string;
  setCamera: (camera: CameraController) => void;
  activeTool: Tool;
  activeStickyColor: StickyColorId;
  onToolComplete: () => void;
  editingContextRef: React.MutableRefObject<EditingContextValue>;
}

export const BoardCanvasNew = forwardRef<
  BoardCanvasHandle,
  BoardCanvasNewProps
>(function BoardCanvasNew(
  {
    boardId,
    setCamera,
    activeTool,
    activeStickyColor,
    onToolComplete,
    editingContextRef,
  },
  ref,
) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const runtimeRef = useRef<BoardRuntime | null>(null);
  const gatewayRef = useRef<BoardSyncGateway | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());

  useImperativeHandle(ref, () => ({
    setShapeColor: (fill: string, stroke: string) => {
      runtimeRef.current?.setActiveShapeColor(fill, stroke);
    },
    commitText: (shapeId: string, text: string) => {
      runtimeRef.current?.updateShapeText(shapeId, text);
    },
  }));

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.setActiveStickyColor(activeStickyColor);
    runtime.setCreationTool(toolToShapeType[activeTool] ?? null);
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

  const handleDblClick = (e: React.MouseEvent) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    const shape = runtime.findShapeAtScreen(e.clientX, e.clientY);
    if (!shape) return;

    const rect = runtime.getShapeScreenRect(shape);
    if (!rect) return;

    // Write to editing context via stable ref — does not cause re-render of this component.
    editingContextRef.current.startEditing({
      id: shape.id,
      screenX: rect.x,
      screenY: rect.y,
      screenW: rect.w,
      screenH: rect.h,
      text: shape.text ?? "",
    });
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
        className="absolute inset-0 touch-none w-full h-full"
        onWheel={handleWheel}
        onDoubleClick={handleDblClick}
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
        className="absolute inset-0 pointer-events-none w-full h-full"
      />
    </div>
  );
});
