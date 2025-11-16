import { MousePointer2, Square, Type, Hand, Trash2 } from "lucide-react";
import type { Tool } from "../../../entities/block/model/types";

interface ToolbarProps {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
}

export function Toolbar({ activeTool, setActiveTool }: ToolbarProps) {
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

  return (
    <div className="absolute left-4 top-4 z-10 bg-white rounded-xl shadow-lg p-2 flex flex-col gap-1">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setActiveTool(tool.id)}
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
  );
}
