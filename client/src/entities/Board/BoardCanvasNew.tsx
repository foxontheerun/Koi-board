import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { type CameraController, BoardRuntime } from "../../canvas";
import type { RemoteCursor } from "../../canvas/types";
import { BoardSyncGateway } from "./model/BoardSyncGateway";
import type { ShapeType, StickyColorId, Tool } from "../Shape";
import type { EditingContextValue } from "./EditingContext";
import { SelectionToolbar } from "../../features/shape-context-menu/ui/SelectionToolbar";
import { RemoteCursorsLayer } from "../../features/presence/ui/RemoteCursorsLayer";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;

// Constant screen-space gap between a shape and its floating toolbar.
const TOOLBAR_GAP = 12;

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

  const [selection, setSelection] = useState<{
    ids: string[];
    isLocked: boolean;
  } | null>(null);
  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const [camera, setLocalCamera] = useState<CameraController | null>(null);
  const pointerDownRef = useRef(false);

  // Anchors the toolbar above the selection's current screen position.
  const showToolbar = useCallback(() => {
    const runtime = runtimeRef.current;
    const ids = runtime?.getSelectedIds() ?? [];
    if (!runtime || ids.length === 0) {
      setToolbar(null);
      return;
    }
    const rect = runtime.getSelectionScreenRect(ids);
    const canvas = dragCanvasRef.current?.getBoundingClientRect();
    if (!rect || !canvas) return;
    setToolbar({
      x: canvas.left + rect.x + rect.w / 2,
      y: canvas.top + rect.y - TOOLBAR_GAP,
      visible: true,
    });
  }, []);

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

    runtimeRef.current.setClientId(clientIdRef.current);
    setCamera(runtimeRef.current.camera);
    setLocalCamera(runtimeRef.current.camera);
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
      onLocalLock: (shapeId, action) => {
        gatewayRef.current?.sendLock(shapeId, action);
      },
      onLocalShapeDeleted: (shapeId) => {
        gatewayRef.current?.sendDelete(shapeId);
      },
      onSelectionChange: (ids) => {
        setSelection(
          ids.length > 0
            ? { ids, isLocked: runtimeRef.current?.areAllLocked(ids) ?? false }
            : null,
        );
      },
      onLocalCursor: (x, y) => {
        gatewayRef.current?.sendCursor(x, y);
      },
      onRemoteCursors: (next) => {
        setCursors(next);
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

  // Hide the toolbar while the camera is moving (pan/zoom); re-anchor it once
  // the scene is static again, like Miro.
  useEffect(() => {
    if (!selection) return;
    const camera = runtimeRef.current?.camera;
    if (!camera) return;

    let settleTimer: number;
    const onCameraChange = () => {
      setToolbar((current) =>
        current ? { ...current, visible: false } : current,
      );
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!pointerDownRef.current) showToolbar();
      }, 120);
    };

    const unsubscribe = camera.subscribe(onCameraChange);
    return () => {
      window.clearTimeout(settleTimer);
      unsubscribe();
    };
  }, [selection, showToolbar]);

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
        onMouseUp={() => {
          pointerDownRef.current = false;
          runtimeRef.current?.handleMouseUp();
          showToolbar();
        }}
        className="absolute inset-0 touch-none w-full h-full"
        onWheel={handleWheel}
        onDoubleClick={handleDblClick}
        onMouseDown={(e) => {
          if (e.button !== 0 && e.button !== 2) return;
          pointerDownRef.current = true;
          setToolbar((current) =>
            current ? { ...current, visible: false } : current,
          );
          if (e.button === 2) {
            runtimeRef.current?.handlePanStart(e.clientX, e.clientY);
            return;
          }
          runtimeRef.current?.handleMouseDown(e.clientX, e.clientY);
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

      {camera && <RemoteCursorsLayer cursors={cursors} camera={camera} />}

      {selection && toolbar?.visible && (
        <SelectionToolbar
          x={toolbar.x}
          y={toolbar.y}
          isLocked={selection.isLocked}
          onBringToFront={() => runtimeRef.current?.bringToFront(selection.ids)}
          onMoveForward={() => runtimeRef.current?.moveForward(selection.ids)}
          onMoveBackward={() => runtimeRef.current?.moveBackward(selection.ids)}
          onSendToBack={() => runtimeRef.current?.sendToBack(selection.ids)}
          onToggleLock={() => runtimeRef.current?.toggleLock(selection.ids)}
          onDelete={() => runtimeRef.current?.deleteShapes(selection.ids)}
        />
      )}
    </div>
  );
});
