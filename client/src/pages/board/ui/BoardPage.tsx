import { useParams } from "react-router-dom";
import { BoardCanvas } from "../../../entities/board/ui/BoardCanvas";
import type { Tool } from "../../../entities/block/model/types";
import { Toolbar } from "../../../widgets/toolbar/ui/Toolbar";
import { TopBar } from "../../../widgets/top-bar/ui/TopBar";
import { useState } from "react";

export function BoardPage() {
  const { id } = useParams<{ id: string }>();

  const [activeTool, setActiveTool] = useState<Tool>("pointer");
  const [zoom, setZoom] = useState(100);

  if (!id) {
    return <div>Board not found</div>;
  }

  return (
    <div className="board-root">
      <TopBar zoom={zoom} setZoom={setZoom} />
      <div className="flex-1 flex relative overflow-hidden">
        <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} />
        <BoardCanvas boardId={id} activeTool={activeTool} zoom={zoom} />
      </div>
    </div>
  );
}
