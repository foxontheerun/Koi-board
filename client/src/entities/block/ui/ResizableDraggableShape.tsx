import { Rnd } from "react-rnd";
import type { Shape } from "../model/types";

interface ResizableDraggableShapeProps {
  shape: Shape;
  isSelected: boolean;
  zoom: number;
  onChange: (next: Shape) => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}

export function ResizableDraggableShape({
  shape,
  isSelected,
  zoom,
  onChange,
  onClick,
  onContextMenu,
  children,
}: ResizableDraggableShapeProps) {
  const scale = zoom / 100;

  return (
    <Rnd
      size={{ width: shape.width, height: shape.height }}
      position={{ x: shape.x, y: shape.y }}
      onDragStop={(_e, d) => {
        onChange({ ...shape, x: d.x, y: d.y });
      }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onChange({
          ...shape,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          x: position.x,
          y: position.y,
        });
      }}
      enableResizing={{
        right: true,
        bottom: true,
        bottomRight: true,
        top: false,
        left: false,
        topLeft: false,
        topRight: false,
        bottomLeft: false,
      }}
      style={{
        border: isSelected ? "2px solid #2563eb" : "1px solid #d4d4d8",
        borderRadius: 8,
        boxSizing: "border-box",
        background: "white",
      }}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onClick?.();
      }}
      onContextMenu={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        onContextMenu?.(e);
      }}
      scale={scale}
    >
      {children}
    </Rnd>
  );
}
