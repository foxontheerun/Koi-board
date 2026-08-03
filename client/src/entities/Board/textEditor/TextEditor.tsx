import { useEffect, useReducer } from "react";
import type { BoardRuntime, CameraController } from "../../../canvas";
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  STICKER_TEXT_COLOR,
  TEXT_COLOR,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT_RATIO,
  TEXT_PADDING,
} from "../../../canvas/entities/shapes/text";

const EDITOR_BORDER_COLOR = BRAND.aqua;
import { BRAND } from "../../../shared/theme";
import { EditableText } from "./EditableText";
import { useEditing } from "../EditingContext";

interface TextEditorProps {
  runtime: BoardRuntime;
  camera: CameraController;
}

export function TextEditor({ runtime, camera }: TextEditorProps) {
  const { editingShape, stopEditing, updateText, editorRef, setEditorHandle } =
    useEditing();
  const [, follow] = useReducer((n: number) => n + 1, 0);

  useEffect(() => camera.subscribe(follow), [camera]);

  const editingId = editingShape?.id ?? null;
  useEffect(() => {
    runtime.setEditingShape(editingId);
    if (editingId) runtime.beginTextEditing(editingId);

    return () => {
      runtime.setEditingShape(null);
      if (editingId) runtime.endTextEditing(editingId);
    };
  }, [runtime, editingId]);

  // The toolbar styles a selection through the context, which needs to know how
  // the editor renders and where to send the result.
  useEffect(() => {
    if (!editingShape) {
      setEditorHandle(null);
      return;
    }

    setEditorHandle({
      scale: camera.getScale(),
      onFormats: (formats) =>
        runtime.previewShapeText(editingShape.id, editingShape.text, formats),
    });

    return () => setEditorHandle(null);
  });

  if (!editingShape) return null;

  const shape = runtime.getShape(editingShape.id);
  if (!shape) return null;

  const rect = runtime.getShapeCanvasRect(shape);
  const scale = camera.getScale();

  const commit = () => {
    runtime.commitShapeText(
      editingShape.id,
      editingShape.text,
      editingShape.formats,
    );
    stopEditing();
  };

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <EditableText
        ref={editorRef as React.RefObject<HTMLDivElement>}
        value={editingShape.text}
        formats={editingShape.formats}
        scale={scale}
        placeholder="Type something"
        caretAt={editingShape.caretAt}
        autoFocus
        style={{
          position: "absolute",
          left: rect.x,
          top: rect.y,
          width: rect.w,
          minHeight: rect.h,
          padding: TEXT_PADDING * scale,
          fontFamily: TEXT_FONT_FAMILY,
          fontSize: (shape.fontSize ?? DEFAULT_FONT_SIZE) * scale,
          fontWeight: shape.fontWeight ?? DEFAULT_FONT_WEIGHT,
          textAlign: (shape.textAlign ?? "LEFT").toLowerCase() as
            | "left"
            | "center"
            | "right",
          lineHeight: TEXT_LINE_HEIGHT_RATIO,
          boxSizing: "border-box",
          overflowWrap: "break-word",
          whiteSpace: "pre-wrap",
          pointerEvents: "auto",
          background: "transparent",
          // Outline, not border: a border would eat into the width and shift
          // the wrap away from what the canvas measured.
          outline: `1px solid ${EDITOR_BORDER_COLOR}`,
          color:
            shape.textColor ??
            (shape.type === "TEXT" ? TEXT_COLOR : STICKER_TEXT_COLOR),
          cursor: "text",
        }}
        onChange={(text, formats) => {
          updateText(text, formats);
          runtime.previewShapeText(editingShape.id, text, formats);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") commit();
        }}
      />
    </div>
  );
}
