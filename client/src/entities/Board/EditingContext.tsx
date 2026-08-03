import { createContext, useContext, useRef, useState } from "react";
import {
  applyFormat,
  attributesIn,
  type SelectionAttributes,
  type TextAttributes,
  type TextFormat,
} from "../../canvas/entities/shapes/text";
import {
  renderInto,
  restoreSelection,
  selectionRange,
} from "./textEditor/richDom";

// Position is derived from the live shape and camera on every render, so the
// editor keeps tracking the shape while the board is panned or zoomed.
export interface EditingShape {
  id: string;
  text: string;
  formats: TextFormat[];
  // Viewport point of the click that opened the editor, so the caret can land
  // where the pointer did rather than at the end of the text.
  caretAt?: { x: number; y: number };
}

// Registered by the editor while it is open: how it renders, and where formats
// changed from outside should go.
export interface EditorHandle {
  scale: number;
  onFormats: (formats: TextFormat[]) => void;
}

export interface EditingContextValue {
  editingShape: EditingShape | null;
  startEditing: (shape: EditingShape) => void;
  stopEditing: () => void;
  updateText: (text: string, formats: TextFormat[]) => void;
  // Set by the editor while it is open, so the toolbar can style a selection
  // rather than the whole shape.
  editorRef: React.MutableRefObject<HTMLElement | null>;
  setEditorHandle: (handle: EditorHandle | null) => void;
  // What the toolbar reads and writes while editing. Returns false when there
  // is nothing selected, so the caller can fall back to styling the shape.
  styleSelection: (attributes: TextAttributes) => boolean;
  selectionAttributes: () => SelectionAttributes | null;
}

const noopRef = { current: null };

export const EditingContext = createContext<EditingContextValue>({
  editingShape: null,
  startEditing: () => {},
  stopEditing: () => {},
  updateText: () => {},
  editorRef: noopRef,
  setEditorHandle: () => {},
  styleSelection: () => false,
  selectionAttributes: () => null,
});

export function useEditing() {
  return useContext(EditingContext);
}

export function useEditingProvider(): EditingContextValue & {
  ref: React.MutableRefObject<EditingContextValue>;
} {
  const [editingShape, setEditingShape] = useState<EditingShape | null>(null);
  const editorRef = useRef<HTMLElement | null>(null);
  const handleRef = useRef<EditorHandle | null>(null);

  const selectionIn = (shape: EditingShape | null) => {
    const element = editorRef.current;
    if (!element || !shape) return null;

    const range = selectionRange(element);
    return range && range.length > 0 ? { element, range } : null;
  };

  // While the editor is open every style goes through it, selected range or
  // whole text. The editor renders its content once on open - re-rendering per
  // keystroke would destroy the caret - so a change made anywhere else would
  // reach the model and never reach the screen.
  const styleSelection = (attributes: TextAttributes) => {
    const element = editorRef.current;
    if (!editingShape || !element) return false;

    const selected = selectionIn(editingShape);
    const found = selected ?? {
      element,
      range: { index: 0, length: editingShape.text.length },
    };

    if (found.range.length === 0) return false;

    const formats = applyFormat(
      editingShape.formats,
      found.range,
      attributes,
      editingShape.text.length,
    );

    // Re-rendering replaces the nodes the selection lives in, so it has to be
    // put back afterwards - the caret where it was, not the range that was
    // styled, or styling with nothing selected would select everything.
    const before = selectionRange(element);

    renderInto(
      found.element,
      editingShape.text,
      formats,
      handleRef.current?.scale ?? 1,
    );
    restoreSelection(found.element, before ?? found.range);

    setEditingShape({ ...editingShape, formats });
    handleRef.current?.onFormats(formats);

    return true;
  };

  // With nothing selected the toolbar describes the whole block, since that is
  // what a click would style.
  const selectionAttributes = () => {
    const found =
      selectionIn(editingShape) ??
      (editingShape && editorRef.current
        ? {
            element: editorRef.current,
            range: { index: 0, length: editingShape.text.length },
          }
        : null);
    if (!editingShape || !found) return null;

    return attributesIn(
      editingShape.formats,
      found.range,
      editingShape.text.length,
    );
  };

  const value: EditingContextValue = {
    editingShape,
    editorRef,
    styleSelection,
    selectionAttributes,
    setEditorHandle: (handle) => {
      handleRef.current = handle;
    },
    startEditing: (shape) => setEditingShape(shape),
    stopEditing: () => setEditingShape(null),
    updateText: (text, formats) =>
      setEditingShape((prev) => (prev ? { ...prev, text, formats } : null)),
  };

  // Stable ref so BoardCanvasNew can write without subscribing to re-renders.
  const ref = useRef<EditingContextValue>(value);
  ref.current = value;

  return { ...value, ref };
}
