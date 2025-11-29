import { useRef, useState } from "react";
import { ContextMenu } from "../../../features/shape-context-menu/ui/ContextMenu";
import type { Tool } from "../../block/model/types";
import { ShapeBlock } from "../../block/ui/ShapeBlock";
import { TextBlock } from "../../block/ui/TextBlock";
import { ResizableDraggableShape } from "../../block/ui/ResizableDraggableShape";
import { useBoardShapes } from "../model/useBoardShapes";
import { calculateZoomTransform } from "../../../shared/lib/zoom";
import { useGridSystem } from "../model/useGridSystem";
import { EllipseBlock } from "../../block/ui/EllipseBlock";

interface BoardCanvasProps {
  boardId: string;
  activeTool: Tool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 400;

export function BoardCanvas({ boardId, zoom, onZoomChange }: BoardCanvasProps) {
  const {
    shapes,
    loading,
    error,
    broadcastTransientPosition,
    saveFinalPosition,
    changeZIndex,
    toggleLock,
  } = useBoardShapes(boardId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const zoomScale = zoom / 100;
  const gridStyles = useGridSystem(zoomScale);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const skipCenteringRef = useRef(false);

  const handleShapeClick = (id: string) => {
    setSelectedId(id);
    setContextMenu(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setSelectedId(null);
      setContextMenu(null);
    }
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
        >
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
        />
      )}
    </div>
  );
}
