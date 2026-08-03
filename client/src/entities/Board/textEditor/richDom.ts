import {
  segmentsFor,
  type TextAttributes,
  type TextFormat,
  type TextRange,
  type TextSegment,
} from "../../../canvas/entities/shapes/text";

// The bridge between the format model and contentEditable. Attributes are
// carried in data-* rather than read back out of inline styles: the browser
// normalises CSS on its own terms, and comparing colours as written is a losing
// game.
const BOLD_ATTRIBUTE = "data-bold";
const ITALIC_ATTRIBUTE = "data-italic";
const STRIKE_ATTRIBUTE = "data-strike";
const SIZE_ATTRIBUTE = "data-size";
const COLOR_ATTRIBUTE = "data-color";

function styleOf(attributes: TextAttributes, scale: number): string {
  const declarations: string[] = [];

  if (attributes.bold !== undefined) {
    declarations.push(`font-weight:${attributes.bold ? 700 : 400}`);
  }
  if (attributes.italic !== undefined) {
    declarations.push(`font-style:${attributes.italic ? "italic" : "normal"}`);
  }
  if (attributes.strike !== undefined) {
    declarations.push(
      `text-decoration:${attributes.strike ? "line-through" : "none"}`,
    );
  }
  if (attributes.fontSize !== undefined) {
    declarations.push(`font-size:${attributes.fontSize * scale}px`);
  }
  if (attributes.color !== undefined) {
    declarations.push(`color:${attributes.color}`);
  }

  return declarations.join(";");
}

function spanFor(segment: TextSegment, scale: number): HTMLElement {
  const span = document.createElement("span");
  const { bold, italic, strike, fontSize, color } = segment.attributes;

  if (bold !== undefined) span.setAttribute(BOLD_ATTRIBUTE, String(bold));
  if (italic !== undefined) span.setAttribute(ITALIC_ATTRIBUTE, String(italic));
  if (strike !== undefined) span.setAttribute(STRIKE_ATTRIBUTE, String(strike));
  if (fontSize !== undefined) span.setAttribute(SIZE_ATTRIBUTE, String(fontSize));
  if (color !== undefined) span.setAttribute(COLOR_ATTRIBUTE, color);

  span.setAttribute("style", styleOf(segment.attributes, scale));
  span.textContent = segment.text;

  return span;
}

export function renderInto(
  element: HTMLElement,
  text: string,
  formats: TextFormat[],
  scale = 1,
) {
  element.replaceChildren(
    ...segmentsFor(text, formats).map((segment) => spanFor(segment, scale)),
  );
}

function attributesOf(node: Node): TextAttributes {
  const attributes: TextAttributes = {};

  for (let current: Node | null = node; current; current = current.parentNode) {
    if (!(current instanceof Element)) continue;

    const bold = current.getAttribute(BOLD_ATTRIBUTE);
    const italic = current.getAttribute(ITALIC_ATTRIBUTE);
    const strike = current.getAttribute(STRIKE_ATTRIBUTE);
    const size = current.getAttribute(SIZE_ATTRIBUTE);
    const color = current.getAttribute(COLOR_ATTRIBUTE);

    // Nearest wins, so only fill what an inner span has not already set.
    if (attributes.bold === undefined && bold !== null) {
      attributes.bold = bold === "true";
    }
    if (attributes.italic === undefined && italic !== null) {
      attributes.italic = italic === "true";
    }
    if (attributes.strike === undefined && strike !== null) {
      attributes.strike = strike === "true";
    }
    if (attributes.fontSize === undefined && size !== null) {
      attributes.fontSize = Number(size);
    }
    if (attributes.color === undefined && color !== null) {
      attributes.color = color;
    }
  }

  return attributes;
}

function textNodesOf(element: HTMLElement): Text[] {
  const nodes: Text[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node as Text);
      return;
    }

    // A <br> or a block boundary is a line break as far as the model is
    // concerned; browsers produce both while editing.
    if (node instanceof HTMLBRElement) {
      const line = document.createTextNode("\n");
      nodes.push(line);
      return;
    }

    node.childNodes.forEach(walk);
  };

  element.childNodes.forEach(walk);
  return nodes;
}

export function readFrom(element: HTMLElement): {
  text: string;
  formats: TextFormat[];
} {
  let text = "";
  const formats: TextFormat[] = [];

  for (const node of textNodesOf(element)) {
    const content = node.data;
    if (!content) continue;

    const attributes = attributesOf(node);
    const last = formats[formats.length - 1];

    if (
      last &&
      last.index + last.length === text.length &&
      sameAttributes(last.attributes, attributes)
    ) {
      last.length += content.length;
    } else {
      formats.push({
        index: text.length,
        length: content.length,
        attributes,
      });
    }

    text += content;
  }

  return {
    text,
    formats: formats.filter(
      (format) => Object.keys(format.attributes).length > 0,
    ),
  };
}

function sameAttributes(a: TextAttributes, b: TextAttributes): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.strike === b.strike &&
    a.fontSize === b.fontSize &&
    a.color === b.color
  );
}

// Maps between the DOM selection and indices into the flat text, which is what
// the format model works in.
export function selectionRange(element: HTMLElement): TextRange | null {
  const selection = element.ownerDocument.defaultView?.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) return null;

  const offsetOf = (node: Node, offset: number): number => {
    let total = 0;

    for (const textNode of textNodesOf(element)) {
      if (textNode === node) return total + offset;
      total += textNode.data.length;
    }

    return total;
  };

  const start = offsetOf(range.startContainer, range.startOffset);
  const end = offsetOf(range.endContainer, range.endOffset);

  return { index: Math.min(start, end), length: Math.abs(end - start) };
}

export function restoreSelection(element: HTMLElement, target: TextRange) {
  const selection = element.ownerDocument.defaultView?.getSelection();
  if (!selection) return;

  const locate = (offset: number): { node: Node; offset: number } => {
    let seen = 0;

    for (const textNode of textNodesOf(element)) {
      const length = textNode.data.length;
      if (seen + length >= offset) return { node: textNode, offset: offset - seen };
      seen += length;
    }

    return { node: element, offset: element.childNodes.length };
  };

  const from = locate(target.index);
  const to = locate(target.index + target.length);
  const range = element.ownerDocument.createRange();

  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);

  selection.removeAllRanges();
  selection.addRange(range);
}
