import { useEffect, useReducer } from "react";
import type { CameraController } from "../../../canvas";
import type { RemoteCursor } from "../../../canvas/types";
import { colorFromId } from "../lib/colorFromId";

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
            <CursorArrow color={colorFromId(c.clientId)} />
          </div>
        );
      })}
    </div>
  );
}

function CursorArrow({ color }: { color: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 20 20"
      fill="none"
      style={{ display: "block" }}
    >
      <path
        d="M3 2 L3 16 L7 12.5 L10 18 L12.5 17 L9.5 11.5 L15 11 Z"
        fill={color}
        stroke="white"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
