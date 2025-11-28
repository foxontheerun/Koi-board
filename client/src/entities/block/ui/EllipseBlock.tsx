import type { Shape } from "../model/types";

interface EllipseBlockProps {
  shape: Shape;
}

export function EllipseBlock({ shape }: EllipseBlockProps) {
  const fill = shape.fill || "#F9F9F9";
  const stroke = shape.stroke || "#E5E5E5";
  const strokeWidth = shape.strokeWidth || 1;

  return (
    <div className="relative w-full h-full group">
      {/* Ellipse/Circle shape */}
      <div
        className={`w-full h-full rounded-full transition-all shadow-sm hover:shadow-md`}
        style={{
          backgroundColor: fill,
          border: `${strokeWidth}px solid ${stroke}`,
          transform: `rotate(${shape.rotation}deg)`,
        }}
      />
    </div>
  );
}
