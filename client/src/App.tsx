import { useState } from "react";
import { Canvas } from "./widgets/canvas/ui/Canvas";
import type { Tool } from "./entities/block/model/types";
import { TopBar } from "./widgets/top-bar/ui/TopBar";
import { Toolbar } from "./widgets/toolbar/ui/Toolbar";
import { BoardPage } from "./pages/board/ui/BoardPage";

export default function App() {
  const [activeTool, setActiveTool] = useState<Tool>("pointer");
  const [zoom, setZoom] = useState(100);

  return (
    <div className="w-full h-screen flex flex-col bg-[#F5F5F5] overflow-hidden">
      <TopBar zoom={zoom} setZoom={setZoom} />
      <div className="flex-1 flex relative overflow-hidden">
        <Toolbar activeTool={activeTool} setActiveTool={setActiveTool} />
        <Canvas activeTool={activeTool} zoom={zoom} />
      </div>
    </div>
  );
}
