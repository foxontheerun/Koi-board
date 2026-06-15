import { useParams } from "react-router-dom";
import { useRef, useState } from "react";
import type { StickyColorId, Tool } from "../../../entities/Shape";
import { TopBar, Toolbar } from "../../../widgets";
import type { CameraController } from "../../../canvas";
import { CameraContext } from "../../../entities/Board/CameraContext";
import {
  BoardCanvasNew,
  type BoardCanvasHandle,
} from "../../../entities/Board/BoardCanvasNew";
import { BoardOverlayLayer } from "../../../entities/Board/BoardOverlayLayer";
import {
  EditingContext,
  useEditingProvider,
} from "../../../entities/Board/EditingContext";

export function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTool, setActiveTool] = useState<Tool>("pointer");
  const [activeStickyColorId, setActiveStickyColorId] =
    useState<StickyColorId>("yellow");
  const [camera, setCamera] = useState<CameraController | null>(null);

  const canvasRef = useRef<BoardCanvasHandle | null>(null);

  const editing = useEditingProvider();

  if (!id) return <div>Board not found</div>;

  return (
    <EditingContext.Provider value={editing}>
      <div className="board-root">
        {camera && (
          <CameraContext.Provider value={camera}>
            <TopBar />
          </CameraContext.Provider>
        )}

        <div className="flex-1 flex relative overflow-hidden bg-[#F5F5F5]">
          <Toolbar
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            activeStickyColorId={activeStickyColorId}
            setActiveStickyColorId={setActiveStickyColorId}
            onShapeColorChange={(fill, stroke) => {
              canvasRef.current?.setShapeColor(fill, stroke);
            }}
          />

          <BoardCanvasNew
            ref={canvasRef}
            boardId={id}
            setCamera={setCamera}
            activeTool={activeTool}
            activeStickyColor={activeStickyColorId}
            onToolComplete={() => setActiveTool("pointer")}
            editingContextRef={editing.ref}
          />

          <BoardOverlayLayer
            onCommit={(shapeId, text) => {
              canvasRef.current?.commitText?.(shapeId, text);
            }}
          />
        </div>
      </div>
    </EditingContext.Provider>
  );
}
