import { Undo2, Redo2, Share2, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useCamera } from "../../../entities/Board/CameraContext";
import { MAX_ZOOM, MIN_ZOOM } from "../../../entities/Board/BoardCanvasNew";

export function TopBar() {
  const camera = useCamera();

  const [zoomPercent, setZoomPercent] = useState(Math.round(camera.zoom * 100));

  useEffect(() => {
    const unsubList = camera.subscribe(() => {
      setZoomPercent(Math.round(camera.zoom * 100));
    });

    return () => {
      if (Array.isArray(unsubList)) {
        unsubList.forEach((u) => u());
      } else if (typeof unsubList === "function") {
        unsubList();
      }
    };
  }, [camera]);

  const handleZoomIn = () => {
    camera.setZoom(Math.min(camera.zoom * 1.05, MAX_ZOOM / 100));
  };

  const handleZoomOut = () => {
    camera.setZoom(Math.max(camera.zoom * 0.95, MIN_ZOOM / 100));
  };

  return (
    <div className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#3B82F6] flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span className="text-[#1A1A1A]">Realtime Board</span>
        </div>
        <div className="h-6 w-px bg-[#E5E5E5]" />
        <input
          type="text"
          defaultValue="Новый проект!"
          className="bg-transparent border-none outline-none text-[#1A1A1A] w-40"
        />
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors">
          <Undo2 className="w-4 h-4 text-[#666666]" />
        </button>
        <button className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors">
          <Redo2 className="w-4 h-4 text-[#666666]" />
        </button>
        <div className="h-6 w-px bg-[#E5E5E5] mx-2" />
        <div className="flex items-center gap-1 bg-[#F5F5F5] rounded-lg px-2 py-1.5">
          <button
            onClick={handleZoomOut}
            className="p-1 hover:bg-[#E5E5E5] rounded transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5 text-[#666666]" />
          </button>
          <span className="text-[#666666] min-w-12 text-center">
            {zoomPercent}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1 hover:bg-[#E5E5E5] rounded transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#666666]" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="px-4 py-1.5 bg-[#3B82F6] text-white rounded-lg hover:bg-[#2563EB] transition-colors flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
        <div className="flex items-center -space-x-2">
          <div className="w-8 h-8 rounded-full bg-[#FF6B6B] border-2 border-white flex items-center justify-center">
            <span className="text-white">А</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#4ECDC4] border-2 border-white flex items-center justify-center">
            <span className="text-white">М</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#FFE66D] border-2 border-white flex items-center justify-center">
            <span className="text-[#666666]">+2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
