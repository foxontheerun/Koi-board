import {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { throttle } from "lodash";
import { type CameraController, BoardRuntime } from "../../canvas";
import type { RemoteCursor } from "../../canvas/types";
import type { _Shape } from "../../canvas/entities";
import type { TextStyle } from "../../canvas/core/ShapeCommands";
import {
  BOLD_FONT_WEIGHT,
  parseFormats,
} from "../../canvas/entities/shapes/text";
import { BoardSyncGateway } from "./model/BoardSyncGateway";
import type { ShapeType, StickyColorId, Tool } from "../Shape";
import type { EditingContextValue } from "./EditingContext";
import { SelectionToolbar } from "../../features/shape-context-menu/ui/SelectionToolbar";
import { RemoteCursorsLayer } from "../../features/presence/ui/RemoteCursorsLayer";
import {
  generateDisplayName,
  loadSavedDisplayName,
  saveDisplayName,
} from "../../features/presence/lib/displayName";
import { NamePlate } from "../../features/presence/ui/NamePlate";
import { useAuth } from "../../features/auth/model/AuthContext";
import { TextEditor } from "./textEditor/TextEditor";

export const MIN_ZOOM = 5;
export const MAX_ZOOM = 400;

// Constant screen-space gap between a shape and its floating toolbar.
const TOOLBAR_GAP = 12;

const LIVE_EDIT_INTERVAL = 300;

const toolToShapeType: Partial<Record<Tool, ShapeType>> = {
  sticker: "STICKER",
  rectangle: "RECT",
  ellipse: "ELLIPSE",
  text: "TEXT",
};

export interface BoardCanvasHandle {
  setShapeColor: (fill: string, stroke: string) => void;
}

interface BoardCanvasNewProps {
  boardId: string;
  setCamera: (camera: CameraController) => void;
  activeTool: Tool;
  activeStickyColor: StickyColorId;
  onToolComplete: () => void;
  onBoardNotFound?: () => void;
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
    onBoardNotFound,
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
    textStyle: TextStyle | null;
  } | null>(null);
  const [toolbar, setToolbar] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);
  const { user } = useAuth();
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const [camera, setLocalCamera] = useState<CameraController | null>(null);
  const [runtime, setRuntime] = useState<BoardRuntime | null>(null);
  const [displayName, setDisplayName] = useState(
    () =>
      loadSavedDisplayName() ??
      (user ? user.email.split("@")[0] : generateDisplayName()),
  );
  const pointerDownRef = useRef(false);

  const handleNameChange = useCallback((name: string) => {
    setDisplayName(name);
    saveDisplayName(name);
    gatewayRef.current?.setDisplayName(name);
  }, []);

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
    setRuntime(runtimeRef.current);
    gatewayRef.current = new BoardSyncGateway(
      boardId,
      runtimeRef.current,
      clientIdRef.current,
      displayName,
      onBoardNotFound,
    );

    // Typing reaches the other clients as it happens, not only on commit.
    const sendLiveEdit = throttle((shape: _Shape) => {
      gatewayRef.current?.sendPersisted(shape);
    }, LIVE_EDIT_INTERVAL);

    runtimeRef.current.setSyncCallbacks({
      onLocalShapeTransient: (shape) => {
        gatewayRef.current?.sendTransient(shape);
      },
      onLocalShapeLiveEdit: (shape) => {
        sendLiveEdit(shape);
      },
      onLocalShapePersisted: (shape) => {
        sendLiveEdit.cancel();
        gatewayRef.current?.sendPersisted(shape);
        onToolComplete?.();

        // A new text block is empty, so it is only visible once you type.
        if (shape.type === "TEXT" && !shape.text) {
          editingContextRef.current.startEditing({
            id: shape.id,
            text: "",
            formats: [],
          });
        }
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
            ? {
                ids,
                isLocked: runtimeRef.current?.areAllLocked(ids) ?? false,
                textStyle: runtimeRef.current?.getTextStyle(ids) ?? null,
              }
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
      sendLiveEdit.cancel();
      gatewayRef.current?.dispose();
      gatewayRef.current = null;
      runtimeRef.current = null;
      setRuntime(null);
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
    if (!shape || shape.locked || !runtime.canEditShape(shape.id)) return;

    // Write to editing context via stable ref — does not cause re-render of this component.
    editingContextRef.current.startEditing({
      id: shape.id,
      text: shape.text ?? "",
      formats: parseFormats(shape.textFormats),
      caretAt: { x: e.clientX, y: e.clientY },
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
        style={{ cursor: activeTool === "text" ? "text" : undefined }}
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
          runtimeRef.current?.handleMouseDown(e.clientX, e.clientY, e.shiftKey);
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

      {camera && runtime && <TextEditor runtime={runtime} camera={camera} />}

      {camera && <RemoteCursorsLayer cursors={cursors} camera={camera} />}

      <NamePlate name={displayName} onChange={handleNameChange} />

      {selection && toolbar?.visible && (
        <SelectionToolbar
          x={toolbar.x}
          y={toolbar.y}
          isLocked={selection.isLocked}
          textStyle={selection.textStyle}
          onTextStyleChange={(patch) => {
            // A selection inside the editor takes precedence; with nothing
            // selected the style applies to the whole shape, as before.
            const styled = editingContextRef.current.styleSelection({
              bold:
                patch.fontWeight === undefined
                  ? undefined
                  : patch.fontWeight >= BOLD_FONT_WEIGHT,
              fontSize: patch.fontSize,
              color: patch.textColor,
            });

            if (styled) return;

            runtimeRef.current?.setTextStyle(selection.ids, patch);
            setSelection((current) =>
              current
                ? {
                    ...current,
                    textStyle:
                      runtimeRef.current?.getTextStyle(current.ids) ?? null,
                  }
                : current,
            );
          }}
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
