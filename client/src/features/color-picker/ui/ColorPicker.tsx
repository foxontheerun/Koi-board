import { Check } from "lucide-react";
import { useEffect, useRef } from "react";

export interface ColorPickerOption<TValue extends string = string> {
  id: TValue;
  fill: string;
  stroke?: string;
  label: string;
}

interface ColorPickerProps<TValue extends string = string> {
  options: ColorPickerOption<TValue>[];
  activeId: TValue;
  onSelect: (id: TValue) => void;
  onClose: () => void;
  title?: string;
  columns?: number;
}

export function ColorPicker<TValue extends string = string>({
  options,
  activeId,
  onSelect,
  onClose,
  title,
  columns = 2,
}: ColorPickerProps<TValue>) {
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="bg-white rounded-xl shadow-lg p-3 flex flex-col gap-2"
    >
      {title && (
        <span className="text-xs text-gray-500 font-medium">{title}</span>
      )}

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((color) => (
          <button
            key={color.id}
            onClick={() => onSelect(color.id)}
            className={`w-8 h-8 rounded-lg transition-all relative group ${
              activeId === color.id ? "scale-110" : "hover:scale-105"
            }`}
            style={{
              backgroundColor: color.fill,
              border: `1px solid ${color.stroke ?? "transparent"}`,
            }}
            title={color.label}
          >
            {activeId === color.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-4 h-4 text-[#3B82F6]" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
