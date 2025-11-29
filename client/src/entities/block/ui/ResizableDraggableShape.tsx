import { Rnd } from "react-rnd";
import type { Shape } from "../model/types";

interface ResizableDraggableShapeProps {
  shape: Shape;
  isSelected: boolean;
  zoom: number;

  onDragLocal: (next: Shape) => void;
  onDragEnd: (next: Shape) => void;

  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export function ResizableDraggableShape({
  shape,
  isSelected,
  zoom,
  onDragLocal,
  onDragEnd,
  onClick,
  onContextMenu,
  children,
}: ResizableDraggableShapeProps) {
  const scale = zoom / 100;
  const isLocked = !!shape.locked;

  return (
    <Rnd
      size={{ width: shape.width, height: shape.height }}
      position={{ x: shape.x, y: shape.y }}
      disableDragging={isLocked}
      enableResizing={
        isLocked
          ? {
              topLeft: false,
              top: false,
              topRight: false,
              right: false,
              bottomRight: false,
              bottom: false,
              bottomLeft: false,
              left: false,
            }
          : {
              topLeft: true,
              top: false,
              topRight: true,
              right: false,
              bottomRight: true,
              bottom: false,
              bottomLeft: true,
              left: false,
            }
      }
      // drag
      onDrag={(_e, d) => {
        onClick?.();
        onDragLocal({ ...shape, x: d.x, y: d.y });
      }}
      onDragStop={(_e, d) => {
        onDragEnd({ ...shape, x: d.x, y: d.y });
      }}
      // resize
      onResize={(_e, _dir, ref, _delta, position) => {
        onClick?.();
        onDragLocal({
          ...shape,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onDragEnd({
          ...shape,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
      }}
      className={`
    absolute w-full h-full box-border rounded-lg
    ${
      isSelected
        ? shape.locked
          ? "border border-gray-400"
          : "border border-blue-600"
        : ""
    }
  `}
      style={{
        boxSizing: "border-box",
        borderRadius: 8,
        background: "transparent",
      }}
      scale={scale}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onClick?.();
      }}
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onContextMenu?.(e);
      }}
    >
      <div className="relative w-full h-full">
        {children}

        {isSelected && !shape.locked && (
          <>
            {/* угловые точки, всегда аккуратно в углу */}
            <HandleDot className="top-0 left-0 -translate-x-1/2 -translate-y-1/2" />
            <HandleDot className="top-0 right-0 translate-x-1/2 -translate-y-1/2" />
            <HandleDot className="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" />
            <HandleDot className="bottom-0 right-0 translate-x-1/2 translate-y-1/2" />
          </>
        )}
      </div>
    </Rnd>
  );
}

function HandleDot({ className }: { className?: string }) {
  return (
    <div
      className={
        "pointer-events-none absolute w-2 h-2 rounded-full border border-blue-600 bg-white " +
        (className ?? "")
      }
    />
  );
}
