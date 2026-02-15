import { useCallback, useRef, useState } from "react";
import { ContextMenu } from "../../features/shape-context-menu/ui/ContextMenu";
import { calculateZoomTransform } from "../../shared/lib/zoom";
import {
  STICKY_PRESETS,
  type Shape,
  type StickyColorId,
  type Tool,
} from "../Shape";
import { useBoardShapes } from "./useBoardShapes";
import { useGridSystem } from "./useGridSystem";

interface BoardCanvasProps {
  boardId: string;
  activeTool: Tool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  setActiveTool: (tool: Tool) => void;
  stickyColorId: StickyColorId;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 400;

export function BoardCanvas({
  boardId,
  zoom,
  onZoomChange,
  activeTool,
  stickyColorId,
  setActiveTool,
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

  // Получаем координаты в системе доски (shape.x / shape.y)
  // transform на внутреннем div: translate(offset) scale(zoomScale)
  // screen = zoomScale * (board + offset)
  const getBoardCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };

    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const boardX = (screenX - offset.x) / zoomScale;
    const boardY = (screenY - offset.y) / zoomScale;

    return { x: boardX, y: boardY };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "rectangle" && activeTool !== "text") return;

    const { x, y } = getBoardCoords(e);

    creationStartRef.current = { x, y };

    setDraftShape({
      x,
      y,
      width: 0,
      height: 0,
    });

    setSelectedId(null);
    setContextMenu(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!creationStartRef.current) return;

    const { x: boardX, y: boardY } = getBoardCoords(e);
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

  const handleCanvasMouseUp = () => {
    if (!creationStartRef.current) return;

    const start = creationStartRef.current;

    const defaultWidth = activeTool === "text" ? 160 : 120;
    const defaultHeight = activeTool === "text" ? 40 : 80;

    let x: number;
    let y: number;
    let width: number;
    let height: number;

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
      const preset = STICKY_PRESETS[stickyColorId];

      createShape({
        type: activeTool === "rectangle" ? "RECT" : "TEXT",
        x,
        y,
        width,
        height,
        text: activeTool === "text" ? "New text" : undefined,
        fill: activeTool === "rectangle" ? preset.fill : "#c5ff5b",
        stroke: activeTool === "rectangle" ? preset.stroke : "none",
      });
    }

    setDraftShape(null);
    creationStartRef.current = null;
    setActiveTool("pointer");
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouse = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const currentScale = zoom / 100;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = currentScale * zoomFactor;

    let newZoomPercent = Math.round(newScale * 100);
    newZoomPercent = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoomPercent));

    if (newZoomPercent === zoom) return;

    const clampedScale = newZoomPercent / 100;

    const { offset: newOffset } = calculateZoomTransform({
      mouse,
      zoom: currentScale,
      offset,
      zoomFactor: clampedScale / currentScale,
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

  const handleCopyClick = () => {};

  const handleCanvasClick = () => {
    setSelectedId(null);
    setContextMenu(null);
  };

  const handleShapeContextMenu = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedId(id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleShapeClickCb = useCallback(handleShapeClick, []);
  const handleShapeContextMenuCb = useCallback(handleShapeContextMenu, []);
  const handleTextChange = useCallback(
    (shape: Shape, text: string) => {
      saveFinalPosition({ ...shape, text });
    },
    [saveFinalPosition],
  );

  const selectedShape = shapes.find((s) => s.id === selectedId);
  const isSelectedLocked = !!selectedShape?.locked;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        Загружаем доску…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-500">
        Ошибка: {error.message}
      </div>
    );
  }

  const orderedShapes = [...shapes].sort(
    (a, b) => (a?.zIndex ?? 0) - (b?.zIndex ?? 0),
  );

  return (
    <div className="flex-1 relative overflow-hidden" onWheel={handleWheel}>
      <div className="absolute inset-8 bg-white rounded-xl shadow-lg overflow-hidden">
        {/* сетка */}
        <div className="absolute inset-0" style={gridStyles} />

        {/* контейнер по всей области доски, без transform */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
        >
          {/* а тут уже сам "мир доски", который двигаем и масштабируем */}
          <div
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomScale})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
            }}
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
                    zIndex: 1000,
                  }}
                />
              )}

            {orderedShapes.map((shape) => (
              <ShapeItem
                key={shape.id}
                shape={shape}
                zoom={zoom}
                isSelected={selectedId === shape.id}
                onDragLocal={broadcastTransientPosition}
                onDragEnd={saveFinalPosition}
                onShapeClick={handleShapeClickCb}
                onShapeContextMenu={handleShapeContextMenuCb}
                onTextChange={handleTextChange}
              />
            ))}
          </div>
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
          onCopyClick={handleCopyClick}
        />
      )}
    </div>
  );
}
