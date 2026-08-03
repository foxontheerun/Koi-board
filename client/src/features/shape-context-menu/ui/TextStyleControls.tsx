import { useEffect, useReducer, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Minus,
  Palette,
  Plus,
} from "lucide-react";
import type {
  TextStyle,
  TextStylePatch,
} from "../../../canvas/core/ShapeCommands";
import type { TextAlign } from "../../../entities/Shape";
import {
  BOLD_FONT_WEIGHT,
  DEFAULT_FONT_WEIGHT,
  FONT_SIZE_STEPS,
  TEXT_COLORS,
  MIXED,
  clampFontSize,
} from "../../../canvas/entities/shapes/text";
import { iconButton, popover } from "./toolbarStyles";
import { useEditing } from "../../../entities/Board/EditingContext";


interface TextStyleControlsProps {
  style: TextStyle;
  onChange: (patch: TextStylePatch) => void;
}

const ALIGNMENTS: { value: TextAlign; icon: React.ReactNode; label: string }[] =
  [
    {
      value: "LEFT",
      icon: <AlignLeft className="w-4 h-4" />,
      label: "Align left",
    },
    {
      value: "CENTER",
      icon: <AlignCenter className="w-4 h-4" />,
      label: "Align center",
    },
    {
      value: "RIGHT",
      icon: <AlignRight className="w-4 h-4" />,
      label: "Align right",
    },
  ];

function stepFontSize(current: number, direction: 1 | -1): number {
  const next =
    direction === 1
      ? FONT_SIZE_STEPS.find((size) => size > current)
      : [...FONT_SIZE_STEPS].reverse().find((size) => size < current);

  return clampFontSize(next ?? current + direction * 4);
}

export function TextStyleControls({ style, onChange }: TextStyleControlsProps) {
  const [colorsOpen, setColorsOpen] = useState(false);
  const colorsRef = useRef<HTMLDivElement>(null);
  const { selectionAttributes } = useEditing();
  const [, follow] = useReducer((n: number) => n + 1, 0);

  // The toolbar has to describe the selection, and a selection changes without
  // React hearing about it.
  useEffect(() => {
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  }, []);

  // What the selection says wins; where it says nothing, the style falls
  // through to the shape's own.
  const selected = selectionAttributes();

  const boldState =
    selected?.bold === MIXED
      ? MIXED
      : (selected?.bold ?? style.fontWeight >= BOLD_FONT_WEIGHT);
  const isBold = boldState === true;

  const sizeState =
    selected?.fontSize === MIXED
      ? MIXED
      : (selected?.fontSize ?? Math.round(style.fontSize));
  const size = sizeState === MIXED ? Math.round(style.fontSize) : sizeState;

  const colour =
    selected?.color === MIXED
      ? undefined
      : (selected?.color ?? style.textColor);

  useEffect(() => {
    if (!colorsOpen) return;

    const closeOnOutside = (e: MouseEvent) => {
      if (!colorsRef.current?.contains(e.target as Node)) setColorsOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [colorsOpen]);

  const commitSize = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed === size) return;

    onChange({ fontSize: clampFontSize(parsed) });
  };

  return (
    <>
      <button
        className={iconButton}
        title="Smaller text"
        onClick={() => onChange({ fontSize: stepFontSize(size, -1) })}
      >
        <Minus className="w-4 h-4" />
      </button>

      <input
        // Uncontrolled while typing, reset by key when the size changes
        // elsewhere - a half-typed number should not be applied.
        key={sizeState === MIXED ? "mixed" : size}
        // Mixed sizes show nothing rather than picking one of them.
        defaultValue={sizeState === MIXED ? "" : size}
        placeholder={sizeState === MIXED ? "—" : undefined}
        onChange={(e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
        }}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => commitSize(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.currentTarget.value = String(size);
            e.currentTarget.blur();
          }
          // Otherwise Escape and Delete would reach the board behind it.
          e.stopPropagation();
        }}
        className="w-8 rounded px-1 py-0.5 text-xs tabular-nums text-center text-[#1A1A1A] hover:bg-[#F5F5F5] focus:bg-[#F5F5F5] outline-none"
        title="Text size"
        inputMode="numeric"
        aria-label="Text size"
      />

      <button
        className={iconButton}
        title="Larger text"
        onClick={() => onChange({ fontSize: stepFontSize(size, 1) })}
      >
        <Plus className="w-4 h-4" />
      </button>

      <button
        className={`${iconButton} ${isBold ? "bg-[#E3F6FB]" : ""} ${
          boldState === MIXED ? "ring-1 ring-inset ring-[#E3F6FB]" : ""
        }`}
        title={boldState === MIXED ? "Bold (mixed)" : "Bold"}
        // A partly bold selection turns fully bold first, the way every editor
        // resolves the third state.
        onClick={() =>
          onChange({
            fontWeight: isBold ? DEFAULT_FONT_WEIGHT : BOLD_FONT_WEIGHT,
          })
        }
      >
        <Bold className="w-4 h-4" />
      </button>

      {ALIGNMENTS.map((option) => (
        <button
          key={option.value}
          className={`${iconButton} ${
            style.textAlign === option.value ? "bg-[#E3F6FB]" : ""
          }`}
          title={option.label}
          onClick={() => onChange({ textAlign: option.value })}
        >
          {option.icon}
        </button>
      ))}

      <div className="relative" ref={colorsRef}>
        <button
          className={iconButton}
          title="Text colour"
          onClick={() => setColorsOpen((open) => !open)}
        >
          <Palette className="w-4 h-4" style={{ color: colour }} />
        </button>

        {colorsOpen && (
          <div className={`${popover} left-1/2 -translate-x-1/2 p-2 flex gap-1.5`}>
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                className="w-6 h-6 rounded-full border border-[#E5E5E5] transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  onChange({ textColor: color });
                  setColorsOpen(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-[#E5E5E5] mx-0.5" />
    </>
  );
}
