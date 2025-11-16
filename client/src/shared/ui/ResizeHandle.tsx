interface ResizeHandleProps {
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "top"
    | "bottom"
    | "left"
    | "right";
}

export function ResizeHandle({ position }: ResizeHandleProps) {
  const positionStyles: Record<string, string> = {
    "top-left": "-top-1.5 -left-1.5 cursor-nw-resize",
    "top-right": "-top-1.5 -right-1.5 cursor-ne-resize",
    "bottom-left": "-bottom-1.5 -left-1.5 cursor-sw-resize",
    "bottom-right": "-bottom-1.5 -right-1.5 cursor-se-resize",
    top: "-top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize",
    bottom: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize",
    left: "top-1/2 -translate-y-1/2 -left-1.5 cursor-w-resize",
    right: "top-1/2 -translate-y-1/2 -right-1.5 cursor-e-resize",
  };

  const isCorner = position.includes("-");

  return (
    <div
      className={`absolute ${positionStyles[position]}`}
      style={{ pointerEvents: "auto" }}
    >
      <div
        className={`bg-white border-2 border-[#4A65F6] ${
          isCorner ? "w-3 h-3 rounded-sm" : "w-2 h-2 rounded-full"
        }`}
      />
    </div>
  );
}
