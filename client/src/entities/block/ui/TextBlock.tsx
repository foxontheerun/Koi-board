import { useEffect, useRef, useState } from "react";
import type { Shape } from "../model/types";
import React from "react";

interface TextBlockProps {
  shape: Shape;
  onChangeText?: (text: string) => void;
}

export const TextBlock = React.memo(
  ({ shape, onChangeText }: TextBlockProps) => {
    const fill = shape.fill || "#FFFFFF";
    const stroke = shape.stroke || "#E5E5E5";
    const strokeWidth = shape.strokeWidth || 1;

    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(shape.text || "Текст...");
    const [fontSize, setFontSize] = useState(() => calcFontSize(shape.height));

    const textRef = useRef<HTMLTextAreaElement | HTMLParagraphElement | null>(
      null
    );

    useEffect(() => {
      setValue(shape.text || "");
    }, [shape.text]);

    useEffect(() => {
      setFontSize(calcFontSize(shape.height));
    }, [shape.height]);

    useEffect(() => {
      if (isEditing && textRef.current instanceof HTMLTextAreaElement) {
        const el = textRef.current;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, [isEditing]);

    function calcFontSize(height?: number) {
      const baseHeight = 80;
      const baseFontSize = 14;
      const h = height || baseHeight;

      return Math.max(12, (h / baseHeight) * baseFontSize);
    }

    const handleDoubleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
      e.stopPropagation();
      setIsEditing(true);
    };

    const handleMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
      if (isEditing) {
        e.stopPropagation();
      }
    };

    const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
      const next = e.target.value;
      setValue(next);
      onChangeText?.(next);
    };

    const handleBlur: React.FocusEventHandler<HTMLTextAreaElement> = () => {
      setIsEditing(false);
      onChangeText?.(value);
    };

    return (
      <div className="relative w-full h-full group">
        <div
          className="w-full h-full rounded-[8px] p-4 flex items-center justify-center transition-all"
          style={{
            backgroundColor: fill,
            border: `${strokeWidth}px solid ${stroke}`,
            transform: `rotate(${shape.rotation}deg)`,
          }}
          onDoubleClick={handleDoubleClick}
          onMouseDown={handleMouseDown}
        >
          {isEditing ? (
            <textarea
              ref={textRef as React.RefObject<HTMLTextAreaElement>}
              className="w-full h-full bg-transparent outline-none text-[#1A1A1A] text-center resize-none"
              style={{
                fontSize,
                lineHeight: 1.2,
              }}
              value={value}
              onChange={handleChange}
              onBlur={handleBlur}
            />
          ) : (
            <p
              ref={textRef as React.RefObject<HTMLParagraphElement>}
              className="text-[#1A1A1A] text-center select-none"
              style={{
                fontSize,
                lineHeight: 1.2,
              }}
            >
              {value}
            </p>
          )}
        </div>
      </div>
    );
  }
);
