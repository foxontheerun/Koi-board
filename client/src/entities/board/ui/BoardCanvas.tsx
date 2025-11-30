import { useRef, useState } from "react";
import { ContextMenu } from "../../../features/shape-context-menu/ui/ContextMenu";
import type { Tool } from "../../block/model/types";
import { useBoardShapes } from "../model/useBoardShapes";
import { calculateZoomTransform } from "../../../shared/lib/zoom";
import { useGridSystem } from "../model/useGridSystem";
import {
  ResizableDraggableShape,
  ShapeBlock,
  TextBlock,
  EllipseBlock,
} from "../../block";

interface BoardCanvasProps {
  boardId: string;
  activeTool: Tool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  setActiveTool: (tool: Tool) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 400;

export function BoardCanvas({
  boardId,
  zoom,
  onZoomChange,
  activeTool,
}: BoardCanvasProps) {
  const {
    shapes,
    loading,
    error,
    broadcastTransientPosition,
    saveFinalPosition,
    changeZIndex,
    toggleLock,
    createShape,
    deleteShape,
  } = useBoardShapes(boardId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [draftShape, setDraftShape] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const creationStartRef = useRef<{ x: number; y: number } | null>(null);

  const zoomScale = zoom / 100;
  const gridStyles = useGridSystem(zoomScale);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const skipCenteringRef = useRef(false);

  const handleShapeClick = (id: string) => {
    setSelectedId(id);
    setContextMenu(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Создаём фигуру только если клик по пустому фону
    if (e.target !== e.currentTarget) return;

    // Только для инструментов создания
    if (activeTool !== "rectangle" && activeTool !== "text") return;

    const rect = e.currentTarget.getBoundingClientRect();

    // координаты клика в системe доски (до scale)
    const boardX = (e.clientX - rect.left) / zoomScale;
    const boardY = (e.clientY - rect.top) / zoomScale;

    creationStartRef.current = { x: boardX, y: boardY };
    setIsCreating(true);

    // начальный draft — точка, ширина/высота 0
    setDraftShape({
      x: boardX,
      y: boardY,
      width: 0,
      height: 0,
    });

    // при начале создания сбрасываем выделение / контекстное меню
    setSelectedId(null);
    setContextMenu(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCreating || !creationStartRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const boardX = (e.clientX - rect.left) / zoomScale;
    const boardY = (e.clientY - rect.top) / zoomScale;

    const start = creationStartRef.current;

    const dx = boardX - start.x;
    const dy = boardY - start.y;

    const x = dx >= 0 ? start.x : start.x + dx;
    const y = dy >= 0 ? start.y : start.y + dy;
    const width = Math.abs(dx);
    const height = Math.abs(dy);

    setDraftShape({
      x,
      y,
      width,
      height,
    });
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCreating || !creationStartRef.current) return;

    const start = creationStartRef.current;

    const defaultWidth = activeTool === "text" ? 160 : 120;
    const defaultHeight = activeTool === "text" ? 40 : 80;

    let x: number;
    let y: number;
    let width: number;
    let height: number;

    // если юзер просто кликнул, без реального драг-чего
    if (!draftShape || draftShape.width < 4 || draftShape.height < 4) {
      x = start.x - defaultWidth / 2;
      y = start.y - defaultHeight / 2;
      width = defaultWidth;
      height = defaultHeight;
    } else {
      x = draftShape.x;
      y = draftShape.y;
      width = draftShape.width;
      height = draftShape.height;
    }

    if (activeTool === "rectangle" || activeTool === "text") {
      createShape({
        type: activeTool === "rectangle" ? "RECT" : "TEXT",
        x,
        y,
        width,
        height,
        text: activeTool === "text" ? "New text" : undefined,
      });
    }

    setIsCreating(false);
    setDraftShape(null);
    creationStartRef.current = null;
    // setActiveTool("pointer");
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setSelectedId(id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();

    const mouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const zoomScale = zoom / 100;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

    const newScale = zoomScale * zoomFactor;

    let newZoomPercent = Math.round(newScale * 100);
    newZoomPercent = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoomPercent));

    if (newZoomPercent === zoom) {
      return;
    }

    const clampedScale = newZoomPercent / 100;

    const { offset: newOffset } = calculateZoomTransform({
      mouse,
      zoom: zoomScale,
      offset,
      zoomFactor: clampedScale / zoomScale,
    });

    skipCenteringRef.current = true;

    setOffset(newOffset);
    onZoomChange(newZoomPercent);
  };

  const handleBringToFront = () => {
    if (!selectedId) return;
    changeZIndex(selectedId, "front");
    setContextMenu(null);
  };

  const handleSendToBack = () => {
    if (!selectedId) return;
    changeZIndex(selectedId, "back");
    setContextMenu(null);
  };

  const handleToggleLock = () => {
    if (!selectedId) return;
    toggleLock(selectedId);
    setContextMenu(null);
  };

  const handleDeleteClick = () => {
    if (!selectedId) return;
    deleteShape(selectedId);
    setSelectedId(null);
    setContextMenu(null);
  };

  const selectedShape = shapes.find((s) => s.id === selectedId);
  const isSelectedLocked = !!selectedShape?.locked;

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        Загружаем доску…
      </div>
    );
  if (error)
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Ошибка: {error.message}
      </div>
    );

  const orderedShapes = [...shapes].sort(
    (a, b) => (a?.zIndex ?? 0) - (b?.zIndex ?? 0)
  );

  return (
    <div className="flex-1 relative overflow-hidden" onWheel={handleWheel}>
      <div className="absolute inset-8 bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="absolute inset-0" style={gridStyles} />
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`,
            transformOrigin: "0 0",
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {draftShape &&
            (activeTool === "rectangle" || activeTool === "text") && (
              <div
                className="pointer-events-none border-2 border-dashed border-blue-500/80 bg-blue-500/5"
                style={{
                  position: "absolute",
                  left: draftShape.x,
                  top: draftShape.y,
                  width: draftShape.width,
                  height: draftShape.height,
                }}
              />
            )}

          {orderedShapes.map((shape) => (
            <ResizableDraggableShape
              key={shape.id}
              shape={shape}
              zoom={zoom}
              isSelected={selectedId === shape.id}
              onDragLocal={(next) => broadcastTransientPosition(next)}
              onDragEnd={(next) => saveFinalPosition(next)}
              onClick={() => handleShapeClick(shape.id)}
              onContextMenu={(e) => handleContextMenu(e, shape.id)}
            >
              {(() => {
                switch (shape.type) {
                  case "RECT":
                    return <ShapeBlock shape={shape} />;

                  case "TEXT":
                    return <TextBlock shape={shape} />;

                  case "ELLIPSE":
                    return <EllipseBlock shape={shape} />;

                  default:
                    return null;
                }
              })()}
            </ResizableDraggableShape>
          ))}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onToggleLock={handleToggleLock}
          isLocked={isSelectedLocked}
          onDeleteClick={handleDeleteClick}
        />
      )}
    </div>
  );
}
