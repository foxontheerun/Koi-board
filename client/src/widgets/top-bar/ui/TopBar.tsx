import { Undo2, Redo2, Share2, ZoomIn, ZoomOut, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCamera } from "../../../entities/Board/CameraContext";
import { MAX_ZOOM, MIN_ZOOM } from "../../../entities/Board/BoardCanvasNew";
import { useAuth } from "../../../features/auth/model/AuthContext";

export function TopBar() {
  const camera = useCamera();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const [zoomPercent, setZoomPercent] = useState(
    Math.round(camera.state.zoom * 100),
  );

  useEffect(() => {
    const unsubList = camera.subscribe(() => {
      setZoomPercent(Math.round(camera.state.zoom * 100));
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
    camera.setZoom(Math.min(camera.state.zoom * 1.05, MAX_ZOOM / 100));
  };

  const handleZoomOut = () => {
    camera.setZoom(Math.max(camera.state.zoom * 0.95, MIN_ZOOM / 100));
  };

  return (
    <div className="h-14 bg-white border-b border-[#E5E5E5] flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#16B8D4] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <ellipse cx="8" cy="9" rx="5.5" ry="3.4" fill="#FF6A3D" />
              <path d="M12.5 9 L17 6 L17 12 Z" fill="#FF6A3D" />
              <circle cx="6" cy="8.2" r="0.9" fill="#fff" />
            </svg>
          </div>
          <span className="font-logo text-[#14202B] text-lg">Koi</span>
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
        <button className="px-4 py-1.5 bg-[#16B8D4] text-white rounded-lg hover:bg-[#0E7C99] transition-colors flex items-center gap-2">
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>
        {user && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#4ECDC4]">
              <span className="text-white uppercase">
                {user.email.charAt(0)}
              </span>
            </div>
            <span className="max-w-40 truncate text-sm text-[#666666]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              title="Log out"
              className="rounded-lg p-2 text-[#666666] transition-colors hover:bg-[#F5F5F5]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
