import { useState } from "react";
import { ContextMenu } from "../../../features/shape-context-menu/ui/ContextMenu";
import type { Shape, Tool } from "../../../entities/block/model/types";
import { ShapeBlock } from "../../../entities/block/ui/ShapeBlock";
import { TextBlock } from "../../../entities/block/ui/TextBlock";
import { ResizableDraggableShape } from "../../../entities/block/ui/ResizableDraggableShape";

interface CanvasProps {
  activeTool: Tool;
  zoom: number;
}

export function Canvas({ activeTool, zoom }: CanvasProps) {
  const [shapes, setShapes] = useState<Shape[]>([
    { id: "1", type: "rectangle", x: 200, y: 150, width: 180, height: 120 },
    {
      id: "2",
      type: "text",
      x: 450,
      y: 180,
      width: 220,
      height: 80,
      content: "Привет! Я блок текста 😊",
    },
    { id: "3", type: "rectangle", x: 250, y: 350, width: 160, height: 100 },
  ]);

  const [selectedId, setSelectedId] = useState<string | null>("2");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const zoomScale = zoom / 100;

  const handleShapeClick = (id: string) => {
    if (activeTool === "pointer") {
      setSelectedId(id);
      setContextMenu(null);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // кликнули точно по канвасу, не по блоку
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

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Canvas container with shadow */}
      <div className="absolute inset-8 bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Grid dots background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, #E5E5E5 1px, transparent 1px)`,
            backgroundSize: "12px 12px",
            transform: `scale(${zoomScale})`,
            transformOrigin: "top left",
          }}
        />

        {/* Shapes container */}
        <div
          className="absolute inset-0"
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: "top left",
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {shapes.map((shape) => (
            <ResizableDraggableShape
              key={shape.id}
              shape={shape}
              zoom={zoom}
              isSelected={selectedId === shape.id}
              onChange={(next) =>
                setShapes((prev) =>
                  prev.map((s) => (s.id === next.id ? next : s))
                )
              }
              onClick={() => handleShapeClick(shape.id)}
              onContextMenu={(e) => handleContextMenu(e, shape.id)}
            >
              {shape.type === "rectangle" ? (
                <ShapeBlock shape={shape} />
              ) : (
                <TextBlock content={shape.content || ""} />
              )}
            </ResizableDraggableShape>
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
