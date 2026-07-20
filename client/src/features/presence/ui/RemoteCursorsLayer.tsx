import { useEffect, useReducer } from "react";
import type { CameraController } from "../../../canvas";
import type { RemoteCursor } from "../../../canvas/types";
import { colorFromId } from "../lib/colorFromId";
import cursorPng from "../assets/cursor.png";

interface RemoteCursorsLayerProps {
  cursors: RemoteCursor[];
  camera: CameraController;
}

// DOM overlay (like Miro): cursors live above the canvas, positioned via
// world->screen, smoothed by CSS transition between throttled updates.
export function RemoteCursorsLayer({
  cursors,
  camera,
}: RemoteCursorsLayerProps) {
  // Re-render on camera changes so cursors track pan/zoom.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => camera.subscribe(tick), [camera]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {cursors.map((c) => {
        const screen = camera.worldToScreen(c.x, c.y);
        const color = colorFromId(c.clientId);
        return (
          <div
            key={c.clientId}
            className="absolute top-0 left-0"
            style={{
              transform: `translate(${screen.x}px, ${screen.y}px)`,
              transition: "transform 80ms linear",
              willChange: "transform",
            }}
          >
            <CursorArrow color={color} />
            {c.name && <CursorLabel name={c.name} color={color} />}
          </div>
        );
      })}
    </div>
  );
}

// Name tag pinned just below-right of the cursor tip, tinted with the peer's color.
function CursorLabel({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="absolute whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-[#14202B]"
      style={{
        top: 18,
        left: 18,
        backgroundColor: color,
      }}
    >
      {name}
    </div>
  );
}

function CursorArrow({ color }: { color: string }) {
  return (
    <div style={{ position: "relative", width: 24, height: 24 }}>
      <img
        src={cursorPng}
        width={24}
        height={24}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: color,
          mixBlendMode: "color",
          maskImage: `url(${cursorPng})`,
          WebkitMaskImage: `url(${cursorPng})`,
          maskSize: "contain",
          maskRepeat: "no-repeat",
        }}
      />
    </div>
  );
}
