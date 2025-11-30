import { useState } from "react";
import { MousePointer2, Square, Type, Hand, Trash2 } from "lucide-react";
import type { Tool } from "../../../entities/block/model/types";
import { type StickyColorId } from "../../../entities/block";
import { ColorPicker } from "../../../features/color-picker/ui/ColorPicker";

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  activeStickyColorId: StickyColorId;
  setActiveStickyColorId: (id: StickyColorId) => void;
}

export function Toolbar({
  activeTool,
  setActiveTool,
  activeStickyColorId,
  setActiveStickyColorId,
}: ToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    {
      id: "pointer",
      icon: <MousePointer2 className="w-5 h-5" />,
      label: "Pointer",
    },
    {
      id: "rectangle",
      icon: <Square className="w-5 h-5" />,
      label: "Rectangle",
    },
    { id: "text", icon: <Type className="w-5 h-5" />, label: "Text" },
    { id: "hand", icon: <Hand className="w-5 h-5" />, label: "Hand" },
    { id: "delete", icon: <Trash2 className="w-5 h-5" />, label: "Delete" },
  ];

  const handleToolClick = (toolId: Tool) => {
    setActiveTool(toolId);
    if (toolId === "rectangle") {
      setShowColorPicker(true);
    } else {
      setShowColorPicker(false);
    }
  };

  const handleColorChange = (id: StickyColorId) => {
    setActiveStickyColorId(id);
    setShowColorPicker(false);
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
                ? "bg-[#4A65F6] text-white shadow-md"
                : "bg-transparent text-[#666666] hover:bg-[#F5F5F5]"
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {showColorPicker && (
        <ColorPicker
          activeStickyColorId={activeStickyColorId}
          setActiveStickyColorId={handleColorChange}
          onClose={() => setShowColorPicker(false)}
        />
      )}
    </div>
  );
}
