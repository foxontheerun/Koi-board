import { useMemo, useState } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  StickyNote,
  Type,
  Hand,
  Trash2,
} from "lucide-react";
import {
  SHAPE_COLORS,
  STICKY_COLORS,
  STICKY_PRESETS,
  type StickyColorId,
  type Tool,
} from "../../../entities/Shape";
import {
  ColorPicker,
  type ColorPickerOption,
} from "../../../features/color-picker/ui/ColorPicker";

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  activeStickyColorId: StickyColorId;
  setActiveStickyColorId: (id: StickyColorId) => void;
  onShapeColorChange?: (fill: string, stroke: string) => void;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  activeStickyColorId,
  setActiveStickyColorId,
  onShapeColorChange,
}: ToolbarProps) {
  const [showStickyColorPicker, setShowStickyColorPicker] = useState(false);
  const [showShapeColorPicker, setShowShapeColorPicker] = useState(false);
  const [activeShapeColorId, setActiveShapeColorId] = useState<string>(
    SHAPE_COLORS[0].id,
  );

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    {
      id: "pointer",
      icon: <MousePointer2 className="w-5 h-5" />,
      label: "Pointer",
    },
    {
      id: "sticker",
      icon: <StickyNote className="w-5 h-5" />,
      label: "Sticky note",
    },
    {
      id: "rectangle",
      icon: <Square className="w-5 h-5" />,
      label: "Rectangle",
    },
    {
      id: "ellipse",
      icon: <Circle className="w-5 h-5" />,
      label: "Ellipse",
    },
    { id: "text", icon: <Type className="w-5 h-5" />, label: "Text" },
    { id: "hand", icon: <Hand className="w-5 h-5" />, label: "Hand" },
    { id: "delete", icon: <Trash2 className="w-5 h-5" />, label: "Delete" },
  ];

  const stickyOptions = useMemo(
    () =>
      STICKY_COLORS.map((color) => ({
        id: color,
        fill: STICKY_PRESETS[color].fill,
        stroke: STICKY_PRESETS[color].stroke,
        label: color,
      })),
    [],
  );

  const handleToolClick = (toolId: Tool) => {
    setActiveTool(toolId);
    setShowStickyColorPicker(toolId === "sticker");
    setShowShapeColorPicker(toolId === "rectangle" || toolId === "ellipse");
  };

  const handleStickyColorChange = (id: StickyColorId) => {
    setActiveStickyColorId(id);
    setShowStickyColorPicker(false);
  };

  const handleShapeColorChange = (id: string) => {
    setActiveShapeColorId(id);

    const color = SHAPE_COLORS.find((item) => item.id === id);
    if (!color) return;

    onShapeColorChange?.(color.fill, color.stroke);
    setShowShapeColorPicker(false);
  };

  return (
    <div className="absolute left-4 top-4 z-10 flex gap-3">
      <div className="bg-white rounded-xl shadow-lg p-2 flex flex-col gap-1">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
              activeTool === tool.id
                ? "bg-[#3B82F6] text-white shadow-md"
                : "bg-transparent text-[#666666] hover:bg-[#F5F5F5]"
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {showStickyColorPicker && (
        <ColorPicker<StickyColorId>
          title="Sticker color"
          options={stickyOptions}
          activeId={activeStickyColorId}
          onSelect={handleStickyColorChange}
          onClose={() => setShowStickyColorPicker(false)}
          columns={2}
        />
      )}

      {showShapeColorPicker && (
        <ColorPicker<string>
          title="Fill color"
          options={SHAPE_COLORS as ColorPickerOption<string>[]}
          activeId={activeShapeColorId}
          onSelect={handleShapeColorChange}
          onClose={() => setShowShapeColorPicker(false)}
          columns={2}
        />
      )}
    </div>
  );
}
