import { Check } from "lucide-react";
import {
  STICKY_COLORS,
  STICKY_PRESETS,
  type StickyColorId,
} from "../../../entities/Shape";
import { useEffect, useRef } from "react";

interface ColorPickerProps {
  activeStickyColorId: string;
  setActiveStickyColorId: (color: StickyColorId) => void;
  onClose: () => void;
}

export function ColorPicker({
  activeStickyColorId,
  setActiveStickyColorId,
  onClose,
}: ColorPickerProps) {
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
      className="bg-white rounded-xl shadow-lg p-3 flex flex-col gap-2"
      ref={pickerRef}
    >
      <div className="grid grid-cols-2 gap-2">
        {STICKY_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => setActiveStickyColorId(color)}
            className="w-8 h-8 rounded-lg transition-all hover:scale-110 relative group"
            style={{
              backgroundColor: STICKY_PRESETS[color].fill,
              border: `1px solid ${STICKY_PRESETS[color].stroke}`,
            }}
          >
            {activeStickyColorId === color && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-4 h-4 text-[#1db3e0]" strokeWidth={3} />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
