import { createContext, useContext, useRef, useState } from "react";

export interface EditingShape {
  id: string;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
  text: string;
}

export interface EditingContextValue {
  editingShape: EditingShape | null;
  startEditing: (shape: EditingShape) => void;
  stopEditing: () => void;
  updateText: (text: string) => void;
}

export const EditingContext = createContext<EditingContextValue>({
  editingShape: null,
  startEditing: () => {},
  stopEditing: () => {},
  updateText: () => {},
});

export function useEditing() {
  return useContext(EditingContext);
}

export function useEditingProvider(): EditingContextValue & {
  ref: React.MutableRefObject<EditingContextValue>;
} {
  const [editingShape, setEditingShape] = useState<EditingShape | null>(null);

  const value: EditingContextValue = {
    editingShape,
    startEditing: (shape) => setEditingShape(shape),
    stopEditing: () => setEditingShape(null),
    updateText: (text) =>
      setEditingShape((prev) => (prev ? { ...prev, text } : null)),
  };

  // Stable ref so BoardCanvasNew can write without subscribing to re-renders.
  const ref = useRef<EditingContextValue>(value);
  ref.current = value;

  return { ...value, ref };
}
