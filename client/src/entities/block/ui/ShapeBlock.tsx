import React from "react";
import type { Shape } from "../model/types";

interface ShapeBlockProps {
  shape: Shape;
}

export const ShapeBlock = React.memo(({ shape }: ShapeBlockProps) => {
  const fill = shape.fill || "#F9F9F9";
  const stroke = shape.stroke || "#E5E5E5";
  const strokeWidth = shape.strokeWidth || 1;

  return (
    <div className="relative w-full h-full group">
      {/* Rectangle shape */}
      <div
        className={`w-full h-full rounded-[8px] transition-all shadow-sm hover:shadow-md `}
        style={{
          backgroundColor: fill,
          border: `${strokeWidth}px solid ${stroke}`,
          transform: `rotate(${shape.rotation}deg)`,
        }}
      />
    </div>
  );
});
