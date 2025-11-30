import type { Shape } from "../model/types";

interface TextBlockProps {
  shape: Shape;
}

export function TextBlock({ shape }: TextBlockProps) {
  const fill = shape.fill || "#FFFFFF";
  const stroke = shape.stroke || "#E5E5E5";
  const strokeWidth = shape.strokeWidth || 1;

  return (
    <div className="relative w-full h-full group">
      <div
        className={`w-full h-full rounded-[8px] p-4 flex items-center justify-center transition-all`}
        style={{
          backgroundColor: fill,
          border: `${strokeWidth}px solid ${stroke}`,
          transform: `rotate(${shape.rotation}deg)`,
        }}
      >
        <p className="text-[#1A1A1A] text-center select-none">
          {shape.text || "Текст..."}
        </p>
      </div>
    </div>
  );
}
