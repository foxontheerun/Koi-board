import React, { useEffect, useImperativeHandle, useRef } from "react";
import type { TextFormat } from "../../../canvas/entities/shapes/text";
import { readFrom, renderInto } from "./richDom";

export interface EditableTextProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string;
  formats?: TextFormat[];
  // Scale the formatted sizes by the camera, so the editor matches the canvas.
  scale?: number;
  onChange: (value: string, formats: TextFormat[]) => void;
  placeholder?: string;
  editable?: boolean;
  caretAt?: { x: number; y: number };
}

// Puts the caret where the click landed; falls back to the end of the text.
function placeCaret(el: HTMLDivElement, at?: { x: number; y: number }) {
  const selection = window.getSelection();
  if (!selection) return;

  const fromPoint = at ? rangeFromPoint(at) : null;
  // An empty block has no text node to hit, and the point then resolves to
  // whatever is behind the editor - which would put the caret outside it.
  const range =
    fromPoint && el.contains(fromPoint.startContainer) ? fromPoint : null;

  if (range) {
    selection.removeAllRanges();
    selection.addRange(range);
    return;
  }

  const toEnd = document.createRange();
  toEnd.selectNodeContents(el);
  toEnd.collapse(false);
  selection.removeAllRanges();
  selection.addRange(toEnd);
}

function rangeFromPoint({ x, y }: { x: number; y: number }): Range | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  const position = doc.caretPositionFromPoint?.(x, y);
  if (position) {
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return doc.caretRangeFromPoint?.(x, y) ?? null;
}

export const EditableText = React.forwardRef<HTMLDivElement, EditableTextProps>(
  (
    {
      value,
      formats,
      scale = 1,
      onChange,
      placeholder,
      className,
      autoFocus,
      editable = true,
      caretAt,
      ...rest
    },
    forwardedRef,
  ) => {
    const innerRef = useRef<HTMLDivElement | null>(null);
    const composing = useRef(false);

    useImperativeHandle(forwardedRef, () => innerRef.current as HTMLDivElement);

    // Rendered once when the editor opens. Re-rendering on every keystroke
    // would replace the nodes the caret sits in.
    useEffect(() => {
      if (innerRef.current) {
        renderInto(innerRef.current, value, formats ?? [], scale);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (autoFocus && editable && innerRef.current) {
        innerRef.current.focus();
      }
    }, [autoFocus, editable]);

    useEffect(() => {
      if (!editable || !autoFocus) return;
      if (!innerRef.current) return;

      placeCaret(innerRef.current, caretAt);
      // Only on open: re-running would drag the caret back mid-typing.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editable, autoFocus]);

    const report = (element: HTMLDivElement) => {
      const { text, formats: read } = readFrom(element);
      onChange(text, read);
    };

    return (
      <div
        ref={innerRef}
        contentEditable={editable}
        spellCheck={false}
        suppressContentEditableWarning
        className={className}
        data-placeholder={placeholder}
        onInput={
          editable
            ? (e) => {
                // Mid-composition values are half-typed syllables, not text.
                if (composing.current) return;
                report(e.currentTarget);
              }
            : undefined
        }
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(e) => {
          composing.current = false;
          if (editable) report(e.currentTarget);
        }}
        onPaste={
          editable
            ? (e) => {
                // contentEditable would otherwise take the markup with it.
                e.preventDefault();
                const text = e.clipboardData.getData("text/plain");
                document.execCommand("insertText", false, text);
              }
            : undefined
        }
        {...rest}
      />
    );
  },
);
