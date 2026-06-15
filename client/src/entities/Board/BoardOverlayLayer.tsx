import { useEditing } from "./EditingContext";
import { EditableText } from "../../shared/ui/editable-text/EditableText";

export function BoardOverlayLayer({
  onCommit,
}: {
  onCommit: (id: string, text: string) => void;
}) {
  const { editingShape, stopEditing, updateText } = useEditing();

  if (!editingShape) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 50 }}
    >
      <EditableText
        value={editingShape.text}
        autoFocus
        style={{
          position: "absolute",
          left: editingShape.screenX,
          top: editingShape.screenY,
          width: editingShape.screenW,
          height: editingShape.screenH,
          pointerEvents: "auto",
          padding: "8px",
          boxSizing: "border-box",
          fontSize: "14px",
          lineHeight: "1.4",
          wordBreak: "break-word",
          outline: "none",
          background: "transparent",
          cursor: "text",
        }}
        onChange={(text) => updateText(text)}
        onBlur={() => {
          onCommit(editingShape.id, editingShape.text);
          stopEditing();
        }}
        onKeyDown={(e) => {
          // Commit on Escape, allow Enter for line breaks.
          if (e.key === "Escape") {
            onCommit(editingShape.id, editingShape.text);
            stopEditing();
          }
        }}
      />
    </div>
  );
}
